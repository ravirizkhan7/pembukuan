/**
 * MIGRATION RUNNER BERVERSI (SQLITE)
 * 
 * Bertanggung jawab mengeksekusi migrasi skema secara teratur,
 * mencatat riwayat versi di tabel 'schema_migrations',
 * menjaga data 'app_metadata' yang sudah ada,
 * serta memastikan idempotensi ketika dijalankan berulang kali.
 */

import { MIGRATIONS, MigrationDefinition } from './migrations';

export interface AppliedMigration {
  version: number;
  name: string;
  applied_at: string;
}

export interface MigrationResult {
  success: boolean;
  appliedCount: number;
  currentVersion: number;
  alreadyUpToDate: boolean;
  error?: string;
}

export interface SqlExecutor {
  query<T = any>(statement: string, params?: any[]): Promise<T[]>;
  run(statement: string, params?: any[]): Promise<{ changes?: number; lastId?: number }>;
  execute?(statement: string): Promise<any>;
}

export class MigrationRunner {
  /**
   * Menjalankan seluruh migrasi yang belum terpasang.
   */
  public static async runMigrations(
    executor: SqlExecutor,
    migrationsList: MigrationDefinition[] = MIGRATIONS
  ): Promise<MigrationResult> {
    try {
      // 1. Pastikan Foreign Key constraint selalu aktif
      await executor.run('PRAGMA foreign_keys = ON;');

      // 2. Buat tabel pelacak migrasi jika belum ada
      await executor.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // 3. Baca daftar migrasi yang sudah pernah diaplikasikan
      const appliedRows = await executor.query<AppliedMigration>(
        'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;'
      );
      const appliedVersions = new Set<number>(appliedRows.map((r) => r.version));

      // 4. Kompatibilitas Mundur & Sinkronisasi Skema Fisik:
      // Periksa keberadaan tabel dan trigger yang sudah terbentuk pada database aktif
      // untuk memastikan riwayat 'schema_migrations' konsisten dengan skema riil.
      const existingTables = await executor.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table';"
      );
      const existingTableNames = new Set(existingTables.map((t) => t.name));

      const existingTriggers = await executor.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'trigger';"
      );
      const existingTriggerNames = new Set(existingTriggers.map((t) => t.name));

      const now = new Date().toISOString();

      // v1 check (app_metadata)
      if (!appliedVersions.has(1) && existingTableNames.has('app_metadata')) {
        await executor.run(
          "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (1, 'initial_app_metadata', ?);",
          [now]
        );
        appliedVersions.add(1);
      }

      // v2 check (station_info)
      if (!appliedVersions.has(2) && existingTableNames.has('station_info')) {
        await executor.run(
          "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (2, 'canonical_spbu_akrual_schema', ?);",
          [now]
        );
        appliedVersions.add(2);
      }

      // v3 check (shift_sessions)
      if (!appliedVersions.has(3) && existingTableNames.has('shift_sessions')) {
        await executor.run(
          "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (3, '003_shift_sessions_and_attendance_history', ?);",
          [now]
        );
        appliedVersions.add(3);
      }

      // v4 check (trg_transactions_prevent_cancel_if_posted)
      if (!appliedVersions.has(4) && existingTriggerNames.has('trg_transactions_prevent_cancel_if_posted')) {
        await executor.run(
          "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (4, '004_enforce_safe_cancellation', ?);",
          [now]
        );
        appliedVersions.add(4);
      }

      let appliedCount = 0;
      const sortedMigrations = [...migrationsList].sort((a, b) => a.version - b.version);

      // 5. Eksekusi setiap migrasi yang belum terpasang
      for (const migration of sortedMigrations) {
        if (!appliedVersions.has(migration.version)) {
          console.log(`[MigrationRunner] Mengaplikasikan migrasi v${migration.version}: ${migration.name}...`);

          for (const stmt of migration.statements) {
            const cleanStmt = stmt.trim();
            if (cleanStmt.length > 0) {
              // Normalisasi DDL untuk mencegah pemecahan trigger pada Capacitor Android (split ;\n)
              const normalizedStmt = cleanStmt.replace(/;\s*[\r\n]+/g, (match, offset, str) => {
                const remaining = str.slice(offset + match.length).trim();
                return remaining.length === 0 ? ';' : '; ';
              });

              if (executor.execute) {
                await executor.execute(normalizedStmt);
              } else {
                await executor.run(normalizedStmt);
              }
            }
          }

          const appliedAt = new Date().toISOString();
          await executor.run(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
            [migration.version, migration.name, appliedAt]
          );

          // Update catatan versi di app_metadata
          await executor.run(
            `INSERT INTO app_metadata (key, value, created_at, updated_at)
             VALUES ('schema_version', ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at;`,
            [migration.version.toString(), appliedAt, appliedAt]
          );

          appliedVersions.add(migration.version);
          appliedCount++;
          console.log(`[MigrationRunner] Migrasi v${migration.version} berhasil diaplikasikan.`);
        }
      }

      const currentVersion = Math.max(0, ...Array.from(appliedVersions));

      return {
        success: true,
        appliedCount,
        currentVersion,
        alreadyUpToDate: appliedCount === 0
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error('[MigrationRunner] Gagal menjalankan migrasi:', errorMsg);
      return {
        success: false,
        appliedCount: 0,
        currentVersion: -1,
        alreadyUpToDate: false,
        error: errorMsg
      };
    }
  }

  /**
   * Mengambil riwayat migrasi yang telah diaplikasikan
   */
  public static async getAppliedMigrations(executor: SqlExecutor): Promise<AppliedMigration[]> {
    try {
      const rows = await executor.query<AppliedMigration>(
        'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;'
      );
      return rows || [];
    } catch {
      return [];
    }
  }

  /**
   * Mengambil versi skema aktif saat ini
   */
  public static async getCurrentVersion(executor: SqlExecutor): Promise<number> {
    try {
      const rows = await executor.query<{ max_ver: number | null }>(
        'SELECT MAX(version) AS max_ver FROM schema_migrations;'
      );
      if (rows && rows.length > 0 && rows[0].max_ver !== null) {
        return rows[0].max_ver;
      }
      return 0;
    } catch {
      return 0;
    }
  }
}

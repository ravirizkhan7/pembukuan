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

export interface MigrationExpectedObjects {
  version: number;
  name: string;
  tables: string[];
  indices: string[];
  triggers: string[];
  columns?: { table: string; column: string }[];
}

export const EXPECTED_MIGRATION_OBJECTS: Record<number, MigrationExpectedObjects> = {
  1: {
    version: 1,
    name: 'initial_app_metadata',
    tables: ['app_metadata'],
    indices: [],
    triggers: []
  },
  2: {
    version: 2,
    name: 'canonical_spbu_akrual_schema',
    tables: [
      'station_info',
      'product_categories',
      'products',
      'tanks',
      'nozzles',
      'shifts',
      'pegawai',
      'attendances',
      'business_partners',
      'accounts',
      'master_codes',
      'tera',
      'transactions',
      'journals',
      'journal_entries',
      'receivables',
      'payables'
    ],
    indices: [
      'idx_products_category',
      'idx_tanks_product',
      'idx_nozzles_tank',
      'idx_nozzles_product',
      'idx_shifts_status',
      'idx_pegawai_shift',
      'idx_attendances_employee',
      'idx_attendances_shift',
      'idx_master_codes_category',
      'idx_master_codes_debit_acc',
      'idx_master_codes_credit_acc',
      'idx_tera_nozzle',
      'idx_tera_shift',
      'idx_transactions_date',
      'idx_transactions_shift',
      'idx_transactions_master_code',
      'idx_transactions_partner',
      'idx_journals_transaction',
      'idx_journal_entries_journal',
      'idx_journal_entries_account',
      'idx_receivables_transaction',
      'idx_receivables_partner',
      'idx_payables_transaction',
      'idx_payables_partner',
      'uq_journal_reversal_target'
    ],
    triggers: [
      'trg_shifts_single_active_insert',
      'trg_shifts_single_active_update',
      'trg_transactions_enforce_immutability_when_selesai',
      'trg_transactions_prevent_mutation_when_cancelled',
      'trg_transactions_prevent_delete',
      'trg_journals_require_selesai_transaction',
      'trg_receivables_require_selesai_transaction',
      'trg_payables_require_selesai_transaction',
      'trg_receivables_prevent_cancel_if_paid',
      'trg_payables_prevent_cancel_if_paid',
      'trg_receivables_prevent_mutation_when_batal',
      'trg_payables_prevent_mutation_when_batal'
    ]
  },
  3: {
    version: 3,
    name: '003_shift_sessions_and_attendance_history',
    tables: ['shift_sessions'],
    indices: [
      'idx_shift_sessions_shift_id',
      'idx_shift_sessions_date',
      'idx_single_active_shift_session',
      'idx_attendances_employee_date'
    ],
    triggers: []
  },
  4: {
    version: 4,
    name: '004_enforce_safe_cancellation',
    tables: [],
    indices: [],
    triggers: ['trg_transactions_prevent_cancel_if_posted']
  },
  5: {
    version: 5,
    name: '005_add_city_to_station_info',
    tables: [],
    indices: [],
    triggers: [],
    columns: [{ table: 'station_info', column: 'city' }]
  }
};

/**
 * Mengambil daftar objek fisik (tabel, indeks, trigger, dan kolom) yang ada di SQLite saat ini
 */
export async function getPhysicalSchemaObjects(executor: SqlExecutor): Promise<{
  tables: Set<string>;
  indices: Set<string>;
  triggers: Set<string>;
  columns: Set<string>;
}> {
  const masterRows = await executor.query<{ type: string; name: string }>(
    "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%';"
  );
  const tables = new Set<string>();
  const indices = new Set<string>();
  const triggers = new Set<string>();
  for (const row of masterRows) {
    if (row.type === 'table') tables.add(row.name);
    else if (row.type === 'index') indices.add(row.name);
    else if (row.type === 'trigger') triggers.add(row.name);
  }

  const columns = new Set<string>();
  if (tables.has('station_info')) {
    try {
      const colRows = await executor.query<{ name: string }>('PRAGMA table_info(station_info);');
      for (const col of colRows) {
        columns.add(`station_info.${col.name}`);
      }
    } catch {
      // Abaikan jika pragma table_info tidak didukung oleh mock environment
    }
  }

  return { tables, indices, triggers, columns };
}

/**
 * Memeriksa kelengkapan objek fisik untuk versi migrasi tertentu
 */
export function checkVersionSchemaObjects(
  version: number,
  tables: Set<string>,
  indices: Set<string>,
  triggers: Set<string>,
  columns?: Set<string>
): {
  isComplete: boolean;
  foundCount: number;
  totalCount: number;
  missingTables: string[];
  missingIndices: string[];
  missingTriggers: string[];
  missingColumns: string[];
  missingDescription: string;
} {
  const exp = EXPECTED_MIGRATION_OBJECTS[version];
  if (!exp) {
    return {
      isComplete: true,
      foundCount: 0,
      totalCount: 0,
      missingTables: [],
      missingIndices: [],
      missingTriggers: [],
      missingColumns: [],
      missingDescription: ''
    };
  }
  const missingTables = exp.tables.filter((t) => !tables.has(t));
  const missingIndices = exp.indices.filter((i) => !indices.has(i));
  const missingTriggers = exp.triggers.filter((tr) => !triggers.has(tr));
  const missingColumns = (exp.columns || [])
    .filter((c) => !columns || !columns.has(`${c.table}.${c.column}`))
    .map((c) => `${c.table}.${c.column}`);

  const totalCount = exp.tables.length + exp.indices.length + exp.triggers.length + (exp.columns?.length || 0);
  const missingCount = missingTables.length + missingIndices.length + missingTriggers.length + missingColumns.length;
  const foundCount = totalCount - missingCount;

  const parts: string[] = [];
  if (missingTables.length > 0) parts.push(`Tabel: [${missingTables.join(', ')}]`);
  if (missingIndices.length > 0) parts.push(`Indeks: [${missingIndices.join(', ')}]`);
  if (missingTriggers.length > 0) parts.push(`Trigger: [${missingTriggers.join(', ')}]`);
  if (missingColumns.length > 0) parts.push(`Kolom: [${missingColumns.join(', ')}]`);

  return {
    isComplete: missingCount === 0,
    foundCount,
    totalCount,
    missingTables,
    missingIndices,
    missingTriggers,
    missingColumns,
    missingDescription: parts.join('; ')
  };
}

export class MigrationRunner {
  /**
   * Menjalankan seluruh migrasi yang belum terpasang dengan verifikasi skema ketat.
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

      // 4. Kompatibilitas Mundur & Audit Skema Fisik:
      // Ambil daftar seluruh tabel, indeks, dan trigger fisik yang ada di sqlite_master
      let physical = await getPhysicalSchemaObjects(executor);
      const now = new Date().toISOString();
      const sortedMigrations = [...migrationsList].sort((a, b) => a.version - b.version);

      // Periksa setiap versi migrasi yang didukung (v1 - v5)
      for (const m of sortedMigrations) {
        const v = m.version;
        const check = checkVersionSchemaObjects(v, physical.tables, physical.indices, physical.triggers, physical.columns);

        if (appliedVersions.has(v)) {
          // KASUS A: Versi ini tercatat di schema_migrations.
          // Pastikan SELURUH tabel, indeks, trigger, dan kolom wajib versi ini benar-benar ada!
          if (!check.isComplete) {
            console.warn(
              `[MigrationRunner] Versi v${v} (${m.name}) tercatat di schema_migrations, namun objek fisik belum lengkap: ${check.missingDescription}. Mencoba pemulihan aman...`
            );
            // Coba pulihkan objek yang hilang dengan mengeksekusi DDL migrasi versi ini
            for (const stmt of m.statements) {
              const cleanStmt = stmt.trim();
              if (cleanStmt.length > 0) {
                const normalizedStmt = cleanStmt.replace(/;\s*[\r\n]+/g, (match, offset, str) => {
                  const remaining = str.slice(offset + match.length).trim();
                  return remaining.length === 0 ? ';' : '; ';
                });
                try {
                  if (executor.execute) {
                    await executor.execute(normalizedStmt);
                  } else {
                    await executor.run(normalizedStmt);
                  }
                } catch (recErr: any) {
                  const errMsg = String(recErr?.message || recErr);
                  if (errMsg.includes('duplicate column name') || errMsg.includes('already exists')) {
                    console.warn(`[MigrationRunner] Kolom sudah ada saat pemulihan: ${errMsg}`);
                  } else {
                    throw recErr;
                  }
                }
              }
            }

            // Periksa ulang setelah pemulihan
            physical = await getPhysicalSchemaObjects(executor);
            const recheck = checkVersionSchemaObjects(v, physical.tables, physical.indices, physical.triggers, physical.columns);
            if (!recheck.isComplete) {
              throw new Error(
                `Database parsial terdeteksi pada migrasi v${v} (${m.name}). Objek fisik wajib hilang: ${recheck.missingDescription}. Pemulihan tidak dapat dilakukan dengan aman. Inisialisasi dihentikan.`
              );
            }
          }
        } else {
          // KASUS B: Versi ini BELUM tercatat di schema_migrations.
          if (check.isComplete) {
            // KASUS B1: SELURUH tabel, indeks, trigger, dan kolom wajib versi ini LENGKAP 100% di SQLite!
            // Ini membuktikan versi tersebut sudah terbentuk secara fisik (misal dari upgrade Capacitor atau restore).
            // Aman untuk merekonstruksi catatan migrasi:
            await executor.run(
              'INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
              [v, m.name, now]
            );
            appliedVersions.add(v);
            console.log(
              `[MigrationRunner] Rekonstruksi catatan migrasi v${v} (${m.name}) berhasil: seluruh ${check.totalCount} objek fisik terverifikasi lengkap.`
            );
          } else if (check.foundCount > 0) {
            // KASUS B2: DATABASE PARSIAL!
            // Hanya sebagian objek yang ditemukan.
            console.warn(
              `[MigrationRunner] Database parsial terdeteksi pada migrasi v${v} (${m.name}): ${check.foundCount}/${check.totalCount} objek fisik ditemukan. Objek belum lengkap: ${check.missingDescription}. Membutuhkan eksekusi pemulihan skema.`
            );
          }
          // KASUS B3: foundCount === 0 (Database bersih / belum ada objek migrasi ini)
          // Dibiarkan untuk dieksekusi secara normal pada langkah 5.
        }
      }

      let appliedCount = 0;

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

              try {
                if (executor.execute) {
                  await executor.execute(normalizedStmt);
                } else {
                  await executor.run(normalizedStmt);
                }
              } catch (execErr: any) {
                const errMsg = String(execErr?.message || execErr);
                if (errMsg.includes('duplicate column name') || errMsg.includes('already exists')) {
                  console.warn(`[MigrationRunner] Kolom sudah ada di SQLite, migrasi v${migration.version} melanjutkan: ${errMsg}`);
                } else {
                  throw execErr;
                }
              }
            }
          }

          // Verifikasi fisik ketat pasca-eksekusi: pastikan SELURUH tabel, indeks, trigger, dan kolom wajib benar-benar terbentuk!
          physical = await getPhysicalSchemaObjects(executor);
          const postCheck = checkVersionSchemaObjects(
            migration.version,
            physical.tables,
            physical.indices,
            physical.triggers,
            physical.columns
          );

          if (!postCheck.isComplete) {
            throw new Error(
              `Migrasi v${migration.version} (${migration.name}) gagal melengkapi seluruh objek fisik. Objek yang belum terbentuk: ${postCheck.missingDescription}. Inisialisasi dihentikan.`
            );
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
          console.log(
            `[MigrationRunner] Migrasi v${migration.version} (${migration.name}) berhasil diverifikasi & diaplikasikan (${postCheck.totalCount} objek fisik valid).`
          );
        }
      }

      // 6. Verifikasi Akhir Integritas Seluruh Skema Aktif
      physical = await getPhysicalSchemaObjects(executor);
      for (const m of sortedMigrations) {
        if (appliedVersions.has(m.version)) {
          const finalCheck = checkVersionSchemaObjects(
            m.version,
            physical.tables,
            physical.indices,
            physical.triggers,
            physical.columns
          );
          if (!finalCheck.isComplete) {
            throw new Error(
              `Integritas skema database tidak valid setelah migrasi: Objek wajib migrasi v${m.version} (${m.name}) hilang: ${finalCheck.missingDescription}. Inisialisasi dihentikan.`
            );
          }
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

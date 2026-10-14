import { sqliteService } from './sqliteService';
import { DATABASE_NAME, DATABASE_VERSION } from './databaseConfig';
import { Capacitor } from '@capacitor/core';

export interface AppMetadataRow {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface InstallationMetadata {
  installationId: string;
  initializedAt: string;
  isFirstInit: boolean;
}

export interface DatabaseDiagnosticsResult {
  success: boolean;
  databaseName: string;
  databaseVersion: number;
  platform: string;
  isNative: boolean;
  sqliteVersion: string;
  installationId: string;
  initializedAt: string;
  isFirstInit: boolean;
  error?: string;
}

/**
 * Service untuk mengakses tabel app_metadata tanpa eksposur SQL langsung ke komponen UI.
 */
export class AppMetadataService {
  /**
   * Mengambil nilai metadata berdasarkan key
   */
  public static async get(key: string): Promise<string | null> {
    try {
      const rows = await sqliteService.query<AppMetadataRow>(
        'SELECT key, value, created_at, updated_at FROM app_metadata WHERE key = ? LIMIT 1;',
        [key]
      );
      if (rows && rows.length > 0) {
        return rows[0].value;
      }
      return null;
    } catch (err) {
      console.error(`[AppMetadataService] Gagal membaca metadata [${key}]:`, err);
      throw err;
    }
  }

  /**
   * Menyimpan atau memperbarui nilai metadata
   */
  public static async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      await sqliteService.run(
        `INSERT INTO app_metadata (key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at;`,
        [key, value, now, now]
      );
    } catch (err) {
      console.error(`[AppMetadataService] Gagal menyimpan metadata [${key}]:`, err);
      throw err;
    }
  }

  /**
   * Menjamin bahwa identifikasi instalasi aplikasi tersimpan tepat satu kali (idempotent),
   * dan membaca kembali nilai yang sama saat aplikasi dibuka kembali (pembuktian persistensi).
   */
  public static async ensureInstallationMetadata(): Promise<InstallationMetadata> {
    const existingId = await this.get('installation_id');
    const existingTime = await this.get('db_initialized_at');

    if (existingId && existingTime) {
      // Nilai sudah ada sebelumnya (aplikasi dibuka kembali/restart)
      return {
        installationId: existingId,
        initializedAt: existingTime,
        isFirstInit: false
      };
    }

    // Instalasi pertama kali: buat installationId unik dalam satu transaksi atomik
    const newId = `AKRUAL-INST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    await sqliteService.runTransaction(async () => {
      await this.set('installation_id', newId);
      await this.set('db_initialized_at', now);
    });

    console.log(`[AppMetadataService] Inisialisasi metadata instalasi baru: ${newId} pada ${now}`);

    return {
      installationId: newId,
      initializedAt: now,
      isFirstInit: true
    };
  }

  /**
   * Menjalankan diagnosa koneksi database SQLite (POC Phase 1)
   */
  public static async runDiagnostics(): Promise<DatabaseDiagnosticsResult> {
    try {
      // 1. Inisialisasi koneksi
      await sqliteService.initialize();

      // 2. Query versi SQLite: SELECT sqlite_version()
      const sqliteVer = await sqliteService.getSqliteVersion();

      // 3. Verifikasi pembacaan/penulisan identifikasi instalasi
      const installMeta = await this.ensureInstallationMetadata();

      const result: DatabaseDiagnosticsResult = {
        success: true,
        databaseName: DATABASE_NAME,
        databaseVersion: DATABASE_VERSION,
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
        sqliteVersion: sqliteVer,
        installationId: installMeta.installationId,
        initializedAt: installMeta.initializedAt,
        isFirstInit: installMeta.isFirstInit
      };

      console.log('[AppMetadataService] Hasil Diagnosa SQLite:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error('[AppMetadataService] Diagnosa SQLite gagal:', errorMsg);
      return {
        success: false,
        databaseName: DATABASE_NAME,
        databaseVersion: DATABASE_VERSION,
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
        sqliteVersion: 'N/A',
        installationId: 'N/A',
        initializedAt: 'N/A',
        isFirstInit: false,
        error: errorMsg
      };
    }
  }
}

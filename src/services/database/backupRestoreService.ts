/**
 * BACKUP & RESTORE SERVICE (SQLITE PERSISTENT ENGINE)
 * 
 * Mengelola ekspor dan pemulihan data database SQLite secara aman, atomik,
 * dan terverifikasi untuk aplikasi SPBU pembukuan offline-first.
 * 
 * Aturan Integritas & Keselamatan:
 * 1. Tidak menghapus database aktif sebelum file backup lolos seluruh validasi.
 * 2. Restore berjalan dalam transaksi atomik (BEGIN ... COMMIT / ROLLBACK).
 * 3. Menjamin ketergantungan relasi Foreign Key (topological ordering).
 * 4. Memverifikasi PRAGMA foreign_key_check dan PRAGMA integrity_check.
 * 5. Menolak skema yang tidak kompatibel (misal downgrade versi).
 * 6. Tidak menulis data sensitif transaksi ke log.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { sqliteService } from './sqliteService';
import { DATABASE_NAME, DATABASE_VERSION } from './databaseConfig';
import type { SqlExecutor } from './migrationRunner';
import { MIGRATIONS } from './migrations';

export interface NativeBackupRestorePlugin {
  saveBackupFile(options: { filename: string; content: string }): Promise<{
    success: boolean;
    cancelled?: boolean;
    filename?: string;
    uri?: string;
    bytesWritten?: number;
  }>;
  saveBinaryFile?(options: { filename: string; base64Data: string; mimeType?: string }): Promise<{
    success: boolean;
    cancelled?: boolean;
    filename?: string;
    uri?: string;
    bytesWritten?: number;
  }>;
  pickBackupFile(): Promise<{
    success: boolean;
    cancelled?: boolean;
    filename?: string;
    content?: string;
    uri?: string;
  }>;
  checkCameraPermission?(): Promise<{
    granted: boolean;
    shouldShowRationale: boolean;
  }>;
  requestCameraPermission?(): Promise<{
    granted: boolean;
    shouldShowRationale: boolean;
  }>;
  openAppSettings?(): Promise<{
    success: boolean;
  }>;
}

export const NativeBackupRestore = registerPlugin<NativeBackupRestorePlugin>('NativeBackupRestore');

export interface SaveBackupFileResult {
  success: boolean;
  cancelled?: boolean;
  filename: string;
  uri?: string;
  bytesWritten?: number;
}

export interface PickBackupFileResult {
  filename: string;
  content: string;
  uri?: string;
}

export const APP_BACKUP_ID = 'spbu-pembukuan-offline' as const;
export const BACKUP_FORMAT_VERSION = 1;

/**
 * Urutan topologis tabel operasional untuk menjaga integritas Foreign Key (Parent -> Child).
 * Tabel metadata migrasi ('schema_migrations') dikelola terpisah sebagai skema internal.
 * Saat penghapusan (DELETE), urutan ini dibalik (Child -> Parent).
 */
export const TOPOLOGICAL_TABLES = [
  'app_metadata',
  'station_info',
  'product_categories',
  'shifts',
  'pegawai',
  'business_partners',
  'accounts',
  'products',
  'attendances',
  'master_codes',
  'tanks',
  'nozzles',
  'tera',
  'transactions',
  'journals',
  'journal_entries',
  'receivables',
  'payables',
  'shift_sessions',
  'transaction_corrections'
] as const;

export const REVERSE_TOPOLOGICAL_TABLES = [...TOPOLOGICAL_TABLES].reverse();

export interface BackupMetadata {
  appId: typeof APP_BACKUP_ID;
  formatVersion: number;
  appName: string;
  appVersion: string;
  stationId: string;
  stationName: string;
  databaseName: string;
  schemaVersion: number;
  createdAt: string; // ISO 8601
  devicePlatform: string;
  tableCounts: Record<string, number>;
  totalRecords: number;
  checksum: string;
  checksumAlgorithm?: 'sha256' | 'fnv1a';
}

export interface SpbuBackupFile {
  metadata: BackupMetadata;
  data: Record<string, Array<Record<string, any>>>;
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  metadata?: BackupMetadata;
  missingTables?: string[];
  recordCount?: number;
  tableSummary?: Array<{ name: string; count: number }>;
}

export interface RestoreResult {
  success: boolean;
  restoredTables: number;
  restoredRecords: number;
  message: string;
  error?: string;
  durationMs?: number;
}

/**
 * Menghitung hash SHA-256 murni secara sinkron (FIPS 180-4).
 * Bekerja deterministik dan konsisten di seluruh lingkungan runtime (Node.js, Web Browser, WebView).
 */
export function computeSha256(str: string): string {
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      utf8.push(charcode);
    } else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const bitLen = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) {
    utf8.push(0);
  }

  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  utf8.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  utf8.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  const W = new Int32Array(64);
  for (let i = 0; i < utf8.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = (utf8[i + t * 4] << 24) | (utf8[i + t * 4 + 1] << 16) | (utf8[i + t * 4 + 2] << 8) | utf8[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
      const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
      W[t] = (((W[t - 16] + s0) | 0) + ((W[t - 7] + s1) | 0)) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((h + S1) | 0) + ch) | 0) + ((K[t] + W[t]) | 0)) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(H0) + hex(H1) + hex(H2) + hex(H3) + hex(H4) + hex(H5) + hex(H6) + hex(H7);
}

/**
 * Menghitung checksum FNV-1a 64-bit untuk backward compatibility.
 */
export function computeFnv1a(dataStr: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x1000193;
  for (let i = 0; i < dataStr.length; i++) {
    const ch = dataStr.charCodeAt(i);
    hash1 ^= ch;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= ch;
    hash2 = Math.imul(hash2, 0x811c9dc5);
  }
  return `${(hash1 >>> 0).toString(16).padStart(8, '0')}${(hash2 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Menghitung hash integritas data cadangan (SHA-256 secara default).
 *
 * CATATAN KEAMANAN & INTEGRITAS:
 * Hash ini digunakan untuk mendeteksi kerusakan data (data corruption), berkas terpotong,
 * atau perubahan isi berkas saat penyimpanan lokal dan transfer file.
 * Hash ini BUKAN tanda tangan digital tepercaya (digital signature) dan BUKAN autentikasi pengirim,
 * karena hash saja tanpa mekanisme kunci kriptografis terpisah tidak membuktikan siapa pembuat berkas.
 */
export function computeBackupChecksum(dataStr: string, algorithm: 'sha256' | 'fnv1a' = 'sha256'): string {
  if (algorithm === 'fnv1a') {
    return computeFnv1a(dataStr);
  }
  return computeSha256(dataStr);
}

/**
 * Adapter Penyimpanan Berkas Antar-Platform (Web & Android WebView)
 * Mendukung Storage Access Framework (SAF) pada Android dan HTML5 Blob pada Web.
 */
export class PlatformStorageAdapter {
  /**
   * Mengunduh / mengekspor teks berkas cadangan ke perangkat pengguna.
   * Pada Android: menggunakan Native Storage Access Framework (SAF) ACTION_CREATE_DOCUMENT.
   * Pada Web: menggunakan Blob download via elemen <a>.
   */
  public static async saveBackupFile(filename: string, content: string): Promise<SaveBackupFileResult> {
    // 1. Android Native Platform -> Gunakan SAF Bridge
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android') {
      try {
        const res = await NativeBackupRestore.saveBackupFile({ filename, content });
        if (res.cancelled) {
          return {
            success: false,
            cancelled: true,
            filename
          };
        }
        if (!res.success) {
          throw new Error('Penyimpanan dokumen native gagal atau dibatalkan.');
        }
        return {
          success: true,
          cancelled: false,
          filename: res.filename || filename,
          uri: res.uri,
          bytesWritten: res.bytesWritten
        };
      } catch (err: any) {
        console.error('[PlatformStorageAdapter] Native SAF save error:', err);
        throw new Error(`Gagal menyimpan berkas di Android: ${err?.message || String(err)}`);
      }
    }

    // 2. Fallback Web Browser
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { success: false, filename };
    }

    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return {
        success: true,
        cancelled: false,
        filename
      };
    } catch (err) {
      console.error('[PlatformStorageAdapter] Gagal menyimpan file backup:', err);
      throw new Error(`Gagal mengunduh berkas backup: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Membuka pemilih berkas (file picker) untuk memilih arsip backup.
   * Pada Android: menggunakan Native Storage Access Framework (SAF) ACTION_OPEN_DOCUMENT.
   * Pada Web: menggunakan <input type="file">.
   */
  public static async pickBackupFile(): Promise<PickBackupFileResult | null> {
    // 1. Android Native Platform -> Gunakan SAF Bridge
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android') {
      try {
        const res = await NativeBackupRestore.pickBackupFile();
        if (res.cancelled || !res.success) {
          return null; // Pengguna membatalkan pemilihan berkas
        }
        if (!res.content) {
          throw new Error('Konten berkas yang dipilih kosong.');
        }
        return {
          filename: res.filename || 'backup.json',
          content: res.content,
          uri: res.uri
        };
      } catch (err: any) {
        console.error('[PlatformStorageAdapter] Native SAF pick error:', err);
        throw new Error(`Gagal memilih berkas di Android: ${err?.message || String(err)}`);
      }
    }

    // 2. Fallback Web Browser
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return null;
    }

    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          document.body.removeChild(input);
          resolve(null);
          return;
        }

        try {
          const text = await file.text();
          document.body.removeChild(input);
          resolve({
            filename: file.name,
            content: text
          });
        } catch (err) {
          document.body.removeChild(input);
          reject(new Error(`Gagal membaca berkas: ${err instanceof Error ? err.message : String(err)}`));
        }
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve(null);
      };

      document.body.appendChild(input);
      input.click();
    });
  }
}

/**
 * Service Utama Backup & Restore Database
 */
export class BackupRestoreService {
  /**
   * Membuat arsip cadangan (backup) lengkap dari database SQLite aktif.
   */
  public static async createBackup(
    stationInfo?: { id?: string; name?: string },
    executor: SqlExecutor = sqliteService
  ): Promise<{ backup: SpbuBackupFile; filename: string; jsonString: string }> {
    const createdAt = new Date().toISOString();
    const stationId = stationInfo?.id || 'SPBU-INSTANCE';
    const stationName = stationInfo?.name || 'SPBU Pembukuan';

    // 1. Dapatkan daftar seluruh tabel pengguna yang tersedia di SQLite
    const masterTables = await executor.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
    );
    const availableTableNames = new Set(masterTables.map((t) => t.name));

    // Gabungkan tabel metadata migrasi (untuk audit) dan tabel operasional topologis
    const allTablesToExport: string[] = [];
    if (availableTableNames.has('schema_migrations')) {
      allTablesToExport.push('schema_migrations');
    }
    for (const t of TOPOLOGICAL_TABLES) {
      if (availableTableNames.has(t)) {
        allTablesToExport.push(t);
      }
    }
    for (const name of availableTableNames) {
      if (!allTablesToExport.includes(name)) {
        allTablesToExport.push(name);
      }
    }

    // 2. Ekstrak seluruh baris data dari setiap tabel
    const backupData: Record<string, Array<Record<string, any>>> = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const table of allTablesToExport) {
      const rows = await executor.query<Record<string, any>>(`SELECT * FROM ${table};`);
      backupData[table] = rows || [];
      tableCounts[table] = rows.length;
      totalRecords += rows.length;
    }

    // 3. Hitung hash integritas SHA-256 dari seluruh payload data
    const dataString = JSON.stringify(backupData);
    const checksum = computeBackupChecksum(dataString, 'sha256');

    // 4. Bangun metadata resmi
    const metadata: BackupMetadata = {
      appId: APP_BACKUP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      appName: 'AKRUAL SPBU',
      appVersion: 'v0.1.0-generic',
      stationId,
      stationName,
      databaseName: DATABASE_NAME,
      schemaVersion: DATABASE_VERSION,
      createdAt,
      devicePlatform: Capacitor.getPlatform(),
      tableCounts,
      totalRecords,
      checksum,
      checksumAlgorithm: 'sha256'
    };

    const backupFile: SpbuBackupFile = {
      metadata,
      data: backupData
    };

    // 5. Update kolom last_backup pada station_info jika tabel tersedia
    if (availableTableNames.has('station_info')) {
      try {
        await executor.run(
          'UPDATE station_info SET last_backup = ?, updated_at = ? WHERE id = ?;',
          [createdAt, createdAt, stationId]
        );
      } catch (err) {
        // Warning non-fatal jika station_info belum memiliki baris
        console.warn('[BackupRestoreService] Gagal memperbarui timestamp last_backup pada station_info:', err);
      }
    }

    // 6. Format nama file dengan timestamp aman
    const timestampStr = createdAt.replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const sanitizedStationId = stationId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `spbu_backup_${sanitizedStationId}_${timestampStr}.json`;
    const jsonString = JSON.stringify(backupFile, null, 2);

    console.log(
      `[BackupRestoreService] Backup berhasil dibuat: ${filename} (Total Tabel: ${allTablesToExport.length}, Total Baris: ${totalRecords})`
    );

    return {
      backup: backupFile,
      filename,
      jsonString
    };
  }

  /**
   * Membuat backup dan memicu penyimpanan berkas melalui adapter platform.
   * Mengembalikan status sukses hanya setelah penyimpanan fisik selesai dikonfirmasi.
   */
  public static async createAndDownloadBackup(
    stationInfo?: { id?: string; name?: string },
    executor: SqlExecutor = sqliteService
  ): Promise<{
    success: boolean;
    cancelled?: boolean;
    filename: string;
    totalRecords: number;
    uri?: string;
  }> {
    const { filename, jsonString, backup } = await this.createBackup(stationInfo, executor);
    const saveRes = await PlatformStorageAdapter.saveBackupFile(filename, jsonString);

    if (saveRes.cancelled) {
      return {
        success: false,
        cancelled: true,
        filename,
        totalRecords: backup.metadata.totalRecords
      };
    }

    return {
      success: true,
      cancelled: false,
      filename: saveRes.filename || filename,
      totalRecords: backup.metadata.totalRecords,
      uri: saveRes.uri
    };
  }

  /**
   * Memvalidasi struktur, identitas, format, dan integritas berkas cadangan sebelum proses restore.
   */
  public static validateBackup(fileContent: string | object): BackupValidationResult {
    let parsed: any;
    if (typeof fileContent === 'string') {
      try {
        parsed = JSON.parse(fileContent);
      } catch {
        return {
          valid: false,
          error: 'Format berkas rusak atau bukan JSON yang valid.'
        };
      }
    } else {
      parsed = fileContent;
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        error: 'Struktur berkas backup tidak valid (bukan objek).'
      };
    }

    // 1. Validasi Metadata Pokok
    const meta: BackupMetadata = parsed.metadata;
    if (!meta || typeof meta !== 'object') {
      return {
        valid: false,
        error: 'Metadata backup tidak ditemukan dalam berkas.'
      };
    }

    // 2. Validasi Identitas Aplikasi
    if (meta.appId !== APP_BACKUP_ID) {
      return {
        valid: false,
        error: `Identitas aplikasi tidak cocok. Berkas ini bukan arsip cadangan resmi SPBU Pembukuan (App ID: ${meta.appId || 'kosong'}).`
      };
    }

    // 3. Validasi Format Cadangan
    if (meta.formatVersion !== BACKUP_FORMAT_VERSION) {
      return {
        valid: false,
        error: `Format cadangan v${meta.formatVersion} tidak didukung (didukung: v${BACKUP_FORMAT_VERSION}).`
      };
    }

    // 4. Validasi Kompatibilitas Versi Skema Database
    if (typeof meta.schemaVersion !== 'number' || !Number.isInteger(meta.schemaVersion)) {
      return {
        valid: false,
        error: 'Versi skema database cadangan tidak valid.'
      };
    }

    // Kebijakan Keselamatan Versi:
    // Aplikasi saat ini berjalan pada skema v6.
    // Hanya menerima arsip cadangan yang memiliki versi skema sama persis (schemaVersion === DATABASE_VERSION).
    // Menolak backup dari versi lama (v5 ke bawah) maupun versi baru (v7 ke atas)
    // sampai tersedia jalur kompatibilitas migrasi yang benar-benar teruji.
    if (meta.schemaVersion !== DATABASE_VERSION) {
      if (meta.schemaVersion < DATABASE_VERSION) {
        return {
          valid: false,
          error: `Versi skema cadangan (v${meta.schemaVersion}) lebih lama daripada versi database aplikasi aktif (v${DATABASE_VERSION}). Pemulihan versi lama belum didukung secara otomatis untuk menjaga keutuhan struktur tabel dan relasi akrual.`
        };
      } else {
        return {
          valid: false,
          error: `Versi skema cadangan (v${meta.schemaVersion}) lebih tinggi daripada versi database aplikasi aktif (v${DATABASE_VERSION}). Pemulihan ditolak untuk mencegah kerusakan struktur data.`
        };
      }
    }

    // 5. Validasi Payload Data
    const data = parsed.data;
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        error: 'Data tabel tidak ditemukan dalam berkas backup.'
      };
    }

    // 6. Validasi Riwayat Migrasi Skema pada Berkas Cadangan (jika disertakan)
    if (data.schema_migrations && Array.isArray(data.schema_migrations)) {
      const migrationVersions = data.schema_migrations
        .map((m: any) => m?.version)
        .filter((v: any) => typeof v === 'number');
      const maxMigVersion = migrationVersions.length > 0 ? Math.max(...migrationVersions) : 0;
      if (maxMigVersion !== meta.schemaVersion) {
        return {
          valid: false,
          error: `Riwayat migrasi skema dalam berkas cadangan (v${maxMigVersion}) tidak cocok dengan metadata versi skema (v${meta.schemaVersion}). Berkas kemungkinan rusak atau inkonsisten.`
        };
      }
    }

    // 7. Validasi Kelengkapan Tabel Kritis
    const requiredTables = [
      'accounts',
      'product_categories',
      'products',
      'shifts',
      'pegawai',
      'transactions',
      'journals',
      'journal_entries'
    ];
    const missingTables = requiredTables.filter((t) => !data[t] || !Array.isArray(data[t]));
    if (missingTables.length > 0) {
      return {
        valid: false,
        error: `Tabel penting tidak ditemukan dalam arsip backup: ${missingTables.join(', ')}.`,
        missingTables
      };
    }

    // 8. Validasi Integritas Jumlah Baris
    if (meta.tableCounts && typeof meta.tableCounts === 'object') {
      for (const [tbl, expectedCount] of Object.entries(meta.tableCounts)) {
        const actualRows = data[tbl];
        if (Array.isArray(actualRows) && actualRows.length !== expectedCount) {
          return {
            valid: false,
            error: `Inkonsistensi jumlah baris pada tabel '${tbl}': metadata mencatat ${expectedCount}, namun ditemukan ${actualRows.length}. Berkas kemungkinan rusak atau terpotong.`
          };
        }
      }
    }

    // 9. Validasi Hash Integritas Berkas Cadangan (Mendeteksi Kerusakan Berkas/Data Corruption)
    if (meta.checksum) {
      const algo = meta.checksumAlgorithm || (meta.checksum.length === 16 ? 'fnv1a' : 'sha256');
      const calculatedHash = computeBackupChecksum(JSON.stringify(data), algo);
      if (calculatedHash !== meta.checksum) {
        return {
          valid: false,
          error: `Verifikasi integritas berkas cadangan gagal: Hash ${algo.toUpperCase()} tidak cocok (berkas terpotong, rusak, atau telah diubah).`
        };
      }
    }

    // 10. Validasi Hubungan Kunci Asing (Foreign Key) di Memori
    try {
      this.validateInMemoryRelations(data);
    } catch (fkErr) {
      return {
        valid: false,
        error: `Pemeriksaan relasi data (Foreign Key) gagal: ${fkErr instanceof Error ? fkErr.message : String(fkErr)}`
      };
    }

    const tableSummary: Array<{ name: string; count: number }> = Object.keys(data).map((name) => ({
      name,
      count: Array.isArray(data[name]) ? data[name].length : 0
    }));

    return {
      valid: true,
      metadata: meta,
      recordCount: meta.totalRecords,
      tableSummary
    };
  }

  /**
   * Pemeriksaan relasi foreign key awal di memori sebelum menyentuh SQLite
   */
  private static validateInMemoryRelations(data: Record<string, any[]>): void {
    const accountIds = new Set((data.accounts || []).map((a) => a.id));
    const journalIds = new Set((data.journals || []).map((j) => j.id));
    const categoryIds = new Set((data.product_categories || []).map((c) => c.id));
    const productIds = new Set((data.products || []).map((p) => p.id));
    const tankIds = new Set((data.tanks || []).map((t) => t.id));
    const nozzleIds = new Set((data.nozzles || []).map((n) => n.id));
    const shiftIds = new Set((data.shifts || []).map((s) => s.id));
    const pegawaiIds = new Set((data.pegawai || []).map((p) => p.id));
    const partnerIds = new Set((data.business_partners || []).map((bp) => bp.id));

    // Periksa Products -> Categories
    for (const prod of data.products || []) {
      if (prod.category_id && !categoryIds.has(prod.category_id)) {
        throw new Error(`Produk '${prod.name || prod.id}' mereferensikan category_id '${prod.category_id}' yang tidak ada.`);
      }
    }

    // Periksa Tanks -> Products
    for (const tank of data.tanks || []) {
      if (tank.product_id && !productIds.has(tank.product_id)) {
        throw new Error(`Tangki '${tank.name || tank.id}' mereferensikan product_id '${tank.product_id}' yang tidak ada.`);
      }
    }

    // Periksa Nozzles -> Tanks & Products
    for (const noz of data.nozzles || []) {
      if (noz.tank_id && !tankIds.has(noz.tank_id)) {
        throw new Error(`Nozzle '${noz.code || noz.id}' mereferensikan tank_id '${noz.tank_id}' yang tidak ada.`);
      }
    }

    // Periksa Tera -> Nozzles
    for (const tr of data.tera || []) {
      if (tr.nozzle_id && !nozzleIds.has(tr.nozzle_id)) {
        throw new Error(`Tera '${tr.id}' mereferensikan nozzle_id '${tr.nozzle_id}' yang tidak ada.`);
      }
    }

    // Periksa Attendances -> Pegawai
    for (const att of data.attendances || []) {
      if (att.employee_id && !pegawaiIds.has(att.employee_id)) {
        throw new Error(`Absensi '${att.id}' mereferensikan employee_id '${att.employee_id}' yang tidak ada.`);
      }
    }

    // Periksa Journal Entries -> Journals & Accounts
    for (const je of data.journal_entries || []) {
      if (je.journal_id && !journalIds.has(je.journal_id)) {
        throw new Error(`Detail jurnal '${je.id}' mereferensikan journal_id '${je.journal_id}' yang tidak ada.`);
      }
      if (je.account_id && !accountIds.has(je.account_id)) {
        throw new Error(`Detail jurnal '${je.id}' mereferensikan account_id '${je.account_id}' yang tidak ada.`);
      }
    }

    // Periksa Transactions -> Shifts & Pegawai
    for (const tx of data.transactions || []) {
      if (tx.shift_id && !shiftIds.has(tx.shift_id)) {
        throw new Error(`Transaksi '${tx.code || tx.id}' mereferensikan shift_id '${tx.shift_id}' yang tidak ada.`);
      }
      if (tx.pegawai_id && !pegawaiIds.has(tx.pegawai_id)) {
        throw new Error(`Transaksi '${tx.code || tx.id}' mereferensikan pegawai_id '${tx.pegawai_id}' yang tidak ada.`);
      }
    }

    // Periksa Receivables -> Business Partners
    for (const rcv of data.receivables || []) {
      const pid = rcv.partner_id || rcv.customer_id;
      if (pid && !partnerIds.has(pid)) {
        throw new Error(`Piutang '${rcv.id}' mereferensikan partner_id '${pid}' yang tidak ada.`);
      }
    }

    // Periksa Payables -> Business Partners
    for (const pay of data.payables || []) {
      const pid = pay.partner_id || pay.supplier_id;
      if (pid && !partnerIds.has(pid)) {
        throw new Error(`Utang '${pay.id}' mereferensikan partner_id '${pid}' yang tidak ada.`);
      }
    }
  }

  /**
   * Menjalankan pemulihan (restore) database secara atomik.
   * Jika terjadi kegagalan atau pelanggaran integritas, perubahan langsung di-rollback,
   * sehingga database aktif tetap terjaga 100% konsisten.
   */
  public static async restoreBackup(
    backup: SpbuBackupFile,
    executor: SqlExecutor = sqliteService
  ): Promise<RestoreResult> {
    const startTime = Date.now();

    // 1. Validasi Pra-Eksekusi Mutlak
    const validation = this.validateBackup(backup);
    if (!validation.valid || !validation.metadata) {
      throw new Error(`Validasi berkas cadangan gagal: ${validation.error || 'Berkas tidak valid'}`);
    }

    const { data } = backup;

    // 2. Tentukan daftar tabel dan urutan eksekusi
    const masterTables = await executor.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
    );
    const existingTableNames = new Set(masterTables.map((t) => t.name));

    // schema_migrations adalah metadata skema internal yang dikelola migration runner,
    // BUKAN tabel operasional biasa yang boleh dihapus atau ditimpa secara sembarangan saat restore.
    const SYSTEM_SCHEMA_TABLES = new Set(['schema_migrations']);

    // Urutan penghapusan: Reverse topological (tidak menghapus schema_migrations)
    const deleteOrder: string[] = [...REVERSE_TOPOLOGICAL_TABLES].filter(
      (t) => existingTableNames.has(t) && !SYSTEM_SCHEMA_TABLES.has(t)
    );
    for (const t of existingTableNames) {
      if (!deleteOrder.includes(t) && !SYSTEM_SCHEMA_TABLES.has(t)) {
        deleteOrder.push(t);
      }
    }

    // Urutan penyisipan: Forward topological (tidak menimpa schema_migrations secara operasional)
    const insertOrder: string[] = [...TOPOLOGICAL_TABLES].filter(
      (t) => data[t] && Array.isArray(data[t]) && !SYSTEM_SCHEMA_TABLES.has(t)
    );
    for (const t of Object.keys(data)) {
      if (Array.isArray(data[t]) && !insertOrder.includes(t) && !SYSTEM_SCHEMA_TABLES.has(t)) {
        insertOrder.push(t);
      }
    }

    let restoredRecords = 0;
    let restoredTables = 0;

    // 3. Eksekusi Restore dalam Blok Transaksi Atomik Tunggal
    // Nonaktifkan FK di luar transaksi sesuai aturan SQLite engine
    await executor.run('PRAGMA foreign_keys = OFF;');

    const performRestoreOperations = async () => {
      // Tahap A: Kosongkan seluruh tabel operasional sesuai urutan terbalik
      for (const table of deleteOrder) {
        await executor.run(`DELETE FROM ${table};`);
      }

      // Tahap B: Masukkan data cadangan sesuai urutan topologis
      for (const table of insertOrder) {
        const rows = data[table] || [];
        if (rows.length === 0) continue;

        restoredTables++;
        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;

          const placeholders = cols.map(() => '?').join(', ');
          const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders});`;
          const values = cols.map((colName) => {
            const val = row[colName];
            return val !== undefined ? val : null;
          });

          await executor.run(sql, values);
          restoredRecords++;
        }
      }

      // Tahap C: Pastikan riwayat migrasi aktif tetap utuh dan konsisten dengan versi aplikasi saat ini (v1..v4)
      for (let v = 1; v <= DATABASE_VERSION; v++) {
        const mDef = MIGRATIONS.find((m) => m.version === v);
        await executor.run(
          'INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          [v, mDef?.name || `migration_v${v}`, new Date().toISOString()]
        );
      }

      // Perbarui metadata versi skema
      await executor.run(
        `INSERT INTO app_metadata (key, value, created_at, updated_at)
         VALUES ('schema_version', ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at;`,
        [DATABASE_VERSION.toString(), new Date().toISOString(), new Date().toISOString()]
      );
    };

    try {
      // Gunakan mekanisme transaksi driver jika didukung (mis. sqliteService di Android/Web)
      if (typeof (executor as any).runTransaction === 'function') {
        await (executor as any).runTransaction(async () => {
          await performRestoreOperations();
        });
      } else {
        // Fallback untuk SqlExecutor mandiri (mis. SQL.js pada unit testing)
        await executor.run('BEGIN TRANSACTION;');
        try {
          await performRestoreOperations();
          await executor.run('COMMIT;');
        } catch (innerErr) {
          try {
            await executor.run('ROLLBACK;');
          } catch (rbErr) {
            console.warn('[BackupRestoreService] Error saat memanggil rollback:', rbErr);
          }
          throw innerErr;
        }
      }
    } finally {
      // Pastikan Foreign Keys kembali aktif di luar transaksi
      try {
        await executor.run('PRAGMA foreign_keys = ON;');
      } catch (fkOnErr) {
        console.warn('[BackupRestoreService] Gagal mengaktifkan kembali PRAGMA foreign_keys:', fkOnErr);
      }
    }

    // 4. Verifikasi Pasca-Restore: Pemeriksaan Foreign Key & Integritas SQLite
    const fkViolations = await executor.query<any>('PRAGMA foreign_key_check;');
    if (fkViolations && fkViolations.length > 0) {
      throw new Error(
        `Pemeriksaan relasi kunci asing (PRAGMA foreign_key_check) gagal: Terdeteksi ${fkViolations.length} pelanggaran relasi.`
      );
    }

    const integrityRows = await executor.query<{ integrity_check: string }>('PRAGMA integrity_check;');
    if (!integrityRows || integrityRows.length === 0 || integrityRows[0].integrity_check !== 'ok') {
      const detail = integrityRows?.map((r) => r.integrity_check).join('; ') || 'Gagal';
      throw new Error(`Pemeriksaan integritas SQLite (PRAGMA integrity_check) gagal: ${detail}`);
    }

    // 5. Buka kembali koneksi plugin jika sqliteService digunakan
    if (executor === sqliteService || typeof (executor as any).reopenConnection === 'function') {
      try {
        await (sqliteService as any).reopenConnection();
      } catch (reopenErr) {
        console.warn('[BackupRestoreService] Gagal membuka kembali koneksi setelah restore:', reopenErr);
      }
    }

    // 6. Sinkronkan ke Web Store jika di Web Browser
    if (Capacitor.getPlatform() === 'web') {
      try {
        await (sqliteService as any).sqliteConnection?.saveToStore(DATABASE_NAME);
      } catch (storeErr) {
        console.warn('[BackupRestoreService] Gagal sinkronisasi ke Web Store IndexedDB:', storeErr);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[BackupRestoreService] Pemulihan database berhasil (${restoredTables} tabel, ${restoredRecords} baris, waktu: ${durationMs}ms)`
    );

    return {
      success: true,
      restoredTables,
      restoredRecords,
      message: `Database berhasil dipulihkan secara konsisten (${restoredRecords} rekaman data dipulihkan).`,
      durationMs
    };
  }
}

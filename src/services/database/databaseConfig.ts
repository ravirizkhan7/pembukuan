import type { capSQLiteVersionUpgrade } from '@capacitor-community/sqlite';
import { MIGRATIONS } from './migrations';

/**
 * Konfigurasi Database SQLite
 * Nama database: 'akrual_spbu'
 * Versi: 6 (Phase 13 — Koreksi Transaksi Berbasis Akuntansi & Reversal Audit Trail)
 */
export const DATABASE_NAME = 'akrual_spbu';
export const DATABASE_VERSION = 6;

/**
 * Migration & Schema Definitions untuk Plugin Capacitor SQLite
 * Dihasilkan secara terpusat dari modul migrations.ts
 */
export const DATABASE_MIGRATIONS: capSQLiteVersionUpgrade[] = MIGRATIONS.map((m) => ({
  toVersion: m.version,
  statements: m.statements
}));

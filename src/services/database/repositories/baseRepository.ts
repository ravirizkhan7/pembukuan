/**
 * BASE REPOSITORY
 * 
 * Fondasi kelas untuk seluruh Repository data layer SQLite.
 * Menyediakan integrasi executor terparameterisasi, penanganan error relasional,
 * dan timestamp standar aplikasi.
 */

import { sqliteService } from '../sqliteService';
import type { SqlExecutor } from '../migrationRunner';

export abstract class BaseRepository {
  protected executor: SqlExecutor;

  constructor(executor: SqlExecutor = sqliteService) {
    this.executor = executor;
  }

  /**
   * Mengembalikan waktu saat ini dalam format ISO 8601
   */
  protected now(): string {
    return new Date().toISOString();
  }

  /**
   * Mengidentifikasi dan membungkus error database menjadi error yang informatif
   */
  protected handleDbError(err: any, contextMessage: string): never {
    const msg = err?.message || String(err);
    if (msg.includes('FOREIGN KEY constraint failed')) {
      throw new Error(
        `${contextMessage}: Operasi ditolak karena data masih terhubung dengan relasi lain (Foreign Key constraint failed).`
      );
    }
    if (msg.includes('UNIQUE constraint failed')) {
      throw new Error(
        `${contextMessage}: Operasi ditolak karena data duplikat (Unique constraint failed: ${msg}).`
      );
    }
    if (msg.includes('CHECK constraint failed')) {
      throw new Error(
        `${contextMessage}: Operasi ditolak karena melanggar aturan validasi data (Check constraint failed: ${msg}).`
      );
    }
    throw new Error(`${contextMessage}: ${msg}`);
  }
}

import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { TransactionCorrection } from '../../../types';

/**
 * REPOSITORY: AUDIT TRAIL KOREKSI TRANSAKSI (transaction_corrections)
 * Menyediakan akses data terstruktur untuk riwayat pembalikan dan koreksi transaksi.
 */
export class TransactionCorrectionRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): TransactionCorrection {
    return {
      id: row.id,
      originalTransactionId: row.original_transaction_id,
      reversalJournalId: row.reversal_journal_id,
      replacementTransactionId: row.replacement_transaction_id || undefined,
      reason: row.reason,
      correctedBy: row.corrected_by || undefined,
      createdAt: row.created_at
    };
  }

  /**
   * Mengambil semua riwayat koreksi
   */
  public async findAll(): Promise<TransactionCorrection[]> {
    try {
      const rows = await this.executor.query<any>(
        `SELECT id, original_transaction_id, reversal_journal_id, replacement_transaction_id,
                reason, corrected_by, created_at
         FROM transaction_corrections
         ORDER BY created_at DESC;`
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil riwayat koreksi transaksi');
    }
  }

  /**
   * Mengambil koreksi berdasarkan ID
   */
  public async findById(id: string): Promise<TransactionCorrection | null> {
    try {
      const rows = await this.executor.query<any>(
        `SELECT id, original_transaction_id, reversal_journal_id, replacement_transaction_id,
                reason, corrected_by, created_at
         FROM transaction_corrections
         WHERE id = ?
         LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil riwayat koreksi ID: ${id}`);
    }
  }

  /**
   * Mengambil koreksi berdasarkan ID transaksi asal
   */
  public async findByOriginalTransactionId(originalTxId: string): Promise<TransactionCorrection | null> {
    try {
      const rows = await this.executor.query<any>(
        `SELECT id, original_transaction_id, reversal_journal_id, replacement_transaction_id,
                reason, corrected_by, created_at
         FROM transaction_corrections
         WHERE original_transaction_id = ?
         LIMIT 1;`,
        [originalTxId]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari riwayat koreksi untuk transaksi asal: ${originalTxId}`);
    }
  }

  /**
   * Mengambil koreksi berdasarkan ID transaksi pengganti
   */
  public async findByReplacementTransactionId(replacementTxId: string): Promise<TransactionCorrection | null> {
    try {
      const rows = await this.executor.query<any>(
        `SELECT id, original_transaction_id, reversal_journal_id, replacement_transaction_id,
                reason, corrected_by, created_at
         FROM transaction_corrections
         WHERE replacement_transaction_id = ?
         LIMIT 1;`,
        [replacementTxId]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari riwayat koreksi untuk transaksi pengganti: ${replacementTxId}`);
    }
  }

  /**
   * Menyimpan entri audit trail koreksi transaksi baru
   */
  public async create(data: TransactionCorrection): Promise<TransactionCorrection> {
    const timestamp = data.createdAt || this.now();
    try {
      await this.executor.run(
        `INSERT INTO transaction_corrections (
           id, original_transaction_id, reversal_journal_id, replacement_transaction_id,
           reason, corrected_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.originalTransactionId,
          data.reversalJournalId,
          data.replacementTransactionId || null,
          data.reason,
          data.correctedBy || null,
          timestamp
        ]
      );

      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Data audit koreksi ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal menyimpan audit koreksi transaksi [${data.id}]`);
    }
  }
}

export const transactionCorrectionRepository = new TransactionCorrectionRepository();

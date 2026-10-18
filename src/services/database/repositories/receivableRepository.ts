import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Receivable } from '../../../types';

/**
 * REPOSITORY: BUKU PEMBANTU PIUTANG USAHA (receivables)
 * Menyediakan akses data terstruktur untuk piutang pelanggan SPBU.
 */
export class ReceivableRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Receivable {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      partnerId: row.partner_id,
      partnerName: row.partner_name || 'Pelanggan',
      amount: Number(row.amount),
      outstanding: Number(row.outstanding),
      status: row.status as Receivable['status'],
      date: row.date,
      notes: row.notes || undefined
    };
  }

  private get baseSelectQuery(): string {
    return `SELECT
              r.id, r.transaction_id, r.partner_id, bp.name AS partner_name,
              r.amount, r.outstanding, r.status, r.date, r.notes,
              r.created_at, r.updated_at
            FROM receivables r
            LEFT JOIN business_partners bp ON r.partner_id = bp.id`;
  }

  /**
   * Mengambil seluruh daftar piutang
   */
  public async findAll(options?: { status?: Receivable['status'] }): Promise<Receivable[]> {
    try {
      let sql = this.baseSelectQuery;
      const params: any[] = [];

      if (options?.status) {
        sql += ' WHERE r.status = ?';
        params.push(options.status);
      }
      sql += ' ORDER BY r.created_at DESC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar piutang');
    }
  }

  /**
   * Mengambil piutang berdasarkan ID
   */
  public async findById(id: string): Promise<Receivable | null> {
    try {
      const sql = `${this.baseSelectQuery} WHERE r.id = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [id]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil piutang dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil piutang berdasarkan transactionId
   */
  public async findByTransactionId(transactionId: string): Promise<Receivable | null> {
    try {
      const sql = `${this.baseSelectQuery} WHERE r.transaction_id = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [transactionId]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari piutang untuk transaksi: ${transactionId}`);
    }
  }

  /**
   * Menambahkan piutang baru ke SQLite
   */
  public async create(data: Receivable): Promise<Receivable> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO receivables (
           id, transaction_id, partner_id, amount, outstanding,
           status, date, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.transactionId,
          data.partnerId,
          data.amount,
          data.outstanding,
          data.status || 'Open',
          data.date,
          data.notes || null,
          timestamp,
          timestamp
        ]
      );

      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Piutang dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal menyimpan piutang [${data.id}]`);
    }
  }

  /**
   * Memperbarui sisa tagihan (outstanding) dan status piutang (misal saat pelunasan)
   */
  public async updateOutstanding(
    id: string,
    newOutstanding: number,
    status: Receivable['status']
  ): Promise<Receivable> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Piutang dengan ID ${id} tidak ditemukan`);
    }

    const timestamp = this.now();
    try {
      await this.executor.run(
        `UPDATE receivables SET
           outstanding = ?,
           status = ?,
           updated_at = ?
         WHERE id = ?;`,
        [newOutstanding, status, timestamp, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Piutang dengan ID ${id} tidak ditemukan setelah diperbarui`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui sisa piutang [${id}]`);
    }
  }

  /**
   * Membatalkan faktur piutang yang belum pernah dicicil (outstanding === amount)
   */
  public async cancel(id: string): Promise<Receivable> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Piutang dengan ID ${id} tidak ditemukan`);
    }
    if (existing.outstanding < existing.amount) {
      throw new Error('Faktur piutang yang sudah memiliki pembayaran tidak boleh dibatalkan.');
    }
    const timestamp = this.now();
    try {
      await this.executor.run(
        `UPDATE receivables SET
           status = 'Batal',
           outstanding = 0,
           updated_at = ?
         WHERE id = ?;`,
        [timestamp, id]
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Piutang dengan ID ${id} tidak ditemukan setelah dibatalkan`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal membatalkan piutang [${id}]`);
    }
  }
}

export const receivableRepository = new ReceivableRepository();

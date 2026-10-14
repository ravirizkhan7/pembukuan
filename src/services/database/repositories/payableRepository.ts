import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Payable } from '../../../types';

/**
 * REPOSITORY: BUKU PEMBANTU HUTANG USAHA (payables)
 * Menyediakan akses data terstruktur untuk kewajiban/hutang supplier SPBU.
 */
export class PayableRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Payable {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      partnerId: row.partner_id,
      partnerName: row.partner_name || 'Vendor',
      amount: Number(row.amount),
      outstanding: Number(row.outstanding),
      status: row.status as Payable['status'],
      date: row.date,
      notes: row.notes || undefined
    };
  }

  private get baseSelectQuery(): string {
    return `SELECT
              p.id, p.transaction_id, p.partner_id, bp.name AS partner_name,
              p.amount, p.outstanding, p.status, p.date, p.notes,
              p.created_at, p.updated_at
            FROM payables p
            LEFT JOIN business_partners bp ON p.partner_id = bp.id`;
  }

  /**
   * Mengambil seluruh daftar hutang
   */
  public async findAll(options?: { status?: Payable['status'] }): Promise<Payable[]> {
    try {
      let sql = this.baseSelectQuery;
      const params: any[] = [];

      if (options?.status) {
        sql += ' WHERE p.status = ?';
        params.push(options.status);
      }
      sql += ' ORDER BY p.created_at DESC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar hutang');
    }
  }

  /**
   * Mengambil hutang berdasarkan ID
   */
  public async findById(id: string): Promise<Payable | null> {
    try {
      const sql = `${this.baseSelectQuery} WHERE p.id = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [id]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil hutang dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil hutang berdasarkan transactionId
   */
  public async findByTransactionId(transactionId: string): Promise<Payable | null> {
    try {
      const sql = `${this.baseSelectQuery} WHERE p.transaction_id = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [transactionId]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari hutang untuk transaksi: ${transactionId}`);
    }
  }

  /**
   * Menambahkan hutang baru ke SQLite
   */
  public async create(data: Payable): Promise<Payable> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO payables (
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
        throw new Error(`Hutang dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal menyimpan hutang [${data.id}]`);
    }
  }

  /**
   * Memperbarui sisa kewajiban (outstanding) dan status hutang (misal saat pembayaran)
   */
  public async updateOutstanding(
    id: string,
    newOutstanding: number,
    status: Payable['status']
  ): Promise<Payable> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Hutang dengan ID ${id} tidak ditemukan`);
    }

    const timestamp = this.now();
    try {
      await this.executor.run(
        `UPDATE payables SET
           outstanding = ?,
           status = ?,
           updated_at = ?
         WHERE id = ?;`,
        [newOutstanding, status, timestamp, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Hutang dengan ID ${id} tidak ditemukan setelah diperbarui`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui sisa hutang [${id}]`);
    }
  }
}

export const payableRepository = new PayableRepository();

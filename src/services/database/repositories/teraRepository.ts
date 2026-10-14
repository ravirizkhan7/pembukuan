import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Tera } from '../../../types';

/**
 * REPOSITORY: TERA DISPENSER (tera)
 * Menyediakan akses data terstruktur untuk pencatatan tera nozzle BBM.
 */
export class TeraRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Tera {
    return {
      id: row.id,
      date: row.date,
      shiftId: row.shift_id || undefined,
      shift: row.shift_name || '',
      nozzleId: row.nozzle_id,
      nozzleCode: row.nozzle_code || '',
      productId: row.product_id || undefined,
      productName: row.product_name || '',
      price: Number(row.price || 0),
      teraAwal: Number(row.tera_awal || 0),
      teraAkhir: Number(row.tera_akhir || 0),
      volume: Number(row.volume || 0),
      selisih: Number(row.selisih || 0),
      salesAmount: Number(row.sales_amount || 0),
      officer: row.officer || '',
      status: row.status || 'Valid',
      transactionId: row.transaction_id || undefined
    };
  }

  private get baseSelectQuery(): string {
    return `SELECT
              tr.id, tr.date, tr.shift_id, s.name AS shift_name,
              tr.nozzle_id, n.code AS nozzle_code,
              tr.product_id, p.name AS product_name,
              tr.price, tr.tera_awal, tr.tera_akhir, tr.volume,
              tr.selisih, tr.sales_amount, tr.officer, tr.status,
              tr.transaction_id, tr.created_at, tr.updated_at
            FROM tera tr
            LEFT JOIN nozzles n ON tr.nozzle_id = n.id
            LEFT JOIN products p ON tr.product_id = p.id
            LEFT JOIN shifts s ON tr.shift_id = s.id`;
  }

  /**
   * Mengambil seluruh data tera terurut dari yang terbaru
   */
  public async findAll(options?: { shiftId?: string; date?: string }): Promise<Tera[]> {
    try {
      let sql = this.baseSelectQuery;
      const conditions: string[] = [];
      const params: any[] = [];

      if (options?.shiftId) {
        conditions.push('tr.shift_id = ?');
        params.push(options.shiftId);
      }
      if (options?.date) {
        conditions.push('substr(tr.date, 1, 10) = ?');
        params.push(options.date);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
      sql += ' ORDER BY tr.created_at DESC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar tera');
    }
  }

  /**
   * Mengambil data tera berdasarkan ID
   */
  public async findById(id: string): Promise<Tera | null> {
    try {
      const sql = `${this.baseSelectQuery} WHERE tr.id = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [id]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil data tera dengan ID: ${id}`);
    }
  }

  /**
   * Menambahkan pencatatan tera baru ke SQLite
   */
  public async create(data: Tera): Promise<Tera> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO tera (
           id, date, shift_id, nozzle_id, product_id,
           price, tera_awal, tera_akhir, volume, selisih,
           sales_amount, officer, status, transaction_id,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.date,
          data.shiftId || null,
          data.nozzleId,
          data.productId || null,
          data.price,
          data.teraAwal,
          data.teraAkhir,
          data.volume,
          data.selisih ?? 0,
          data.salesAmount,
          data.officer,
          data.status || 'Valid',
          data.transactionId || null,
          timestamp,
          timestamp
        ]
      );

      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Data tera dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal menyimpan data tera [${data.id}]`);
    }
  }
}

export const teraRepository = new TeraRepository();

import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { MasterCode, PaymentMethod } from '../../../types';

/**
 * REPOSITORY: MASTER KODE TRANSAKSI (master_codes)
 * Menyediakan akses data terstruktur untuk konfigurasi kode transaksi akrual SPBU.
 */
export class MasterCodeRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): MasterCode {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category as MasterCode['category'],
      type: row.type,
      requiresTera: row.requires_tera === 1,
      productId: row.product_id ?? undefined,
      product: row.product_name ?? undefined,
      unitPrice:
        row.unit_price !== null && row.unit_price !== undefined
          ? Number(row.unit_price)
          : undefined,
      debitAccountId: row.debit_account_id,
      debitAccountName: row.debit_account_name ?? '',
      creditAccountId: row.credit_account_id,
      creditAccountName: row.credit_account_name ?? '',
      description: row.description ?? '',
      paymentMethod: row.payment_method as PaymentMethod,
      isActive: row.is_active === 1
    };
  }

  private getBaseSelectQuery(): string {
    return `
      SELECT mc.id, mc.code, mc.name, mc.category, mc.type, mc.requires_tera,
             mc.product_id, mc.unit_price, mc.debit_account_id, mc.credit_account_id,
             mc.description, mc.payment_method, mc.is_active,
             da.name AS debit_account_name,
             ca.name AS credit_account_name,
             p.name AS product_name
      FROM master_codes mc
      LEFT JOIN accounts da ON mc.debit_account_id = da.id
      LEFT JOIN accounts ca ON mc.credit_account_id = ca.id
      LEFT JOIN products p ON mc.product_id = p.id
    `;
  }

  /**
   * Mengambil semua master kode transaksi terurut berdasarkan kode numerik/alfanumerik
   */
  public async findAll(options?: { activeOnly?: boolean }): Promise<MasterCode[]> {
    try {
      let sql = this.getBaseSelectQuery();
      const params: any[] = [];

      if (options?.activeOnly) {
        sql += ' WHERE mc.is_active = 1';
      }
      sql += ' ORDER BY mc.code ASC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar master kode');
    }
  }

  /**
   * Mengambil master kode berdasarkan ID
   */
  public async findById(id: string): Promise<MasterCode | null> {
    try {
      const sql = `${this.getBaseSelectQuery()} WHERE mc.id = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [id]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil master kode dengan ID: ${id}`);
    }
  }

  /**
   * Mencari master kode berdasarkan kode string (misal: "303", "308")
   */
  public async findByCode(code: string): Promise<MasterCode | null> {
    try {
      const sql = `${this.getBaseSelectQuery()} WHERE mc.code = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [code]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari master kode: ${code}`);
    }
  }

  /**
   * Mengambil daftar master kode berdasarkan kategori
   */
  public async findByCategory(
    category: MasterCode['category'],
    options?: { activeOnly?: boolean }
  ): Promise<MasterCode[]> {
    try {
      let sql = `${this.getBaseSelectQuery()} WHERE mc.category = ?`;
      const params: any[] = [category];

      if (options?.activeOnly) {
        sql += ' AND mc.is_active = 1';
      }
      sql += ' ORDER BY mc.code ASC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil master kode untuk kategori: ${category}`);
    }
  }

  /**
   * Menambahkan master kode baru
   */
  public async create(data: MasterCode): Promise<MasterCode> {
    const timestamp = this.now();
    const isActive = data.isActive ? 1 : 0;
    const requiresTera = data.requiresTera ? 1 : 0;
    try {
      await this.executor.run(
        `INSERT INTO master_codes (
           id, code, name, category, type, requires_tera,
           product_id, unit_price, debit_account_id, credit_account_id,
           description, payment_method, is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.code,
          data.name,
          data.category,
          data.type,
          requiresTera,
          data.productId ?? null,
          data.unitPrice ?? null,
          data.debitAccountId,
          data.creditAccountId,
          data.description ?? null,
          data.paymentMethod,
          isActive,
          timestamp,
          timestamp
        ]
      );
      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Master kode dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuat master kode: ${data.name} (${data.code})`);
    }
  }

  /**
   * Memperbarui master kode dengan input yang di-whitelist
   */
  public async update(
    id: string,
    data: Partial<
      Omit<MasterCode, 'id' | 'debitAccountName' | 'creditAccountName' | 'product'>
    >
  ): Promise<MasterCode> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Master kode dengan ID ${id} tidak ditemukan`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.code !== undefined) {
      updates.push('code = ?');
      params.push(data.code);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(data.type);
    }
    if (data.requiresTera !== undefined) {
      updates.push('requires_tera = ?');
      params.push(data.requiresTera ? 1 : 0);
    }
    if (data.productId !== undefined) {
      updates.push('product_id = ?');
      params.push(data.productId ?? null);
    }
    if (data.unitPrice !== undefined) {
      updates.push('unit_price = ?');
      params.push(data.unitPrice ?? null);
    }
    if (data.debitAccountId !== undefined) {
      updates.push('debit_account_id = ?');
      params.push(data.debitAccountId);
    }
    if (data.creditAccountId !== undefined) {
      updates.push('credit_account_id = ?');
      params.push(data.creditAccountId);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description ?? null);
    }
    if (data.paymentMethod !== undefined) {
      updates.push('payment_method = ?');
      params.push(data.paymentMethod);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(this.now());
    params.push(id);

    try {
      await this.executor.run(
        `UPDATE master_codes SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Master kode dengan ID ${id} tidak ditemukan setelah update`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui master kode dengan ID: ${id}`);
    }
  }

  /**
   * Menghapus master kode secara aman (menghormati constraint relasional)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM master_codes WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus master kode dengan ID: ${id}`);
    }
  }
}

export const masterCodeRepository = new MasterCodeRepository();

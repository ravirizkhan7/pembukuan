import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Product } from '../../../types';

/**
 * REPOSITORY: PRODUK (products)
 * Menyediakan akses data terstruktur untuk master data produk BBM dan non-BBM.
 */
export class ProductRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Product {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      categoryId: row.category_id,
      sellPrice: Number(row.sell_price),
      buyPrice: Number(row.buy_price),
      unit: row.unit,
      color: row.color ?? undefined,
      status: row.status as 'Aktif' | 'Nonaktif',
      tankId: row.tank_id ?? undefined
    };
  }

  /**
   * Mengambil semua produk terurut berdasarkan kode
   */
  public async findAll(): Promise<Product[]> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, category_id, sell_price, buy_price, unit, color, status, tank_id
         FROM products
         ORDER BY code ASC;`
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar produk');
    }
  }

  /**
   * Mengambil produk berdasarkan ID
   */
  public async findById(id: string): Promise<Product | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, category_id, sell_price, buy_price, unit, color, status, tank_id
         FROM products
         WHERE id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil produk dengan ID: ${id}`);
    }
  }

  /**
   * Mencari produk berdasarkan kode produk (misal: "PLT", "PTX")
   */
  public async findByCode(code: string): Promise<Product | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, category_id, sell_price, buy_price, unit, color, status, tank_id
         FROM products
         WHERE code = ? LIMIT 1;`,
        [code]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari produk dengan kode: ${code}`);
    }
  }

  /**
   * Mengambil daftar produk berdasarkan kategori
   */
  public async findByCategory(categoryId: string): Promise<Product[]> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, category_id, sell_price, buy_price, unit, color, status, tank_id
         FROM products
         WHERE category_id = ?
         ORDER BY code ASC;`,
        [categoryId]
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil produk untuk kategori: ${categoryId}`);
    }
  }

  /**
   * Menambahkan produk baru
   */
  public async create(data: Product): Promise<Product> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO products (
           id, code, name, category_id, sell_price, buy_price,
           unit, color, status, tank_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.code,
          data.name,
          data.categoryId,
          data.sellPrice,
          data.buyPrice,
          data.unit,
          data.color ?? null,
          data.status,
          data.tankId ?? null,
          timestamp,
          timestamp
        ]
      );
      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Produk dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuat produk: ${data.name}`);
    }
  }

  /**
   * Memperbarui produk dengan input yang di-whitelist
   */
  public async update(
    id: string,
    data: Partial<Omit<Product, 'id'>>
  ): Promise<Product> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Produk dengan ID ${id} tidak ditemukan`);
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
    if (data.categoryId !== undefined) {
      updates.push('category_id = ?');
      params.push(data.categoryId);
    }
    if (data.sellPrice !== undefined) {
      updates.push('sell_price = ?');
      params.push(data.sellPrice);
    }
    if (data.buyPrice !== undefined) {
      updates.push('buy_price = ?');
      params.push(data.buyPrice);
    }
    if (data.unit !== undefined) {
      updates.push('unit = ?');
      params.push(data.unit);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color ?? null);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.tankId !== undefined) {
      updates.push('tank_id = ?');
      params.push(data.tankId ?? null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(this.now());
    params.push(id);

    try {
      await this.executor.run(
        `UPDATE products SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Produk dengan ID ${id} tidak ditemukan setelah update`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui produk dengan ID: ${id}`);
    }
  }

  /**
   * Menghapus produk secara aman (menghormati constraint relasional)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM products WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus produk dengan ID: ${id}`);
    }
  }
}

export const productRepository = new ProductRepository();

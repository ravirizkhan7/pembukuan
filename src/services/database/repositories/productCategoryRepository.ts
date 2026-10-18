import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { ProductCategory } from '../../../types';

/**
 * REPOSITORY: KATEGORI PRODUK (product_categories)
 * Menyediakan akses data terstruktur untuk master data kategori produk.
 */
export class ProductCategoryRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): ProductCategory {
    return {
      id: row.id,
      name: row.name,
      status: row.status as 'Aktif' | 'Nonaktif'
    };
  }

  /**
   * Mengambil semua kategori produk terurut berdasarkan ID
   */
  public async findAll(): Promise<ProductCategory[]> {
    try {
      const rows = await this.executor.query(
        'SELECT id, name, status FROM product_categories ORDER BY id ASC;'
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar kategori produk');
    }
  }

  /**
   * Mengambil kategori produk berdasarkan ID
   */
  public async findById(id: string): Promise<ProductCategory | null> {
    try {
      const rows = await this.executor.query(
        'SELECT id, name, status FROM product_categories WHERE id = ? LIMIT 1;',
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil kategori produk dengan ID: ${id}`);
    }
  }

  /**
   * Mencari kategori produk berdasarkan nama
   */
  public async findByName(name: string): Promise<ProductCategory | null> {
    try {
      const rows = await this.executor.query(
        'SELECT id, name, status FROM product_categories WHERE name = ? LIMIT 1;',
        [name]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari kategori produk dengan nama: ${name}`);
    }
  }

  /**
   * Menambahkan kategori produk baru
   */
  public async create(data: Partial<ProductCategory> & { name: string }): Promise<ProductCategory> {
    const timestamp = this.now();
    const id = data.id || `PCAT-${Date.now()}`;
    const status = data.status || 'Aktif';
    try {
      await this.executor.run(
        `INSERT INTO product_categories (id, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?);`,
        [id, data.name, status, timestamp, timestamp]
      );
      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Kategori produk dengan ID ${id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuat kategori produk: ${data.name}`);
    }
  }

  /**
   * Memperbarui kategori produk dengan input yang di-whitelist
   */
  public async update(
    id: string,
    data: Partial<Omit<ProductCategory, 'id'>>
  ): Promise<ProductCategory> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Kategori produk dengan ID ${id} tidak ditemukan`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(this.now());
    params.push(id);

    try {
      await this.executor.run(
        `UPDATE product_categories SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Kategori produk dengan ID ${id} tidak ditemukan setelah update`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui kategori produk dengan ID: ${id}`);
    }
  }

  /**
   * Memeriksa apakah kategori produk masih memiliki produk yang mengacu padanya
   */
  public async isReferenced(id: string): Promise<boolean> {
    try {
      const rows = await this.executor.query<any>(
        'SELECT COUNT(*) AS total_refs FROM products WHERE category_id = ?;',
        [id]
      );
      if (rows.length === 0) return false;
      return Number(rows[0].total_refs || 0) > 0;
    } catch (err) {
      console.warn('[ProductCategoryRepository] Gagal mengecek referensi kategori:', err);
      return false;
    }
  }

  /**
   * Kategori produk standar sistem SPBU yang tidak boleh dihapus
   */
  public static readonly CORE_CATEGORY_IDS = new Set([
    'PCAT-001', 'PCAT-002', 'PCAT-003', 'PCAT-004'
  ]);

  /**
   * Memeriksa apakah kategori merupakan kategori standar sistem SPBU
   */
  public isCore(id: string): boolean {
    return ProductCategoryRepository.CORE_CATEGORY_IDS.has(id);
  }

  /**
   * Menghapus kategori produk secara aman (menghormati data inti dan constraint relasional)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    // 1. Lindungi kategori produk standar sistem SPBU
    if (this.isCore(existing.id)) {
      throw new Error(
        `Kategori produk [${existing.name}] merupakan kategori bawaan sistem SPBU dan tidak dapat dihapus. Silakan gunakan opsi Nonaktifkan.`
      );
    }

    // 2. Lindungi kategori yang masih digunakan oleh produk
    const isRef = await this.isReferenced(id);
    if (isRef) {
      throw new Error(
        `Kategori [${existing.name}] tidak dapat dihapus karena masih digunakan oleh produk. Pindahkan atau hapus produk di dalamnya terlebih dahulu.`
      );
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM product_categories WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus kategori produk dengan ID: ${id}`);
    }
  }
}

export const productCategoryRepository = new ProductCategoryRepository();
export const CORE_CATEGORY_IDS = ProductCategoryRepository.CORE_CATEGORY_IDS;

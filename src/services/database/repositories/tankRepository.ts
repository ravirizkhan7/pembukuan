import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Tank } from '../../../types';

/**
 * REPOSITORY: TANKI PENDAM (tanks)
 * Menyediakan akses data terstruktur untuk master data tanki pendam BBM.
 */
export class TankRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Tank {
    return {
      id: row.id,
      name: row.name,
      productId: row.product_id,
      productName: row.product_name ?? undefined,
      capacity: Number(row.capacity),
      currentStock: Number(row.current_stock),
      unit: row.unit,
      lastSounding: row.last_sounding ?? '',
      status: row.status as 'Aktif' | 'Nonaktif' | 'Aman' | 'Perlu Reorder'
    };
  }

  /**
   * Mengambil semua tanki terurut berdasarkan ID, dilengkapi dengan nama produk
   */
  public async findAll(): Promise<Tank[]> {
    try {
      const rows = await this.executor.query(
        `SELECT t.id, t.name, t.product_id, t.capacity, t.current_stock,
                t.unit, t.last_sounding, t.status,
                p.name AS product_name
         FROM tanks t
         LEFT JOIN products p ON t.product_id = p.id
         ORDER BY t.id ASC;`
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar tanki');
    }
  }

  /**
   * Mengambil tanki berdasarkan ID
   */
  public async findById(id: string): Promise<Tank | null> {
    try {
      const rows = await this.executor.query(
        `SELECT t.id, t.name, t.product_id, t.capacity, t.current_stock,
                t.unit, t.last_sounding, t.status,
                p.name AS product_name
         FROM tanks t
         LEFT JOIN products p ON t.product_id = p.id
         WHERE t.id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil tanki dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil tanki berdasarkan produk
   */
  public async findByProductId(productId: string): Promise<Tank[]> {
    try {
      const rows = await this.executor.query(
        `SELECT t.id, t.name, t.product_id, t.capacity, t.current_stock,
                t.unit, t.last_sounding, t.status,
                p.name AS product_name
         FROM tanks t
         LEFT JOIN products p ON t.product_id = p.id
         WHERE t.product_id = ?
         ORDER BY t.id ASC;`,
        [productId]
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil tanki untuk produk: ${productId}`);
    }
  }

  /**
   * Menambahkan tanki baru
   */
  public async create(data: Tank): Promise<Tank> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO tanks (
           id, name, product_id, capacity, current_stock,
           unit, last_sounding, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.name,
          data.productId,
          data.capacity,
          data.currentStock ?? 0,
          data.unit || 'Liter',
          data.lastSounding ?? null,
          data.status || 'Aktif',
          timestamp,
          timestamp
        ]
      );
      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Tanki dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuat tanki: ${data.name}`);
    }
  }

  /**
   * Memperbarui tanki dengan input yang di-whitelist
   */
  public async update(
    id: string,
    data: Partial<Omit<Tank, 'id' | 'productName'>>
  ): Promise<Tank> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Tanki dengan ID ${id} tidak ditemukan`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.productId !== undefined) {
      updates.push('product_id = ?');
      params.push(data.productId);
    }
    if (data.capacity !== undefined) {
      updates.push('capacity = ?');
      params.push(data.capacity);
    }
    if (data.currentStock !== undefined) {
      updates.push('current_stock = ?');
      params.push(data.currentStock);
    }
    if (data.unit !== undefined) {
      updates.push('unit = ?');
      params.push(data.unit);
    }
    if (data.lastSounding !== undefined) {
      updates.push('last_sounding = ?');
      params.push(data.lastSounding ?? null);
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
        `UPDATE tanks SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Tanki dengan ID ${id} tidak ditemukan setelah update`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui tanki dengan ID: ${id}`);
    }
  }

  /**
   * Memeriksa apakah tangki masih memiliki relasi ke nozzle dispenser
   */
  public async isReferenced(id: string): Promise<boolean> {
    try {
      const rows = await this.executor.query<any>(
        'SELECT COUNT(*) AS total_refs FROM nozzles WHERE tank_id = ?;',
        [id]
      );
      if (rows.length === 0) return false;
      return Number(rows[0].total_refs || 0) > 0;
    } catch (err) {
      console.warn('[TankRepository] Gagal mengecek referensi tangki:', err);
      return false;
    }
  }

  /**
   * Menghapus tanki secara aman (menghormati constraint relasional)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    const isRef = await this.isReferenced(id);
    if (isRef) {
      throw new Error(
        `Tangki [${existing.name}] tidak dapat dihapus karena masih terhubung ke nozzle dispenser. Putuskan atau pindahkan nozzle terlebih dahulu.`
      );
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM tanks WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus tanki dengan ID: ${id}`);
    }
  }
}

export const tankRepository = new TankRepository();

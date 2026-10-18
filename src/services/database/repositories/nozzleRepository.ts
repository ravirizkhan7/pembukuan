import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Nozzle } from '../../../types';

/**
 * REPOSITORY: NOZZLE DISPENSER (nozzles)
 * Menyediakan akses data terstruktur untuk master data nozzle pompa dispenser.
 */
export class NozzleRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Nozzle {
    return {
      id: row.id,
      code: row.code,
      island: row.island,
      tankId: row.tank_id,
      productId: row.product_id,
      productName: row.product_name ?? undefined,
      currentMeter: Number(row.current_meter),
      status: row.status as 'Aktif' | 'Maintenance' | 'Nonaktif'
    };
  }

  /**
   * Mengambil semua nozzle terurut berdasarkan kode, dilengkapi nama produk
   */
  public async findAll(): Promise<Nozzle[]> {
    try {
      const rows = await this.executor.query(
        `SELECT n.id, n.code, n.island, n.tank_id, n.product_id, n.current_meter, n.status,
                p.name AS product_name
         FROM nozzles n
         LEFT JOIN products p ON n.product_id = p.id
         ORDER BY n.code ASC;`
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar nozzle');
    }
  }

  /**
   * Mengambil nozzle berdasarkan ID
   */
  public async findById(id: string): Promise<Nozzle | null> {
    try {
      const rows = await this.executor.query(
        `SELECT n.id, n.code, n.island, n.tank_id, n.product_id, n.current_meter, n.status,
                p.name AS product_name
         FROM nozzles n
         LEFT JOIN products p ON n.product_id = p.id
         WHERE n.id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil nozzle dengan ID: ${id}`);
    }
  }

  /**
   * Mencari nozzle berdasarkan kode (misal: "NZ-01")
   */
  public async findByCode(code: string): Promise<Nozzle | null> {
    try {
      const rows = await this.executor.query(
        `SELECT n.id, n.code, n.island, n.tank_id, n.product_id, n.current_meter, n.status,
                p.name AS product_name
         FROM nozzles n
         LEFT JOIN products p ON n.product_id = p.id
         WHERE n.code = ? LIMIT 1;`,
        [code]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari nozzle dengan kode: ${code}`);
    }
  }

  /**
   * Mengambil daftar nozzle yang terhubung ke tanki tertentu
   */
  public async findByTankId(tankId: string): Promise<Nozzle[]> {
    try {
      const rows = await this.executor.query(
        `SELECT n.id, n.code, n.island, n.tank_id, n.product_id, n.current_meter, n.status,
                p.name AS product_name
         FROM nozzles n
         LEFT JOIN products p ON n.product_id = p.id
         WHERE n.tank_id = ?
         ORDER BY n.code ASC;`,
        [tankId]
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil nozzle untuk tanki: ${tankId}`);
    }
  }

  /**
   * Mengambil daftar nozzle berdasarkan pulau pompa (island)
   */
  public async findByIsland(island: string): Promise<Nozzle[]> {
    try {
      const rows = await this.executor.query(
        `SELECT n.id, n.code, n.island, n.tank_id, n.product_id, n.current_meter, n.status,
                p.name AS product_name
         FROM nozzles n
         LEFT JOIN products p ON n.product_id = p.id
         WHERE n.island = ?
         ORDER BY n.code ASC;`,
        [island]
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil nozzle untuk pulau: ${island}`);
    }
  }

  /**
   * Menambahkan nozzle baru
   */
  public async create(data: Nozzle): Promise<Nozzle> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO nozzles (
           id, code, island, tank_id, product_id, current_meter,
           status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.code,
          data.island,
          data.tankId,
          data.productId,
          data.currentMeter ?? 0,
          data.status || 'Aktif',
          timestamp,
          timestamp
        ]
      );
      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Nozzle dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuat nozzle: ${data.code}`);
    }
  }

  /**
   * Memperbarui nozzle dengan input yang di-whitelist
   */
  public async update(
    id: string,
    data: Partial<Omit<Nozzle, 'id' | 'productName'>>
  ): Promise<Nozzle> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Nozzle dengan ID ${id} tidak ditemukan`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.code !== undefined) {
      updates.push('code = ?');
      params.push(data.code);
    }
    if (data.island !== undefined) {
      updates.push('island = ?');
      params.push(data.island);
    }
    if (data.tankId !== undefined) {
      updates.push('tank_id = ?');
      params.push(data.tankId);
    }
    if (data.productId !== undefined) {
      updates.push('product_id = ?');
      params.push(data.productId);
    }
    if (data.currentMeter !== undefined) {
      updates.push('current_meter = ?');
      params.push(data.currentMeter);
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
        `UPDATE nozzles SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Nozzle dengan ID ${id} tidak ditemukan setelah update`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui nozzle dengan ID: ${id}`);
    }
  }

  /**
   * Memeriksa apakah nozzle memiliki relasi ke riwayat tera atau transaksi
   */
  public async isReferenced(id: string): Promise<boolean> {
    try {
      const rows = await this.executor.query<any>(
        `SELECT
           ((SELECT COUNT(*) FROM tera WHERE nozzle_id = ?) +
            (SELECT COUNT(*) FROM transactions WHERE nozzle_id = ?)) AS total_refs;`,
        [id, id]
      );
      if (rows.length === 0) return false;
      return Number(rows[0].total_refs || 0) > 0;
    } catch (err) {
      console.warn('[NozzleRepository] Gagal mengecek referensi nozzle:', err);
      return false;
    }
  }

  /**
   * Nozzle dispenser baku sistem SPBU yang tidak boleh dihapus
   */
  public static readonly CORE_NOZZLE_IDS = new Set([
    'NZL-01', 'NZL-02', 'NZL-03', 'NZL-04', 'NZL-05', 'NZL-06', 'NZL-07', 'NZL-08',
    'NZ-01', 'NZ-02', 'NZ-03', 'NZ-04', 'NZ-05', 'NZ-06', 'NZ-07', 'NZ-08'
  ]);

  /**
   * Memeriksa apakah nozzle merupakan konfigurasi dispenser baku SPBU
   */
  public isCore(idOrCode: string): boolean {
    return NozzleRepository.CORE_NOZZLE_IDS.has(idOrCode);
  }

  /**
   * Menghapus nozzle secara aman (menghormati data inti dan constraint relasional)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    // 1. Lindungi nozzle dispenser baku sistem SPBU
    if (this.isCore(existing.id) || this.isCore(existing.code)) {
      throw new Error(
        `Nozzle dispenser [${existing.code}] merupakan konfigurasi dispenser baku SPBU dan tidak dapat dihapus. Silakan gunakan opsi Nonaktifkan.`
      );
    }

    // 2. Lindungi nozzle yang sudah memiliki riwayat kalibrasi tera atau transaksi
    const isRef = await this.isReferenced(id);
    if (isRef) {
      throw new Error(
        `Nozzle [${existing.code}] tidak dapat dihapus karena sudah memiliki riwayat kalibrasi tera atau transaksi penjualan dispenser. Silakan gunakan opsi Nonaktifkan.`
      );
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM nozzles WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus nozzle dengan ID: ${id}`);
    }
  }
}

export const nozzleRepository = new NozzleRepository();
export const CORE_NOZZLE_IDS = NozzleRepository.CORE_NOZZLE_IDS;

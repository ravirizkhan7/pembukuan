import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { BusinessPartner } from '../../../types';

/**
 * REPOSITORY: MITRA BISNIS (business_partners)
 * Menyediakan akses data terstruktur untuk master data pelanggan (Customer) dan pemasok (Vendor).
 */
export class BusinessPartnerRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): BusinessPartner {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type as 'Customer' | 'Vendor',
      phone: row.phone ?? undefined,
      address: row.address ?? undefined
    };
  }

  /**
   * Mengambil semua mitra bisnis terurut berdasarkan kode
   */
  public async findAll(options?: { activeOnly?: boolean }): Promise<BusinessPartner[]> {
    try {
      let sql = `SELECT id, code, name, type, phone, address, is_active
                 FROM business_partners`;
      const params: any[] = [];

      if (options?.activeOnly) {
        sql += ' WHERE is_active = 1';
      }
      sql += ' ORDER BY code ASC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar mitra bisnis');
    }
  }

  /**
   * Mengambil mitra bisnis berdasarkan ID
   */
  public async findById(id: string): Promise<BusinessPartner | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, type, phone, address, is_active
         FROM business_partners
         WHERE id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil mitra bisnis dengan ID: ${id}`);
    }
  }

  /**
   * Mencari mitra bisnis berdasarkan kode (misal: "CUS-001", "VEN-001")
   */
  public async findByCode(code: string): Promise<BusinessPartner | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, type, phone, address, is_active
         FROM business_partners
         WHERE code = ? LIMIT 1;`,
        [code]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari mitra bisnis dengan kode: ${code}`);
    }
  }

  /**
   * Mengambil daftar mitra bisnis berdasarkan tipe ('Customer' atau 'Vendor')
   */
  public async findByType(
    type: 'Customer' | 'Vendor',
    options?: { activeOnly?: boolean }
  ): Promise<BusinessPartner[]> {
    try {
      let sql = `SELECT id, code, name, type, phone, address, is_active
                 FROM business_partners
                 WHERE type = ?`;
      const params: any[] = [type];

      if (options?.activeOnly) {
        sql += ' AND is_active = 1';
      }
      sql += ' ORDER BY code ASC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil mitra bisnis bertipe: ${type}`);
    }
  }

  /**
   * Menambahkan mitra bisnis baru
   */
  public async create(
    data: BusinessPartner & { isActive?: boolean }
  ): Promise<BusinessPartner> {
    const timestamp = this.now();
    const isActive = data.isActive === undefined ? 1 : data.isActive ? 1 : 0;
    try {
      await this.executor.run(
        `INSERT INTO business_partners (
           id, code, name, type, phone, address, is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.code,
          data.name,
          data.type,
          data.phone ?? null,
          data.address ?? null,
          isActive,
          timestamp,
          timestamp
        ]
      );
      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Mitra bisnis dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuat mitra bisnis: ${data.name}`);
    }
  }

  /**
   * Memperbarui mitra bisnis dengan input yang di-whitelist
   */
  public async update(
    id: string,
    data: Partial<Omit<BusinessPartner, 'id'>> & { isActive?: boolean }
  ): Promise<BusinessPartner> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Mitra bisnis dengan ID ${id} tidak ditemukan`);
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
    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(data.type);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      params.push(data.phone ?? null);
    }
    if (data.address !== undefined) {
      updates.push('address = ?');
      params.push(data.address ?? null);
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
        `UPDATE business_partners SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Mitra bisnis dengan ID ${id} tidak ditemukan setelah update`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui mitra bisnis dengan ID: ${id}`);
    }
  }

  /**
   * Menghapus mitra bisnis secara aman (menghormati constraint relasional)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM business_partners WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus mitra bisnis dengan ID: ${id}`);
    }
  }
}

export const businessPartnerRepository = new BusinessPartnerRepository();

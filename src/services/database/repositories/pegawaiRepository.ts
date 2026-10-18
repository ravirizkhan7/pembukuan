import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Pegawai } from '../../../types';

/**
 * REPOSITORY: PEGAWAI / OPERATOR (pegawai)
 * 
 * Mengelola data master pegawai, staf kasir, dan penugasan shift kerja.
 */
export class PegawaiRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Pegawai {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      status: row.status as 'Aktif' | 'Nonaktif',
      shiftId: row.shift_id
    };
  }

  /**
   * Mengambil semua daftar pegawai
   */
  public async findAll(): Promise<Pegawai[]> {
    try {
      const rows = await this.executor.query(
        `SELECT id, name, role, status, shift_id
         FROM pegawai
         ORDER BY id ASC;`
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar pegawai');
    }
  }

  /**
   * Mengambil pegawai berdasarkan ID
   */
  public async findById(id: string): Promise<Pegawai | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, name, role, status, shift_id
         FROM pegawai
         WHERE id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil pegawai dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil daftar pegawai berdasarkan shift yang ditugaskan
   */
  public async findByShift(shiftId: string): Promise<Pegawai[]> {
    try {
      const rows = await this.executor.query(
        `SELECT id, name, role, status, shift_id
         FROM pegawai
         WHERE shift_id = ?
         ORDER BY id ASC;`,
        [shiftId]
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil pegawai untuk shift: ${shiftId}`);
    }
  }

  /**
   * Menambahkan data pegawai baru
   */
  public async create(pegawai: Pegawai): Promise<Pegawai> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO pegawai (id, name, role, status, shift_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          pegawai.id,
          pegawai.name,
          pegawai.role,
          pegawai.status || 'Aktif',
          pegawai.shiftId,
          timestamp,
          timestamp
        ]
      );
      const created = await this.findById(pegawai.id);
      if (!created) {
        throw new Error(`Data pegawai ${pegawai.id} tidak ditemukan setelah disimpan.`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal menambahkan pegawai ${pegawai.name}`);
    }
  }

  /**
   * Memperbarui data pegawai
   */
  public async update(id: string, data: Partial<Pegawai>): Promise<Pegawai> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      params.push(data.role);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.shiftId !== undefined) {
      updates.push('shift_id = ?');
      params.push(data.shiftId);
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Pegawai dengan ID ${id} tidak ditemukan`);
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(this.now());
    params.push(id);

    try {
      await this.executor.run(
        `UPDATE pegawai SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Data pegawai ${id} tidak ditemukan setelah pembaruan.`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui pegawai dengan ID: ${id}`);
    }
  }

  /**
   * Mengubah status aktif / nonaktif pegawai
   */
  public async toggleStatus(id: string): Promise<Pegawai> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Pegawai dengan ID ${id} tidak ditemukan.`);
    }
    const nextStatus = existing.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    if (nextStatus === 'Nonaktif') {
      const activeShiftRows = await this.executor.query<any>(
        `SELECT COUNT(*) AS total_active FROM shifts WHERE status = 'Aktif' AND (operator = ? OR operator = ?);`,
        [existing.name, existing.id]
      );
      if (Number(activeShiftRows[0]?.total_active || 0) > 0) {
        throw new Error(
          `Pegawai [${existing.name}] tidak dapat dinonaktifkan karena sedang bertugas pada shift aktif.`
        );
      }
    }
    return this.update(id, { status: nextStatus });
  }

  /**
   * Memeriksa apakah pegawai sudah memiliki relasi di riwayat absensi, sesi shift, atau transaksi kasir
   */
  public async isReferenced(id: string): Promise<boolean> {
    try {
      const existing = await this.findById(id);
      const name = existing?.name || '';
      const rows = await this.executor.query<any>(
        `SELECT
           ((SELECT COUNT(*) FROM attendances WHERE employee_id = ? OR employee_id = ?) +
            (SELECT COUNT(*) FROM shifts WHERE operator = ? OR operator = ?) +
            (SELECT COUNT(*) FROM shift_sessions WHERE operator = ? OR operator = ?) +
            (SELECT COUNT(*) FROM transactions WHERE cashier = ? OR cashier = ?)) AS total_refs;`,
        [id, name, id, name, id, name, id, name]
      );
      if (rows.length === 0) return false;
      return Number(rows[0].total_refs || 0) > 0;
    } catch (err) {
      console.warn('[PegawaiRepository] Gagal mengecek referensi pegawai:', err);
      return false;
    }
  }

  /**
   * Menghapus pegawai (memperhatikan constraint relasional riwayat absensi)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    const isRef = await this.isReferenced(id);
    if (isRef) {
      throw new Error(
        `Pegawai [${existing.name}] tidak dapat dihapus karena memiliki riwayat absensi, penugasan shift, atau pencatatan transaksi kasir. Silakan gunakan opsi Nonaktifkan.`
      );
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM pegawai WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus pegawai dengan ID: ${id}`);
    }
  }

  /**
   * Inisialisasi daftar pegawai pengembangan secara idempotent
   */
  public async initRoster(roster: Pegawai[]): Promise<void> {
    const timestamp = this.now();
    for (const p of roster) {
      await this.executor.run(
        `INSERT INTO pegawai (id, name, role, status, shift_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING;`,
        [p.id, p.name, p.role, p.status || 'Aktif', p.shiftId, timestamp, timestamp]
      );
    }
  }
}

export const pegawaiRepository = new PegawaiRepository();

import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Attendance, AttendanceStatus } from '../../../types';

/**
 * REPOSITORY: ABSENSI KEHADIRAN (attendances)
 * 
 * Mengelola pencatatan presensi kehadiran pegawai SPBU via alur QR scanner & manual form.
 * 
 * Aturan Bisnis Wajib:
 * - Satu pegawai hanya boleh memiliki SATU record absensi per tanggal kalender.
 * - Pemindaian atau pencatatan ulang pada hari yang sama ditolak (mencegah duplikasi).
 * - Menghubungkan relasi pegawai dan shift secara integritas referensial.
 */
export class AttendanceRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Attendance {
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name || undefined,
      shiftId: row.shift_id,
      shiftName: row.shift_name || undefined,
      date: row.date,
      status: row.status as AttendanceStatus,
      notes: row.notes || undefined,
      checkInTime: row.check_in_time || undefined
    };
  }

  /**
   * Mengambil semua data absensi terurut dari tanggal & waktu terbaru
   */
  public async findAll(): Promise<Attendance[]> {
    try {
      const rows = await this.executor.query(
        `SELECT a.id, a.employee_id, COALESCE(p.name, a.employee_id) AS employee_name,
                a.shift_id, COALESCE(s.name, a.shift_id) AS shift_name,
                a.date, a.status, a.notes, a.check_in_time
         FROM attendances a
         LEFT JOIN pegawai p ON a.employee_id = p.id
         LEFT JOIN shifts s ON a.shift_id = s.id
         ORDER BY a.date DESC, a.created_at DESC;`
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil riwayat absensi');
    }
  }

  /**
   * Mengambil absensi berdasarkan ID
   */
  public async findById(id: string): Promise<Attendance | null> {
    try {
      const rows = await this.executor.query(
        `SELECT a.id, a.employee_id, COALESCE(p.name, a.employee_id) AS employee_name,
                a.shift_id, COALESCE(s.name, a.shift_id) AS shift_name,
                a.date, a.status, a.notes, a.check_in_time
         FROM attendances a
         LEFT JOIN pegawai p ON a.employee_id = p.id
         LEFT JOIN shifts s ON a.shift_id = s.id
         WHERE a.id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil absensi dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil absensi pegawai pada tanggal kalender tertentu
   */
  public async findByEmployeeAndDate(employeeId: string, date: string): Promise<Attendance | null> {
    try {
      const rows = await this.executor.query(
        `SELECT a.id, a.employee_id, COALESCE(p.name, a.employee_id) AS employee_name,
                a.shift_id, COALESCE(s.name, a.shift_id) AS shift_name,
                a.date, a.status, a.notes, a.check_in_time
         FROM attendances a
         LEFT JOIN pegawai p ON a.employee_id = p.id
         LEFT JOIN shifts s ON a.shift_id = s.id
         WHERE a.employee_id = ? AND a.date = ?
         LIMIT 1;`,
        [employeeId, date]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal memeriksa absensi pegawai ${employeeId} pada tanggal ${date}`);
    }
  }

  /**
   * Mengambil daftar absensi pada tanggal tertentu
   */
  public async findByDate(date: string): Promise<Attendance[]> {
    try {
      const rows = await this.executor.query(
        `SELECT a.id, a.employee_id, COALESCE(p.name, a.employee_id) AS employee_name,
                a.shift_id, COALESCE(s.name, a.shift_id) AS shift_name,
                a.date, a.status, a.notes, a.check_in_time
         FROM attendances a
         LEFT JOIN pegawai p ON a.employee_id = p.id
         LEFT JOIN shifts s ON a.shift_id = s.id
         WHERE a.date = ?
         ORDER BY a.created_at DESC;`,
        [date]
      );
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil absensi tanggal: ${date}`);
    }
  }

  /**
   * Mencatat record absensi baru.
   * Menolak jika pegawai sudah memiliki absensi pada tanggal yang sama.
   */
  public async create(attendance: Attendance): Promise<Attendance> {
    // 1. Verifikasi aturan bisnis: satu pegawai hanya boleh satu absensi per tanggal
    const existing = await this.findByEmployeeAndDate(attendance.employeeId, attendance.date);
    if (existing) {
      const empName = existing.employeeName || attendance.employeeName || attendance.employeeId;
      throw new Error(
        `Pegawai [${empName}] sudah memiliki absensi untuk tanggal ${attendance.date}. Absensi duplikat ditolak.`
      );
    }

    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO attendances (
          id, employee_id, shift_id, date, status, notes, check_in_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          attendance.id,
          attendance.employeeId,
          attendance.shiftId,
          attendance.date,
          attendance.status,
          attendance.notes ?? null,
          attendance.checkInTime ?? null,
          timestamp,
          timestamp
        ]
      );

      const created = await this.findById(attendance.id);
      if (!created) {
        throw new Error(`Data absensi ${attendance.id} tidak ditemukan setelah disimpan.`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal mencatat absensi untuk pegawai: ${attendance.employeeId}`);
    }
  }

  /**
   * Memperbarui data absensi yang sudah ada
   */
  public async update(id: string, data: Partial<Attendance>): Promise<Attendance> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Absensi dengan ID ${id} tidak ditemukan.`);
    }

    // Jika terjadi perubahan tanggal atau employeeId, pastikan tidak menabrak rekaman lain
    const targetEmpId = data.employeeId || existing.employeeId;
    const targetDate = data.date || existing.date;
    if (targetEmpId !== existing.employeeId || targetDate !== existing.date) {
      const duplicateCheck = await this.findByEmployeeAndDate(targetEmpId, targetDate);
      if (duplicateCheck && duplicateCheck.id !== id) {
        throw new Error(
          `Pegawai sudah memiliki absensi lain untuk tanggal ${targetDate}. Pembaruan ditolak.`
        );
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.employeeId !== undefined) {
      updates.push('employee_id = ?');
      params.push(data.employeeId);
    }
    if (data.shiftId !== undefined) {
      updates.push('shift_id = ?');
      params.push(data.shiftId);
    }
    if (data.date !== undefined) {
      updates.push('date = ?');
      params.push(data.date);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }
    if (data.checkInTime !== undefined) {
      updates.push('check_in_time = ?');
      params.push(data.checkInTime);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(this.now());
    params.push(id);

    try {
      await this.executor.run(
        `UPDATE attendances SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Data absensi ${id} tidak ditemukan setelah pembaruan.`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui absensi dengan ID: ${id}`);
    }
  }

  /**
   * Menghapus record absensi
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM attendances WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus absensi dengan ID: ${id}`);
    }
  }
}

export const attendanceRepository = new AttendanceRepository();

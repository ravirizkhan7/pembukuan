import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Shift, ShiftSession } from '../../../types';

/**
 * REPOSITORY: SHIFT & SESI SHIFT (shifts, shift_sessions)
 * 
 * Mengelola definisi jadwal shift tetap dan riwayat sesi operasional aktual.
 * 
 * Aturan Bisnis:
 * - Shift 1: 07:00–15:00
 * - Shift 2: 15:00–23:00
 * - Hanya boleh ada SATU sesi shift aktif secara global pada satu waktu.
 * - Histori sesi shift tersimpan permanen di shift_sessions ketika sesi ditutup
 *   dan tidak terhapus ketika shift yang sama dibuka kembali pada hari berikutnya.
 */
export class ShiftRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapShiftRow(row: any): Shift {
    return {
      id: row.id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      operator: row.operator,
      status: row.status as 'Aktif' | 'Menunggu' | 'Tutup',
      totalSales: Number(row.total_sales || 0),
      cashHandover: Number(row.cash_handover || 0),
      date: row.date || undefined,
      initialCash: Number(row.initial_cash || 0),
      discrepancy: Number(row.discrepancy || 0)
    };
  }

  private mapSessionRow(row: any): ShiftSession {
    return {
      id: row.id,
      shiftId: row.shift_id,
      name: row.name,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      operator: row.operator,
      status: row.status as 'Aktif' | 'Tutup',
      initialCash: Number(row.initial_cash || 0),
      totalSales: Number(row.total_sales || 0),
      cashHandover: Number(row.cash_handover || 0),
      discrepancy: Number(row.discrepancy || 0),
      closedAt: row.closed_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Mengambil semua daftar jadwal shift beserta status sesi terkini
   */
  public async getAllShifts(): Promise<Shift[]> {
    try {
      const rows = await this.executor.query(
        `SELECT id, name, start_time, end_time, operator, status, total_sales,
                cash_handover, date, initial_cash, discrepancy
         FROM shifts
         ORDER BY id ASC;`
      );
      return rows.map((r) => this.mapShiftRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar shift');
    }
  }

  /**
   * Mengambil shift berdasarkan ID
   */
  public async findById(id: string): Promise<Shift | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, name, start_time, end_time, operator, status, total_sales,
                cash_handover, date, initial_cash, discrepancy
         FROM shifts
         WHERE id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapShiftRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil shift dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil sesi shift yang sedang aktif secara global (jika ada)
   */
  public async getActiveSession(): Promise<ShiftSession | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, shift_id, name, date, start_time, end_time, operator, status,
                initial_cash, total_sales, cash_handover, discrepancy, closed_at,
                created_at, updated_at
         FROM shift_sessions
         WHERE status = 'Aktif'
         LIMIT 1;`
      );
      if (rows.length === 0) return null;
      return this.mapSessionRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil sesi shift aktif');
    }
  }

  /**
   * Mengambil shift yang sedang aktif dari tabel shifts
   */
  public async getActiveShift(): Promise<Shift | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, name, start_time, end_time, operator, status, total_sales,
                cash_handover, date, initial_cash, discrepancy
         FROM shifts
         WHERE status = 'Aktif'
         LIMIT 1;`
      );
      if (rows.length === 0) return null;
      return this.mapShiftRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil shift aktif');
    }
  }

  /**
   * Membuka shift baru secara atomik.
   * Aturan: Menolak jika masih ada sesi shift yang aktif secara global.
   */
  public async bukaShift(
    shiftId: string,
    params: { date: string; startTime: string; operator: string; initialCash: number }
  ): Promise<ShiftSession> {
    // 1. Validasi konkurensi: Periksa apakah sudah ada shift yang aktif
    const activeSession = await this.getActiveSession();
    if (activeSession) {
      throw new Error(
        `Gagal membuka shift: Masih ada shift aktif [${activeSession.name}] yang berjalan. Hanya boleh ada satu sesi shift aktif secara global.`
      );
    }

    const activeShift = await this.getActiveShift();
    if (activeShift) {
      throw new Error(
        `Gagal membuka shift: Masih ada shift aktif [${activeShift.name}] yang berjalan di sistem.`
      );
    }

    // 2. Ambil definisi target shift
    const targetShift = await this.findById(shiftId);
    if (!targetShift) {
      throw new Error(`Shift dengan ID ${shiftId} tidak ditemukan.`);
    }

    const timestamp = this.now();
    const cleanDate = params.date.replace(/[^0-9]/g, '');
    const sessionId = `SES-${cleanDate}-${shiftId}-${Date.now().toString().slice(-4)}`;

    try {
      // 3. Simpan sesi aktif ke shift_sessions dan perbarui status di shifts
      await this.executor.run(
        `INSERT INTO shift_sessions (
          id, shift_id, name, date, start_time, end_time, operator,
          status, initial_cash, total_sales, cash_handover, discrepancy,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, 0, 0, 0, ?, ?);`,
        [
          sessionId,
          shiftId,
          targetShift.name,
          params.date,
          params.startTime,
          targetShift.endTime,
          params.operator,
          params.initialCash,
          timestamp,
          timestamp
        ]
      );

      await this.executor.run(
        `UPDATE shifts SET
          status = 'Aktif',
          date = ?,
          start_time = ?,
          operator = ?,
          initial_cash = ?,
          total_sales = 0,
          cash_handover = 0,
          discrepancy = 0,
          updated_at = ?
         WHERE id = ?;`,
        [
          params.date,
          params.startTime,
          params.operator,
          params.initialCash,
          timestamp,
          shiftId
        ]
      );

      const createdSession = await this.getSessionById(sessionId);
      if (!createdSession) {
        throw new Error('Gagal memverifikasi sesi shift setelah dibuka.');
      }
      return createdSession;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuka shift ${shiftId}`);
    }
  }

  /**
   * Menutup sesi shift secara atomik.
   * Menghitung selisih kas fisik dan memperbarui histori sesi.
   */
  public async tutupShift(
    shiftId: string,
    params: { cashHandover: number; computedSales?: number; computedCashSales?: number }
  ): Promise<ShiftSession> {
    // 1. Cari sesi aktif untuk shiftId
    let activeSession = await this.getActiveSession();
    if (!activeSession || activeSession.shiftId !== shiftId) {
      // Coba cari di shifts apakah statusnya aktif
      const s = await this.findById(shiftId);
      if (!s || s.status !== 'Aktif') {
        throw new Error(`Tidak ada sesi aktif untuk shift [${shiftId}].`);
      }
    }

    const timestamp = this.now();
    const totalSales = params.computedSales !== undefined ? params.computedSales : (activeSession?.totalSales || 0);
    const initialCash = activeSession?.initialCash || 0;
    const cashFromSales = params.computedCashSales !== undefined ? params.computedCashSales : totalSales;
    const discrepancy = params.cashHandover - (initialCash + cashFromSales);

    try {
      if (activeSession) {
        await this.executor.run(
          `UPDATE shift_sessions SET
            status = 'Tutup',
            total_sales = ?,
            cash_handover = ?,
            discrepancy = ?,
            closed_at = ?,
            updated_at = ?
           WHERE id = ?;`,
          [
            totalSales,
            params.cashHandover,
            discrepancy,
            timestamp,
            timestamp,
            activeSession.id
          ]
        );
      }

      await this.executor.run(
        `UPDATE shifts SET
          status = 'Tutup',
          total_sales = ?,
          cash_handover = ?,
          discrepancy = ?,
          updated_at = ?
         WHERE id = ?;`,
        [
          totalSales,
          params.cashHandover,
          discrepancy,
          timestamp,
          shiftId
        ]
      );

      const updated = activeSession ? await this.getSessionById(activeSession.id) : null;
      if (updated) return updated;

      return {
        id: activeSession?.id || `SES-${shiftId}`,
        shiftId,
        name: activeSession?.name || shiftId,
        date: activeSession?.date || '',
        startTime: activeSession?.startTime || '',
        endTime: activeSession?.endTime || '',
        operator: activeSession?.operator || '',
        status: 'Tutup',
        initialCash,
        totalSales,
        cashHandover: params.cashHandover,
        discrepancy,
        closedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    } catch (err) {
      return this.handleDbError(err, `Gagal menutup shift ${shiftId}`);
    }
  }

  /**
   * Mengambil sesi berdasarkan ID
   */
  public async getSessionById(sessionId: string): Promise<ShiftSession | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, shift_id, name, date, start_time, end_time, operator, status,
                initial_cash, total_sales, cash_handover, discrepancy, closed_at,
                created_at, updated_at
         FROM shift_sessions
         WHERE id = ? LIMIT 1;`,
        [sessionId]
      );
      if (rows.length === 0) return null;
      return this.mapSessionRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil sesi dengan ID: ${sessionId}`);
    }
  }

  /**
   * Mengambil riwayat seluruh sesi shift, terurut dari yang terbaru
   */
  public async getSessionHistory(): Promise<ShiftSession[]> {
    try {
      const rows = await this.executor.query(
        `SELECT id, shift_id, name, date, start_time, end_time, operator, status,
                initial_cash, total_sales, cash_handover, discrepancy, closed_at,
                created_at, updated_at
         FROM shift_sessions
         ORDER BY date DESC, created_at DESC;`
      );
      return rows.map((r) => this.mapSessionRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil riwayat sesi shift');
    }
  }

  /**
   * Menginisialisasi definisi shift standar secara idempotent
   */
  public async initShiftDefinitions(definitions: Shift[]): Promise<void> {
    const timestamp = this.now();
    for (const def of definitions) {
      await this.executor.run(
        `INSERT INTO shifts (
          id, name, start_time, end_time, operator, status,
          total_sales, cash_handover, date, initial_cash, discrepancy,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'Menunggu', 0, 0, ?, 0, 0, ?, ?)
        ON CONFLICT(id) DO NOTHING;`,
        [
          def.id,
          def.name,
          def.startTime,
          def.endTime,
          def.operator || 'Operator SPBU',
          def.date || '2026-09-24',
          timestamp,
          timestamp
        ]
      );
    }
  }
}

export const shiftRepository = new ShiftRepository();

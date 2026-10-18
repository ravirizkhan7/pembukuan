import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Transaction, PaymentMethod } from '../../../types';

/**
 * REPOSITORY: TRANSAKSI OPERASIONAL (transactions)
 * Menyediakan akses data terstruktur untuk transaksi bisnis harian SPBU.
 */
export class TransactionRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Transaction {
    return {
      id: row.id,
      date: row.date,
      code: row.code,
      name: row.name,
      category: row.category,
      productId: row.product_id || undefined,
      product: row.product_name || '-',
      volume: Number(row.volume || 0),
      unitPrice: Number(row.unit_price || 0),
      total: Number(row.total || 0),
      amount: Number(row.total || 0),
      shiftId: row.shift_id || undefined,
      shift: row.shift_name || (row.shift_id ? '' : 'Tanpa Sesi / Administratif'),
      cashier: row.cashier || (row.shift_id ? '' : 'Admin SPBU'),
      status: row.status || 'Selesai',
      nozzleId: row.nozzle_id || undefined,
      teraId: row.tera_id || undefined,
      teraAwal: row.tera_awal != null ? Number(row.tera_awal) : undefined,
      teraAkhir: row.tera_akhir != null ? Number(row.tera_akhir) : undefined,
      teraSelisih: row.tera_selisih != null ? Number(row.tera_selisih) : undefined,
      masterCodeId: row.master_code_id || undefined,
      partnerId: row.partner_id || undefined,
      partnerName: row.partner_name || undefined,
      paymentMethod: (row.payment_method as PaymentMethod) || undefined,
      relatedReceivableId: row.related_receivable_id || undefined,
      relatedPayableId: row.related_payable_id || undefined,
      isCorrected: row.is_corrected === 1,
      correctionId: row.correction_id || undefined,
      cancelledAt: row.cancelled_at || undefined,
      cancelReason: row.cancel_reason || undefined
    };
  }

  private get baseSelectQuery(): string {
    return `SELECT
              t.id, t.date, t.code, t.name, t.category,
              t.product_id, p.name AS product_name,
              t.volume, t.unit_price, t.total,
              t.shift_id, s.name AS shift_name,
              t.cashier, t.status,
              t.nozzle_id, n.code AS nozzle_code,
              t.tera_id, tr.tera_awal, tr.tera_akhir, tr.selisih AS tera_selisih,
              t.master_code_id,
              t.partner_id, bp.name AS partner_name,
              t.payment_method,
              t.related_receivable_id, t.related_payable_id,
              t.is_corrected, t.correction_id,
              t.cancelled_at, t.cancel_reason,
              t.created_at, t.updated_at
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN shifts s ON t.shift_id = s.id
            LEFT JOIN nozzles n ON t.nozzle_id = n.id
            LEFT JOIN tera tr ON t.tera_id = tr.id
            LEFT JOIN business_partners bp ON t.partner_id = bp.id`;
  }

  /**
   * Mengambil semua transaksi terurut dari yang terbaru
   */
  public async findAll(options?: { shiftId?: string; date?: string; status?: string }): Promise<Transaction[]> {
    try {
      let sql = this.baseSelectQuery;
      const conditions: string[] = [];
      const params: any[] = [];

      if (options?.shiftId) {
        conditions.push('t.shift_id = ?');
        params.push(options.shiftId);
      }
      if (options?.date) {
        conditions.push("substr(t.date, 1, 10) = ?");
        params.push(options.date);
      }
      if (options?.status) {
        conditions.push('t.status = ?');
        params.push(options.status);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
      sql += ' ORDER BY t.created_at DESC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar transaksi');
    }
  }

  /**
   * Mengambil transaksi berdasarkan ID
   */
  public async findById(id: string): Promise<Transaction | null> {
    try {
      const sql = `${this.baseSelectQuery} WHERE t.id = ? LIMIT 1;`;
      const rows = await this.executor.query(sql, [id]);
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil transaksi dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil daftar transaksi berdasarkan shiftId
   */
  public async findByShiftId(shiftId: string): Promise<Transaction[]> {
    return this.findAll({ shiftId });
  }

  /**
   * Menambahkan transaksi baru ke tabel transactions
   */
  public async create(data: Transaction): Promise<Transaction> {
    const timestamp = this.now();
    try {
      await this.executor.run(
        `INSERT INTO transactions (
           id, date, code, name, category, product_id,
           volume, unit_price, total, shift_id, cashier,
           status, nozzle_id, tera_id, master_code_id, partner_id,
           payment_method, related_receivable_id, related_payable_id,
           is_corrected, correction_id,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.date,
          data.code,
          data.name,
          data.category,
          data.productId || null,
          data.volume ?? 0,
          data.unitPrice ?? 0,
          data.total,
          data.shiftId || null,
          data.cashier,
          data.status || 'Selesai',
          data.nozzleId || null,
          data.teraId || null,
          data.masterCodeId || null,
          data.partnerId || null,
          data.paymentMethod || null,
          data.relatedReceivableId || null,
          data.relatedPayableId || null,
          data.isCorrected ? 1 : 0,
          data.correctionId || null,
          timestamp,
          timestamp
        ]
      );

      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Transaksi dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal menyimpan transaksi: ${data.name} (${data.code})`);
    }
  }

  /**
   * Melakukan pembatalan transaksi secara sah (Selesai -> Batal)
   * Dilindungi trigger integritas trg_transactions_enforce_immutability_when_selesai
   */
  public async cancel(id: string, cancelReason: string): Promise<Transaction> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Transaksi dengan ID ${id} tidak ditemukan`);
    }
    if (existing.status !== 'Selesai') {
      throw new Error(`Hanya transaksi berstatus Selesai yang dapat dibatalkan (status saat ini: ${existing.status})`);
    }
    if (!cancelReason || cancelReason.trim() === '') {
      throw new Error('Alasan pembatalan (cancel_reason) wajib diisi');
    }

    // Periksa apakah transaksi sudah diposting ke jurnal akuntansi
    const journalRows = await this.executor.query<any>(
      `SELECT id FROM journals WHERE transaction_id = ? LIMIT 1;`,
      [id]
    );
    if (journalRows.length > 0) {
      throw new Error(
        `Transaksi dengan ID ${id} sudah diposting ke jurnal akuntansi (${journalRows[0].id}). Pembatalan transaksi yang sudah diposting ditolak secara aman untuk menjaga konsistensi jurnal, buku besar, dan rekap shift.`
      );
    }

    const timestamp = this.now();
    try {
      await this.executor.run(
        `UPDATE transactions SET
           status = 'Batal',
           cancelled_at = ?,
           cancel_reason = ?,
           updated_at = ?
         WHERE id = ?;`,
        [timestamp, cancelReason.trim(), timestamp, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Transaksi dengan ID ${id} tidak ditemukan setelah dibatalkan`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal membatalkan transaksi dengan ID: ${id}`);
    }
  }
}

export const transactionRepository = new TransactionRepository();

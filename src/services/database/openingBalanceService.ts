/**
 * OPENING BALANCE & SAFE SEEDING SERVICE (PHASE 5)
 * 
 * Bertanggung jawab melakukan inisialisasi akun Bagan Akun (COA)
 * dan membukukan Saldo Awal Neraca melalui satu Jurnal Pembukaan
 * yang seimbang (Debit == Kredit) secara atomik, eksplisit, dan idempotent.
 * 
 * Batasan Integritas:
 * - Menolak keras saldo awal yang tidak seimbang (totalDebit !== totalCredit).
 * - Tidak mengarang akun penyeimbang atau nominal baru yang tidak didukung data.
 * - Akun diinisialisasi dengan balance = 0, lalu dimutasi secara atomik melalui jurnal pembukaan.
 * - Idempotent: tidak menduplikasi jurnal atau mem-posting ulang saldo awal jika sudah pernah dicatat.
 */

import type { Account } from '../../types';
import { mockAccounts } from '../../mock/mockData';
import type { SqlExecutor } from './migrationRunner';

export interface OpeningBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface OpeningBalanceValidationResult {
  isValid: boolean;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  errors: string[];
}

export interface OpeningBalanceResult {
  success: boolean;
  journalId?: string;
  totalDebit: number;
  totalCredit: number;
  entryCount: number;
  alreadySeeded?: boolean;
  error?: string;
}

export interface OpeningJournalStatus {
  isSeeded: boolean;
  journalId?: string;
  totalAmount?: number;
  date?: string;
  entryCount?: number;
}

export class OpeningBalanceService {
  public static readonly DETERMINISTIC_JOURNAL_ID = 'JRN-OPENING-BALANCE';
  public static readonly DETERMINISTIC_EVIDENCE_NO = 'BKT/SALDO-AWAL';
  public static readonly METADATA_KEY_SEEDED = 'opening_balance_seeded';
  public static readonly METADATA_KEY_JOURNAL_ID = 'opening_balance_journal_id';
  public static readonly METADATA_KEY_TOTAL = 'opening_balance_total';
  public static readonly METADATA_KEY_DATE = 'opening_balance_date';

  /**
   * Mengonversi daftar Account menjadi entri debit/kredit saldo awal berdasarkan normalBalance masing-masing akun.
   */
  public static createEntriesFromAccounts(accounts: Account[] = mockAccounts): OpeningBalanceEntry[] {
    return accounts
      .filter((acc) => acc.balance > 0)
      .map((acc) => {
        const isDebit = acc.normalBalance === 'Debit';
        return {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          debit: isDebit ? acc.balance : 0,
          credit: isDebit ? 0 : acc.balance
        };
      });
  }

  /**
   * Memvalidasi keseimbangan matematis dan aturan akuntansi saldo awal.
   * Menolak jika total debit != total kredit atau terdapat entri yang tidak valid.
   */
  public static validateOpeningBalance(entries: OpeningBalanceEntry[]): OpeningBalanceValidationResult {
    const errors: string[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    if (!entries || entries.length === 0) {
      return {
        isValid: false,
        isBalanced: false,
        totalDebit: 0,
        totalCredit: 0,
        difference: 0,
        errors: ['Tidak ada entri saldo awal yang disediakan untuk divalidasi.']
      };
    }

    for (const [index, entry] of entries.entries()) {
      if (!entry.accountId || !entry.accountCode) {
        errors.push(`Entri ke-${index + 1} tidak memiliki accountId atau accountCode.`);
      }

      if (entry.debit < 0 || entry.credit < 0) {
        errors.push(`Entri [${entry.accountCode}] memiliki nominal negatif (Debit: ${entry.debit}, Kredit: ${entry.credit}).`);
      }

      // Aturan double-entry: setiap baris hanya boleh debit > 0 ATAU kredit > 0 (tidak boleh keduanya)
      if (entry.debit > 0 && entry.credit > 0) {
        errors.push(`Entri [${entry.accountCode}] memiliki debit dan kredit secara bersamaan.`);
      }

      totalDebit += entry.debit || 0;
      totalCredit += entry.credit || 0;
    }

    if (totalDebit === 0 && totalCredit === 0) {
      errors.push('Total debit dan kredit bernilai 0. Jurnal pembukaan tidak memiliki nilai saldo.');
    }

    const difference = totalDebit - totalCredit;
    const isBalanced = difference === 0;

    if (!isBalanced) {
      errors.push(
        `Saldo awal tidak seimbang. Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) ` +
        `!== Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')}). ` +
        `Terdapat selisih sebesar Rp ${Math.abs(difference).toLocaleString('id-ID')}.`
      );
    }

    return {
      isValid: errors.length === 0,
      isBalanced,
      totalDebit,
      totalCredit,
      difference,
      errors
    };
  }

  /**
   * Melakukan seeding master akun (COA) ke tabel accounts secara idempotent.
   * Saldo awal setiap akun diinisialisasi bernilai 0 terlebih dahulu.
   */
  public static async seedAccounts(
    executor: SqlExecutor,
    accountsList: Account[] = mockAccounts
  ): Promise<{ insertedCount: number; existingCount: number }> {
    let insertedCount = 0;
    let existingCount = 0;
    const now = new Date().toISOString();

    for (const acc of accountsList) {
      const existing = await executor.query<{ id: string }>(
        'SELECT id FROM accounts WHERE id = ? LIMIT 1;',
        [acc.id]
      );

      if (existing.length > 0) {
        existingCount++;
      } else {
        await executor.run(
          `INSERT INTO accounts (
            id, code, name, category, normal_balance, balance, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?);`,
          [
            acc.id,
            acc.code,
            acc.name,
            acc.category,
            acc.normalBalance,
            acc.isActive ? 1 : 0,
            now,
            now
          ]
        );
        insertedCount++;
      }
    }

    return { insertedCount, existingCount };
  }

  /**
   * Memeriksa status apakah jurnal pembukaan sudah pernah dibukukan.
   */
  public static async getOpeningJournalStatus(executor: SqlExecutor): Promise<OpeningJournalStatus> {
    try {
      const metaRows = await executor.query<{ value: string }>(
        `SELECT value FROM app_metadata WHERE key = ? LIMIT 1;`,
        [this.METADATA_KEY_SEEDED]
      );

      const isSeeded = metaRows.length > 0 && metaRows[0].value === 'true';
      if (!isSeeded) {
        return { isSeeded: false };
      }

      const journalRows = await executor.query<{
        id: string;
        date: string;
      }>(
        `SELECT id, date FROM journals WHERE id = ? LIMIT 1;`,
        [this.DETERMINISTIC_JOURNAL_ID]
      );

      if (journalRows.length === 0) {
        return { isSeeded: false };
      }

      const totalRows = await executor.query<{ value: string }>(
        `SELECT value FROM app_metadata WHERE key = ? LIMIT 1;`,
        [this.METADATA_KEY_TOTAL]
      );

      const entryCountRows = await executor.query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM journal_entries WHERE journal_id = ?;`,
        [this.DETERMINISTIC_JOURNAL_ID]
      );

      return {
        isSeeded: true,
        journalId: journalRows[0].id,
        date: journalRows[0].date,
        totalAmount: totalRows.length > 0 ? parseFloat(totalRows[0].value) : 0,
        entryCount: entryCountRows.length > 0 ? entryCountRows[0].cnt : 0
      };
    } catch {
      return { isSeeded: false };
    }
  }

  /**
   * Membukukan Jurnal Pembukaan Saldo Awal ke SQLite secara atomik.
   * 
   * Langkah Integritas:
   * 1. Cek idempotensi: jika sudah pernah di-seed, return success tanpa duplikasi.
   * 2. Validasi ketat: jika debit !== kredit, gagalkan dan rollback seluruh operasi.
   * 3. Dalam transaksi atomik:
   *    a. Simpan header jurnal di tabel 'journals' (transaction_id = NULL).
   *    b. Simpan baris entri di tabel 'journal_entries'.
   *    c. Mutasi field accounts.balance sesuai saldo normal masing-masing akun.
   *    d. Catat status seeding di 'app_metadata'.
   */
  public static async seedOpeningJournal(
    executor: SqlExecutor,
    params: {
      entries: OpeningBalanceEntry[];
      date?: string;
      evidenceNo?: string;
      description?: string;
    }
  ): Promise<OpeningBalanceResult> {
    const { entries, date = '2026-09-01', evidenceNo, description } = params;

    // 1. Cek Idempotensi
    const currentStatus = await this.getOpeningJournalStatus(executor);
    if (currentStatus.isSeeded) {
      console.log(`[OpeningBalanceService] Saldo awal sudah pernah dibukukan (${this.DETERMINISTIC_JOURNAL_ID}). Melewati proses.`);
      return {
        success: true,
        journalId: this.DETERMINISTIC_JOURNAL_ID,
        totalDebit: currentStatus.totalAmount || 0,
        totalCredit: currentStatus.totalAmount || 0,
        entryCount: currentStatus.entryCount || 0,
        alreadySeeded: true
      };
    }

    // 2. Validasi Keseimbangan Akuntansi
    const validation = this.validateOpeningBalance(entries);
    if (!validation.isValid || !validation.isBalanced) {
      const errorMsg = validation.errors.join(' | ');
      console.error(`[OpeningBalanceService] Gagal validasi saldo awal: ${errorMsg}`);
      return {
        success: false,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        entryCount: entries.length,
        alreadySeeded: false,
        error: errorMsg
      };
    }

    const journalId = this.DETERMINISTIC_JOURNAL_ID;
    const finalEvidenceNo = evidenceNo || this.DETERMINISTIC_EVIDENCE_NO;
    const finalDescription = description || 'Jurnal Saldo Awal Neraca SPBU';
    const now = new Date().toISOString();

    // 3. Eksekusi Atomik (Database Transaction)
    try {
      await executor.run('BEGIN TRANSACTION;');

      // 3.a. Simpan Header Jurnal Pembukaan
      await executor.run(
        `INSERT INTO journals (
          id, date, transaction_id, evidence_no, trans_code, description,
          is_balanced, is_reversal, reverses_journal_id, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, 'OPENING', ?, 1, 0, NULL, ?, ?);`,
        [
          journalId,
          date,
          finalEvidenceNo,
          finalDescription,
          now,
          now
        ]
      );

      // 3.b. Simpan Entri Jurnal & Perbarui Saldo Akun (Materialized Balance)
      for (const [index, entry] of entries.entries()) {
        const entryId = `ENT-OPENING-${(index + 1).toString().padStart(3, '0')}`;

        await executor.run(
          `INSERT INTO journal_entries (
            id, journal_id, account_id, debit, credit, created_at
          ) VALUES (?, ?, ?, ?, ?, ?);`,
          [
            entryId,
            journalId,
            entry.accountId,
            entry.debit,
            entry.credit,
            now
          ]
        );

        // Ambil saldo normal akun
        const accRows = await executor.query<{ normal_balance: 'Debit' | 'Kredit' }>(
          `SELECT normal_balance FROM accounts WHERE id = ? LIMIT 1;`,
          [entry.accountId]
        );

        if (accRows.length === 0) {
          throw new Error(`Akun [${entry.accountId}] tidak ditemukan di tabel accounts.`);
        }

        const isDebitNormal = accRows[0].normal_balance === 'Debit';
        const delta = isDebitNormal
          ? (entry.debit - entry.credit)
          : (entry.credit - entry.debit);

        await executor.run(
          `UPDATE accounts
           SET balance = balance + ?,
               updated_at = ?
           WHERE id = ?;`,
          [delta, now, entry.accountId]
        );
      }

      // 3.c. Catat Metadata Seeding di app_metadata
      await executor.run(
        `INSERT INTO app_metadata (key, value, created_at, updated_at)
         VALUES (?, 'true', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
        [this.METADATA_KEY_SEEDED, now, now]
      );

      await executor.run(
        `INSERT INTO app_metadata (key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
        [this.METADATA_KEY_JOURNAL_ID, journalId, now, now]
      );

      await executor.run(
        `INSERT INTO app_metadata (key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
        [this.METADATA_KEY_TOTAL, validation.totalDebit.toString(), now, now]
      );

      await executor.run(
        `INSERT INTO app_metadata (key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
        [this.METADATA_KEY_DATE, date, now, now]
      );

      await executor.run('COMMIT;');

      console.log(
        `[OpeningBalanceService] Jurnal pembukaan berhasil dibukukan: ${journalId} ` +
        `dengan ${entries.length} entri seimbang (Rp ${validation.totalDebit.toLocaleString('id-ID')}).`
      );

      return {
        success: true,
        journalId,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        entryCount: entries.length,
        alreadySeeded: false
      };
    } catch (err: any) {
      try {
        await executor.run('ROLLBACK;');
      } catch {
        // Abaikan rollback error jika transaksi sudah batal
      }

      const errorMsg = err?.message || String(err);
      console.error(`[OpeningBalanceService] Transaksi seeding di-rollback karena error: ${errorMsg}`);
      return {
        success: false,
        totalDebit: 0,
        totalCredit: 0,
        entryCount: 0,
        alreadySeeded: false,
        error: errorMsg
      };
    }
  }
}

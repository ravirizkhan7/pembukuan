import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Journal, JournalEntry } from '../../../types';

/**
 * REPOSITORY: JURNAL UMUM (journals & journal_entries)
 * Menyediakan akses data terstruktur untuk pencatatan akuntansi double-entry.
 */
export class JournalRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  /**
   * Mengambil semua jurnal beserta baris detail (entries)
   */
  public async findAll(): Promise<Journal[]> {
    try {
      const journalRows = await this.executor.query<any>(
        `SELECT id, date, transaction_id, evidence_no, trans_code, description,
                is_balanced, is_reversal, reverses_journal_id, created_at, updated_at
         FROM journals
         ORDER BY date DESC, created_at DESC;`
      );

      if (journalRows.length === 0) {
        return [];
      }

      const entryRows = await this.executor.query<any>(
        `SELECT je.id, je.journal_id, je.account_id, a.code AS account_code,
                a.name AS account_name, je.debit, je.credit
         FROM journal_entries je
         JOIN accounts a ON je.account_id = a.id
         ORDER BY je.created_at ASC, je.debit DESC;`
      );

      const entriesByJournalId = new Map<string, JournalEntry[]>();
      for (const row of entryRows) {
        const jId = row.journal_id;
        if (!entriesByJournalId.has(jId)) {
          entriesByJournalId.set(jId, []);
        }
        entriesByJournalId.get(jId)!.push({
          accountId: row.account_id,
          accountCode: row.account_code || '',
          accountName: row.account_name || '',
          debit: Number(row.debit || 0),
          credit: Number(row.credit || 0)
        });
      }

      return journalRows.map((j) => ({
        id: j.id,
        date: j.date,
        transactionId: j.transaction_id || undefined,
        evidenceNo: j.evidence_no || undefined,
        transCode: j.trans_code || undefined,
        description: j.description,
        isBalanced: j.is_balanced === 1,
        entries: entriesByJournalId.get(j.id) || []
      }));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar jurnal umum');
    }
  }

  /**
   * Mengambil satu jurnal berdasarkan ID
   */
  public async findById(id: string): Promise<Journal | null> {
    try {
      const jRows = await this.executor.query<any>(
        `SELECT id, date, transaction_id, evidence_no, trans_code, description,
                is_balanced, is_reversal, reverses_journal_id, created_at, updated_at
         FROM journals
         WHERE id = ?
         LIMIT 1;`,
        [id]
      );
      if (jRows.length === 0) return null;
      const j = jRows[0];

      const entryRows = await this.executor.query<any>(
        `SELECT je.id, je.journal_id, je.account_id, a.code AS account_code,
                a.name AS account_name, je.debit, je.credit
         FROM journal_entries je
         JOIN accounts a ON je.account_id = a.id
         WHERE je.journal_id = ?
         ORDER BY je.created_at ASC, je.debit DESC;`,
        [id]
      );

      const entries: JournalEntry[] = entryRows.map((r) => ({
        accountId: r.account_id,
        accountCode: r.account_code || '',
        accountName: r.account_name || '',
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0)
      }));

      return {
        id: j.id,
        date: j.date,
        transactionId: j.transaction_id || undefined,
        evidenceNo: j.evidence_no || undefined,
        transCode: j.trans_code || undefined,
        description: j.description,
        isBalanced: j.is_balanced === 1,
        entries
      };
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil jurnal dengan ID: ${id}`);
    }
  }

  /**
   * Mengambil jurnal berdasarkan transactionId
   */
  public async findByTransactionId(transactionId: string): Promise<Journal | null> {
    try {
      const rows = await this.executor.query<any>(
        `SELECT id FROM journals WHERE transaction_id = ? LIMIT 1;`,
        [transactionId]
      );
      if (rows.length === 0) return null;
      return this.findById(rows[0].id);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil jurnal untuk transaksi: ${transactionId}`);
    }
  }

  /**
   * Menyimpan jurnal umum dan entri-entri debit/kreditnya secara atomik
   */
  public async create(data: Journal): Promise<Journal> {
    const timestamp = this.now();
    const isBalanced = data.isBalanced ?? true ? 1 : 0;

    try {
      // 1. Simpan Header Jurnal
      await this.executor.run(
        `INSERT INTO journals (
           id, date, transaction_id, evidence_no, trans_code,
           description, is_balanced, is_reversal, reverses_journal_id,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?);`,
        [
          data.id,
          data.date,
          data.transactionId || null,
          data.evidenceNo || null,
          data.transCode || null,
          data.description,
          isBalanced,
          timestamp,
          timestamp
        ]
      );

      // 2. Simpan Baris Detail Jurnal
      for (let i = 0; i < data.entries.length; i++) {
        const entry = data.entries[i];
        const entryId = `JE-${data.id}-${(i + 1).toString().padStart(2, '0')}`;
        await this.executor.run(
          `INSERT INTO journal_entries (
             id, journal_id, account_id, debit, credit, created_at
           ) VALUES (?, ?, ?, ?, ?, ?);`,
          [
            entryId,
            data.id,
            entry.accountId,
            entry.debit,
            entry.credit,
            timestamp
          ]
        );
      }

      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Jurnal dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal menyimpan jurnal umum [${data.id}]`);
    }
  }
}

export const journalRepository = new JournalRepository();

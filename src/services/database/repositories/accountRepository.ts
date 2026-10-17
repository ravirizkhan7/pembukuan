import { BaseRepository } from './baseRepository';
import type { SqlExecutor } from '../migrationRunner';
import type { Account } from '../../../types';

/**
 * REPOSITORY: BAGAN AKUN / COA (accounts)
 * Menyediakan akses data terstruktur untuk master data akun akuntansi.
 */
export class AccountRepository extends BaseRepository {
  constructor(executor?: SqlExecutor) {
    super(executor);
  }

  private mapRow(row: any): Account {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category as Account['category'],
      normalBalance: row.normal_balance as 'Debit' | 'Kredit',
      balance: Number(row.balance),
      isActive: row.is_active === 1
    };
  }

  /**
   * Mengambil semua akun COA terurut berdasarkan kode
   */
  public async findAll(options?: { activeOnly?: boolean }): Promise<Account[]> {
    try {
      let sql = `SELECT id, code, name, category, normal_balance, balance, is_active
                 FROM accounts`;
      const params: any[] = [];

      if (options?.activeOnly) {
        sql += ' WHERE is_active = 1';
      }
      sql += ' ORDER BY code ASC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, 'Gagal mengambil daftar akun COA');
    }
  }

  /**
   * Mengambil akun COA berdasarkan ID
   */
  public async findById(id: string): Promise<Account | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, category, normal_balance, balance, is_active
         FROM accounts
         WHERE id = ? LIMIT 1;`,
        [id]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil akun dengan ID: ${id}`);
    }
  }

  /**
   * Mencari akun COA berdasarkan nomor kode (misal: "1-1001")
   */
  public async findByCode(code: string): Promise<Account | null> {
    try {
      const rows = await this.executor.query(
        `SELECT id, code, name, category, normal_balance, balance, is_active
         FROM accounts
         WHERE code = ? LIMIT 1;`,
        [code]
      );
      if (rows.length === 0) return null;
      return this.mapRow(rows[0]);
    } catch (err) {
      return this.handleDbError(err, `Gagal mencari akun dengan kode: ${code}`);
    }
  }

  /**
   * Mengambil daftar akun berdasarkan kategori akuntansi
   */
  public async findByCategory(
    category: Account['category'],
    options?: { activeOnly?: boolean }
  ): Promise<Account[]> {
    try {
      let sql = `SELECT id, code, name, category, normal_balance, balance, is_active
                 FROM accounts
                 WHERE category = ?`;
      const params: any[] = [category];

      if (options?.activeOnly) {
        sql += ' AND is_active = 1';
      }
      sql += ' ORDER BY code ASC;';

      const rows = await this.executor.query(sql, params);
      return rows.map((r) => this.mapRow(r));
    } catch (err) {
      return this.handleDbError(err, `Gagal mengambil akun untuk kategori: ${category}`);
    }
  }

  /**
   * Menambahkan akun COA baru
   */
  public async create(data: Account): Promise<Account> {
    const timestamp = this.now();
    const isActive = data.isActive ? 1 : 0;
    try {
      await this.executor.run(
        `INSERT INTO accounts (
           id, code, name, category, normal_balance, balance, is_active,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          data.id,
          data.code,
          data.name,
          data.category,
          data.normalBalance,
          data.balance ?? 0,
          isActive,
          timestamp,
          timestamp
        ]
      );
      const created = await this.findById(data.id);
      if (!created) {
        throw new Error(`Akun dengan ID ${data.id} tidak ditemukan setelah disimpan`);
      }
      return created;
    } catch (err) {
      return this.handleDbError(err, `Gagal membuat akun: ${data.name} (${data.code})`);
    }
  }

  /**
   * Memperbarui akun dengan input yang di-whitelist
   */
  public async update(
    id: string,
    data: Partial<Omit<Account, 'id'>>
  ): Promise<Account> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Akun dengan ID ${id} tidak ditemukan`);
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
    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category);
    }
    if (data.normalBalance !== undefined) {
      updates.push('normal_balance = ?');
      params.push(data.normalBalance);
    }
    if (data.balance !== undefined) {
      updates.push('balance = ?');
      params.push(data.balance);
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
        `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?;`,
        params
      );
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Akun dengan ID ${id} tidak ditemukan setelah update`);
      }
      return updated;
    } catch (err) {
      return this.handleDbError(err, `Gagal memperbarui akun dengan ID: ${id}`);
    }
  }

  /**
   * Memeriksa apakah akun COA sudah memiliki entri jurnal atau digunakan pada pemetaan master kode
   */
  public async isReferenced(id: string): Promise<boolean> {
    try {
      const existing = await this.findById(id);
      const code = existing?.code || '';
      const rows = await this.executor.query<any>(
        `SELECT
           ((SELECT COUNT(*) FROM journal_entries WHERE account_id = ? OR account_id = ?) +
            (SELECT COUNT(*) FROM master_codes WHERE debit_account_id = ? OR debit_account_id = ? OR credit_account_id = ? OR credit_account_id = ?)) AS total_refs;`,
        [id, code, id, code, id, code]
      );
      if (rows.length === 0) return false;
      return Number(rows[0].total_refs || 0) > 0;
    } catch (err) {
      console.warn('[AccountRepository] Gagal mengecek referensi akun:', err);
      return false;
    }
  }

  /**
   * Menghapus akun secara aman (menghormati constraint relasional)
   */
  public async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    const isRef = await this.isReferenced(id);
    if (isRef) {
      throw new Error(
        `Akun [${existing.code}] ${existing.name} tidak dapat dihapus karena memiliki riwayat entri jurnal atau digunakan oleh Master Kode. Silakan gunakan opsi Nonaktifkan.`
      );
    }

    try {
      const result = await this.executor.run(
        'DELETE FROM accounts WHERE id = ?;',
        [id]
      );
      return (result.changes ?? 0) > 0;
    } catch (err) {
      return this.handleDbError(err, `Gagal menghapus akun dengan ID: ${id}`);
    }
  }
}

export const accountRepository = new AccountRepository();

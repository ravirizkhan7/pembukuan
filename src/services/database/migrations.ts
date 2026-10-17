/**
 * DEFINISI MIGRASI DATABASE SQLITE (AKRUAL SPBU)
 * 
 * Versi 1: Baseline tabel app_metadata (POC Phase 1)
 * Versi 2: Skema Lengkap Akrual SPBU sesuai entitas & relasi model aplikasi (Phase 4)
 * 
 * Batasan Scope:
 * - Tidak ada tabel QRIS, EDC, settlement, provider pembayaran, MDR, atau payment_settlements.
 * - Metode pembayaran hanya: 'Tunai', 'Piutang', 'Hutang', 'Transfer'.
 * - Relasi master_codes mendukung debitAccountId dan creditAccountId dinamis.
 */

export interface MigrationDefinition {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: MigrationDefinition[] = [
  {
    version: 1,
    name: 'initial_app_metadata',
    statements: [
      `CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`
    ]
  },
  {
    version: 2,
    name: 'canonical_spbu_akrual_schema',
    statements: [
      // 1. Profil & Metadata SPBU
      `CREATE TABLE IF NOT EXISTS station_info (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        manager TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Online',
        last_backup TEXT,
        version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 2. Kategori Produk
      `CREATE TABLE IF NOT EXISTS product_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Nonaktif')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 3. Produk (BBM & Non-BBM)
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category_id TEXT NOT NULL REFERENCES product_categories(id),
        sell_price INTEGER NOT NULL CHECK(sell_price >= 0),
        buy_price INTEGER NOT NULL CHECK(buy_price >= 0),
        unit TEXT NOT NULL,
        color TEXT,
        status TEXT NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Nonaktif')),
        tank_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 4. Tanki Pendam
      `CREATE TABLE IF NOT EXISTS tanks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id),
        capacity REAL NOT NULL CHECK(capacity > 0),
        current_stock REAL NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
        unit TEXT NOT NULL DEFAULT 'Liter',
        last_sounding TEXT,
        status TEXT NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Nonaktif', 'Aman', 'Perlu Reorder')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 5. Nozzle Dispenser
      `CREATE TABLE IF NOT EXISTS nozzles (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        island TEXT NOT NULL,
        tank_id TEXT NOT NULL REFERENCES tanks(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        current_meter REAL NOT NULL DEFAULT 0 CHECK(current_meter >= 0),
        status TEXT NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Maintenance', 'Nonaktif')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 6. Sesi Shift Kerja
      `CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        operator TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Menunggu' CHECK(status IN ('Aktif', 'Menunggu', 'Tutup')),
        total_sales INTEGER NOT NULL DEFAULT 0,
        cash_handover INTEGER NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        initial_cash INTEGER NOT NULL DEFAULT 0,
        discrepancy INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 7. Pegawai / Operator
      `CREATE TABLE IF NOT EXISTS pegawai (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Nonaktif')),
        shift_id TEXT REFERENCES shifts(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 8. Absensi Kehadiran Pegawai
      `CREATE TABLE IF NOT EXISTS attendances (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES pegawai(id),
        shift_id TEXT NOT NULL REFERENCES shifts(id),
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Hadir', 'Izin', 'Sakit', 'Alpa')),
        notes TEXT,
        check_in_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 9. Mitra Bisnis (Pelanggan / Vendor)
      `CREATE TABLE IF NOT EXISTS business_partners (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('Customer', 'Vendor')),
        phone TEXT,
        address TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 10. Bagan Akun (COA)
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('Aset', 'Kewajiban', 'Ekuitas', 'Pendapatan', 'Beban Pokok', 'Beban')),
        normal_balance TEXT NOT NULL CHECK(normal_balance IN ('Debit', 'Kredit')),
        balance INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 11. Master Kode Transaksi
      `CREATE TABLE IF NOT EXISTS master_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('Penjualan', 'Pembelian', 'Biaya Operasional', 'Persediaan', 'Pelunasan')),
        type TEXT NOT NULL,
        requires_tera INTEGER NOT NULL DEFAULT 0 CHECK(requires_tera IN (0, 1)),
        product_id TEXT REFERENCES products(id),
        unit_price INTEGER CHECK(unit_price IS NULL OR unit_price >= 0),
        debit_account_id TEXT NOT NULL REFERENCES accounts(id),
        credit_account_id TEXT NOT NULL REFERENCES accounts(id),
        description TEXT,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('Tunai', 'Piutang', 'Hutang', 'Transfer')),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 12. Tera Dispenser
      `CREATE TABLE IF NOT EXISTS tera (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        shift_id TEXT REFERENCES shifts(id),
        nozzle_id TEXT NOT NULL REFERENCES nozzles(id),
        product_id TEXT REFERENCES products(id),
        price INTEGER NOT NULL CHECK(price >= 0),
        tera_awal REAL NOT NULL CHECK(tera_awal >= 0),
        tera_akhir REAL NOT NULL CHECK(tera_akhir >= tera_awal),
        volume REAL NOT NULL CHECK(volume >= 0),
        selisih REAL NOT NULL DEFAULT 0,
        sales_amount INTEGER NOT NULL CHECK(sales_amount >= 0),
        officer TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Valid',
        transaction_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 13. Transaksi Operasional
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        product_id TEXT REFERENCES products(id),
        volume REAL DEFAULT 0,
        unit_price INTEGER DEFAULT 0,
        total INTEGER NOT NULL CHECK(total > 0),
        shift_id TEXT REFERENCES shifts(id),
        cashier TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Selesai' CHECK(status IN ('Pending', 'Selesai', 'Batal')),
        nozzle_id TEXT REFERENCES nozzles(id),
        tera_id TEXT REFERENCES tera(id),
        master_code_id TEXT REFERENCES master_codes(id),
        partner_id TEXT REFERENCES business_partners(id),
        payment_method TEXT CHECK(payment_method IS NULL OR payment_method IN ('Tunai', 'Piutang', 'Hutang', 'Transfer')),
        related_receivable_id TEXT,
        related_payable_id TEXT,
        cancelled_at TEXT,
        cancel_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 14. Jurnal Umum Header
      `CREATE TABLE IF NOT EXISTS journals (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        transaction_id TEXT REFERENCES transactions(id),
        evidence_no TEXT,
        trans_code TEXT,
        description TEXT NOT NULL,
        is_balanced INTEGER NOT NULL DEFAULT 1 CHECK(is_balanced IN (0, 1)),
        is_reversal INTEGER NOT NULL DEFAULT 0 CHECK(is_reversal IN (0, 1)),
        reverses_journal_id TEXT REFERENCES journals(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 15. Baris Jurnal Umum (Double Entry)
      `CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        journal_id TEXT NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        debit INTEGER NOT NULL DEFAULT 0 CHECK(debit >= 0),
        credit INTEGER NOT NULL DEFAULT 0 CHECK(credit >= 0),
        created_at TEXT NOT NULL,
        CONSTRAINT chk_journal_entry_single_side CHECK(
          (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
        )
      );`,

      // 16. Buku Pembantu Piutang Usaha
      `CREATE TABLE IF NOT EXISTS receivables (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES transactions(id),
        partner_id TEXT NOT NULL REFERENCES business_partners(id),
        amount INTEGER NOT NULL CHECK(amount > 0),
        outstanding INTEGER NOT NULL CHECK(outstanding >= 0),
        status TEXT NOT NULL CHECK(status IN ('Open', 'Partial', 'Paid', 'Batal')),
        date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CONSTRAINT chk_receivable_status_outstanding CHECK (
          CASE
            WHEN status = 'Batal' THEN (outstanding = 0)
            WHEN status = 'Paid' THEN (outstanding = 0)
            WHEN status = 'Open' THEN (outstanding = amount)
            WHEN status = 'Partial' THEN (outstanding > 0 AND outstanding < amount)
            ELSE 0
          END = 1
        )
      );`,

      // 17. Buku Pembantu Hutang Usaha
      `CREATE TABLE IF NOT EXISTS payables (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES transactions(id),
        partner_id TEXT NOT NULL REFERENCES business_partners(id),
        amount INTEGER NOT NULL CHECK(amount > 0),
        outstanding INTEGER NOT NULL CHECK(outstanding >= 0),
        status TEXT NOT NULL CHECK(status IN ('Open', 'Partial', 'Paid', 'Batal')),
        date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CONSTRAINT chk_payable_status_outstanding CHECK (
          CASE
            WHEN status = 'Batal' THEN (outstanding = 0)
            WHEN status = 'Paid' THEN (outstanding = 0)
            WHEN status = 'Open' THEN (outstanding = amount)
            WHEN status = 'Partial' THEN (outstanding > 0 AND outstanding < amount)
            ELSE 0
          END = 1
        )
      );`,

      // Indeks Pencarian & Integritas Relasional
      `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`,
      `CREATE INDEX IF NOT EXISTS idx_tanks_product ON tanks(product_id);`,
      `CREATE INDEX IF NOT EXISTS idx_nozzles_tank ON nozzles(tank_id);`,
      `CREATE INDEX IF NOT EXISTS idx_nozzles_product ON nozzles(product_id);`,
      `CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);`,
      `CREATE INDEX IF NOT EXISTS idx_pegawai_shift ON pegawai(shift_id);`,
      `CREATE INDEX IF NOT EXISTS idx_attendances_employee ON attendances(employee_id);`,
      `CREATE INDEX IF NOT EXISTS idx_attendances_shift ON attendances(shift_id);`,
      `CREATE INDEX IF NOT EXISTS idx_master_codes_category ON master_codes(category);`,
      `CREATE INDEX IF NOT EXISTS idx_master_codes_debit_acc ON master_codes(debit_account_id);`,
      `CREATE INDEX IF NOT EXISTS idx_master_codes_credit_acc ON master_codes(credit_account_id);`,
      `CREATE INDEX IF NOT EXISTS idx_tera_nozzle ON tera(nozzle_id);`,
      `CREATE INDEX IF NOT EXISTS idx_tera_shift ON tera(shift_id);`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id);`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_master_code ON transactions(master_code_id);`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_partner ON transactions(partner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_journals_transaction ON journals(transaction_id);`,
      `CREATE INDEX IF NOT EXISTS idx_journal_entries_journal ON journal_entries(journal_id);`,
      `CREATE INDEX IF NOT EXISTS idx_journal_entries_account ON journal_entries(account_id);`,
      `CREATE INDEX IF NOT EXISTS idx_receivables_transaction ON receivables(transaction_id);`,
      `CREATE INDEX IF NOT EXISTS idx_receivables_partner ON receivables(partner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payables_transaction ON payables(transaction_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payables_partner ON payables(partner_id);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_reversal_target ON journals(reverses_journal_id) WHERE reverses_journal_id IS NOT NULL;`,

      // Triggers Integritas Bisnis
      // T1: Hanya satu shift aktif global
      `CREATE TRIGGER IF NOT EXISTS trg_shifts_single_active_insert
      BEFORE INSERT ON shifts
      FOR EACH ROW
      WHEN NEW.status = 'Aktif'
      BEGIN
        SELECT CASE
          WHEN (SELECT COUNT(*) FROM shifts WHERE status = 'Aktif') > 0
          THEN RAISE(ABORT, 'Hanya boleh ada satu shift yang berstatus Aktif pada satu waktu')
        END;
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_shifts_single_active_update
      BEFORE UPDATE OF status ON shifts
      FOR EACH ROW
      WHEN NEW.status = 'Aktif' AND OLD.status != 'Aktif'
      BEGIN
        SELECT CASE
          WHEN (SELECT COUNT(*) FROM shifts WHERE status = 'Aktif' AND id != OLD.id) > 0
          THEN RAISE(ABORT, 'Hanya boleh ada satu shift yang berstatus Aktif pada satu waktu')
        END;
      END;`,

      // T2: Immutability transaksi Selesai & pembatalan sah
      `CREATE TRIGGER IF NOT EXISTS trg_transactions_enforce_immutability_when_selesai
      BEFORE UPDATE ON transactions
      FOR EACH ROW
      WHEN OLD.status = 'Selesai'
      BEGIN
        SELECT CASE
          WHEN NEW.status = 'Pending'
            THEN RAISE(ABORT, 'Transaksi yang sudah Selesai tidak boleh dikembalikan ke status Pending')
          WHEN NEW.status NOT IN ('Selesai', 'Batal')
            THEN RAISE(ABORT, 'Transaksi Selesai hanya dapat bertransisi ke status Batal melalui prosedur pembatalan')
          WHEN NEW.status = 'Selesai' AND (NEW.updated_at IS NOT OLD.updated_at)
            THEN RAISE(ABORT, 'Transaksi Selesai bersifat immutable dan updated_at tidak boleh diubah')
          WHEN NEW.status = 'Batal' AND (NEW.cancelled_at IS NULL OR NEW.cancel_reason IS NULL OR trim(NEW.cancel_reason) = '')
            THEN RAISE(ABORT, 'Pembatalan transaksi wajib menyertakan cancelled_at dan cancel_reason yang sah')
        END;

        SELECT CASE
          WHEN (NEW.code IS NOT OLD.code)
            OR (NEW.name IS NOT OLD.name)
            OR (NEW.category IS NOT OLD.category)
            OR (NEW.product_id IS NOT OLD.product_id)
            OR (NEW.volume IS NOT OLD.volume)
            OR (NEW.unit_price IS NOT OLD.unit_price)
            OR (NEW.total IS NOT OLD.total)
            OR (NEW.shift_id IS NOT OLD.shift_id)
            OR (NEW.cashier IS NOT OLD.cashier)
            OR (NEW.nozzle_id IS NOT OLD.nozzle_id)
            OR (NEW.tera_id IS NOT OLD.tera_id)
            OR (NEW.master_code_id IS NOT OLD.master_code_id)
            OR (NEW.partner_id IS NOT OLD.partner_id)
            OR (NEW.payment_method IS NOT OLD.payment_method)
            OR (NEW.date IS NOT OLD.date)
            OR (NEW.created_at IS NOT OLD.created_at)
            OR (NEW.id IS NOT OLD.id)
          THEN RAISE(ABORT, 'Data bisnis transaksi Selesai bersifat immutable dan tidak boleh diubah')
        END;
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_transactions_prevent_mutation_when_cancelled
      BEFORE UPDATE ON transactions
      FOR EACH ROW
      WHEN OLD.status = 'Batal'
      BEGIN
        SELECT RAISE(ABORT, 'Transaksi yang sudah berstatus Batal tidak dapat diubah');
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_transactions_prevent_delete
      BEFORE DELETE ON transactions
      FOR EACH ROW
      WHEN OLD.status IN ('Selesai', 'Batal')
      BEGIN
        SELECT RAISE(ABORT, 'Transaksi Selesai atau Batal tidak boleh dihapus untuk integritas audit trail');
      END;`,

      // T3: Validasi sumber jurnal & buku pembantu wajib merujuk transaksi Selesai
      `CREATE TRIGGER IF NOT EXISTS trg_journals_require_selesai_transaction
      BEFORE INSERT ON journals
      FOR EACH ROW
      WHEN NEW.transaction_id IS NOT NULL AND NEW.is_reversal = 0
      BEGIN
        SELECT CASE
          WHEN (SELECT status FROM transactions WHERE id = NEW.transaction_id) != 'Selesai'
            THEN RAISE(ABORT, 'Jurnal asli hanya boleh dibuat untuk transaksi yang berstatus Selesai')
        END;
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_receivables_require_selesai_transaction
      BEFORE INSERT ON receivables
      FOR EACH ROW
      BEGIN
        SELECT CASE
          WHEN (SELECT status FROM transactions WHERE id = NEW.transaction_id) != 'Selesai'
            THEN RAISE(ABORT, 'Piutang baru hanya boleh dibuat untuk transaksi yang berstatus Selesai')
        END;
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_payables_require_selesai_transaction
      BEFORE INSERT ON payables
      FOR EACH ROW
      BEGIN
        SELECT CASE
          WHEN (SELECT status FROM transactions WHERE id = NEW.transaction_id) != 'Selesai'
            THEN RAISE(ABORT, 'Hutang baru hanya boleh dibuat untuk transaksi yang berstatus Selesai')
        END;
      END;`,

      // T4: Fail-closed pembatalan piutang/hutang
      `CREATE TRIGGER IF NOT EXISTS trg_receivables_prevent_cancel_if_paid
      BEFORE UPDATE OF status ON receivables
      FOR EACH ROW
      WHEN NEW.status = 'Batal' AND (OLD.status IN ('Partial', 'Paid') OR OLD.outstanding < OLD.amount)
      BEGIN
        SELECT RAISE(ABORT, 'Faktur piutang yang sudah memiliki pembayaran tidak boleh dibatalkan langsung. Batalkan transaksi pelunasan terlebih dahulu');
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_payables_prevent_cancel_if_paid
      BEFORE UPDATE OF status ON payables
      FOR EACH ROW
      WHEN NEW.status = 'Batal' AND (OLD.status IN ('Partial', 'Paid') OR OLD.outstanding < OLD.amount)
      BEGIN
        SELECT RAISE(ABORT, 'Faktur hutang yang sudah memiliki pembayaran tidak boleh dibatalkan langsung. Batalkan transaksi pelunasan terlebih dahulu');
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_receivables_prevent_mutation_when_batal
      BEFORE UPDATE ON receivables
      FOR EACH ROW
      WHEN OLD.status = 'Batal'
      BEGIN
        SELECT RAISE(ABORT, 'Faktur piutang yang sudah Batal bersifat immutable dan tidak dapat diubah');
      END;`,

      `CREATE TRIGGER IF NOT EXISTS trg_payables_prevent_mutation_when_batal
      BEFORE UPDATE ON payables
      FOR EACH ROW
      WHEN OLD.status = 'Batal'
      BEGIN
        SELECT RAISE(ABORT, 'Faktur hutang yang sudah Batal bersifat immutable dan tidak dapat diubah');
      END;`
    ]
  },
  {
    version: 3,
    name: '003_shift_sessions_and_attendance_history',
    statements: [
      // 1. Tabel riwayat sesi shift aktual
      `CREATE TABLE IF NOT EXISTS shift_sessions (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL REFERENCES shifts(id),
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        operator TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Aktif', 'Tutup')),
        initial_cash INTEGER NOT NULL DEFAULT 0,
        total_sales INTEGER NOT NULL DEFAULT 0,
        cash_handover INTEGER NOT NULL DEFAULT 0,
        discrepancy INTEGER NOT NULL DEFAULT 0,
        closed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,

      // 2. Index pencarian sesi shift
      `CREATE INDEX IF NOT EXISTS idx_shift_sessions_shift_id ON shift_sessions(shift_id);`,
      `CREATE INDEX IF NOT EXISTS idx_shift_sessions_date ON shift_sessions(date);`,

      // 3. Garansi Engine Level: Maksimal hanya SATU sesi shift aktif secara global pada satu waktu
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_shift_session ON shift_sessions(status) WHERE status = 'Aktif';`,

      // 4. Garansi Engine Level: Satu pegawai hanya boleh memiliki satu record absensi per tanggal kalender
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_employee_date ON attendances(employee_id, date);`
    ]
  },
  {
    version: 4,
    name: '004_enforce_safe_cancellation',
    statements: [
      // Trigger perlindungan integritas: Tolak pembatalan transaksi yang sudah diposting ke jurnal akuntansi
      `CREATE TRIGGER IF NOT EXISTS trg_transactions_prevent_cancel_if_posted
      BEFORE UPDATE OF status ON transactions
      FOR EACH ROW
      WHEN NEW.status = 'Batal' AND (SELECT COUNT(*) FROM journals WHERE transaction_id = OLD.id) > 0
      BEGIN
        SELECT RAISE(ABORT, 'Transaksi yang sudah diposting ke jurnal akuntansi tidak dapat dibatalkan secara langsung tanpa prosedur pembalikan');
      END;`
    ]
  },
  {
    version: 5,
    name: '005_add_city_to_station_info',
    statements: [
      // Tambahkan kolom city pada station_info untuk pengaturan kota tanda tangan laporan
      `ALTER TABLE station_info ADD COLUMN city TEXT;`
    ]
  }
];

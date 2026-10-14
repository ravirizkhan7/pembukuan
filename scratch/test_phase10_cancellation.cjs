const initSqlJs = require('sql.js');

async function testCancellationIntegrity() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  console.log('--- TEST A: TRANSACTION CANCELLATION INTEGRITY ---');

  // Load migration DDL
  // Create schema matching v1-v3 + v4 trigger
  db.run(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      normal_balance TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE shifts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      operator TEXT,
      initial_cash REAL NOT NULL DEFAULT 0,
      total_sales REAL NOT NULL DEFAULT 0,
      cash_handover REAL NOT NULL DEFAULT 0,
      discrepancy REAL,
      status TEXT NOT NULL DEFAULT 'Menunggu'
    );

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      product_id TEXT,
      volume REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      shift_id TEXT REFERENCES shifts(id),
      cashier TEXT,
      status TEXT NOT NULL DEFAULT 'Selesai' CHECK(status IN ('Pending', 'Selesai', 'Batal')),
      payment_method TEXT,
      cancelled_at TEXT,
      cancel_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE journals (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      transaction_id TEXT REFERENCES transactions(id),
      evidence_no TEXT,
      trans_code TEXT,
      description TEXT NOT NULL,
      is_balanced INTEGER NOT NULL DEFAULT 1,
      is_reversal INTEGER NOT NULL DEFAULT 0,
      reverses_journal_id TEXT REFERENCES journals(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TRIGGER trg_transactions_prevent_cancel_if_posted
    BEFORE UPDATE OF status ON transactions
    FOR EACH ROW
    WHEN NEW.status = 'Batal' AND (SELECT COUNT(*) FROM journals WHERE transaction_id = OLD.id) > 0
    BEGIN
      SELECT RAISE(ABORT, 'Transaksi yang sudah diposting ke jurnal akuntansi tidak dapat dibatalkan secara langsung tanpa pembalikan');
    END;
  `);

  // Seed sample data
  db.run(`INSERT INTO accounts (id, code, name, category, normal_balance, balance) VALUES ('1-1001', '1-1001', 'Kas Utama', 'Aset', 'Debit', 100000);`);
  db.run(`INSERT INTO shifts (id, name, operator, status, total_sales) VALUES ('SH-01', 'Shift Pagi', 'Budi', 'Aktif', 100000);`);
  db.run(`INSERT INTO transactions (id, date, code, name, category, total, shift_id, status, created_at, updated_at) VALUES ('TX-POSTED', '2026-10-14', '303', 'Penjualan Pertalite', 'Penjualan', 100000, 'SH-01', 'Selesai', '2026-10-14 08:00:00', '2026-10-14 08:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, description, created_at, updated_at) VALUES ('JRN-01', '2026-10-14', 'TX-POSTED', 'Jurnal Penjualan', '2026-10-14 08:00:00', '2026-10-14 08:00:00');`);

  // Test 1: Try cancelling TX-POSTED -> MUST FAIL
  let failed = false;
  try {
    db.run(`UPDATE transactions SET status = 'Batal', cancelled_at = '2026-10-14 09:00:00', cancel_reason = 'Salah input', updated_at = '2026-10-14 09:00:00' WHERE id = 'TX-POSTED';`);
  } catch (err) {
    failed = true;
    console.log('✅ PASS: Cancellation of posted transaction aborted by trigger:', err.message);
  }
  if (!failed) {
    throw new Error('FAIL: Trigger should have rejected cancellation of posted transaction!');
  }

  // Verify TX-POSTED is still 'Selesai'
  const res = db.exec(`SELECT status FROM transactions WHERE id = 'TX-POSTED';`);
  const status = res[0].values[0][0];
  if (status !== 'Selesai') throw new Error('FAIL: Transaction status was modified!');
  console.log('✅ PASS: Transaction status remains Selesai');

  // Test 2: Unposted transaction can be cancelled
  db.run(`INSERT INTO transactions (id, date, code, name, category, total, status, created_at, updated_at) VALUES ('TX-UNPOSTED', '2026-10-14', '999', 'Draft', 'Lainnya', 50000, 'Selesai', '2026-10-14 08:00:00', '2026-10-14 08:00:00');`);
  db.run(`UPDATE transactions SET status = 'Batal', cancelled_at = '2026-10-14 09:00:00', cancel_reason = 'Batal draft', updated_at = '2026-10-14 09:00:00' WHERE id = 'TX-UNPOSTED';`);
  const res2 = db.exec(`SELECT status, cancel_reason FROM transactions WHERE id = 'TX-UNPOSTED';`);
  if (res2[0].values[0][0] !== 'Batal') throw new Error('FAIL: Unposted transaction should be cancelled!');
  console.log('✅ PASS: Unposted transaction cancelled safely');
}

testCancellationIntegrity().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

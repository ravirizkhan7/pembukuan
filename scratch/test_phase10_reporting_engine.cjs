const initSqlJs = require('sql.js');

async function testReportingEngine() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  console.log('--- TEST B: REPORTING ENGINE SQL CALCULATIONS ---');

  // Create full schema
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

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE tanks (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      product_id TEXT REFERENCES products(id),
      capacity REAL NOT NULL DEFAULT 0,
      current_stock REAL NOT NULL DEFAULT 0
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
      product_id TEXT REFERENCES products(id),
      volume REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      shift_id TEXT REFERENCES shifts(id),
      cashier TEXT,
      status TEXT NOT NULL DEFAULT 'Selesai',
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

    CREATE TABLE journal_entries (
      id TEXT PRIMARY KEY,
      journal_id TEXT NOT NULL REFERENCES journals(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // 1. Seed Accounts with 0 balance (Standard COA)
  const coa = [
    { id: '1-1001', code: '1-1001', name: 'Kas Utama (Brankas)', category: 'Aset', normal: 'Debit' },
    { id: '1-1002', code: '1-1002', name: 'Bank Mandiri Operasional', category: 'Aset', normal: 'Debit' },
    { id: '1-1101', code: '1-1101', name: 'Piutang Usaha', category: 'Aset', normal: 'Debit' },
    { id: '1-1201', code: '1-1201', name: 'Persediaan BBM Pertalite', category: 'Aset', normal: 'Debit' },
    { id: '1-1202', code: '1-1202', name: 'Persediaan BBM Pertamax', category: 'Aset', normal: 'Debit' },
    { id: '2-1001', code: '2-1001', name: 'Hutang Usaha (Pertamina)', category: 'Kewajiban', normal: 'Kredit' },
    { id: '3-1001', code: '3-1001', name: 'Modal Pemilik SPBU', category: 'Ekuitas', normal: 'Kredit' },
    { id: '3-2001', code: '3-2001', name: 'Laba Ditahan', category: 'Ekuitas', normal: 'Kredit' },
    { id: '4-1001', code: '4-1001', name: 'Pendapatan Penjualan Pertalite', category: 'Pendapatan', normal: 'Kredit' },
    { id: '4-1002', code: '4-1002', name: 'Pendapatan Penjualan Pertamax', category: 'Pendapatan', normal: 'Kredit' },
    { id: '5-1001', code: '5-1001', name: 'HPP Pertalite', category: 'Beban Pokok', normal: 'Debit' },
    { id: '6-1001', code: '6-1001', name: 'Biaya Gaji & Upah Karyawan', category: 'Beban', normal: 'Debit' }
  ];

  for (const a of coa) {
    db.run(
      `INSERT INTO accounts (id, code, name, category, normal_balance, balance) VALUES (?, ?, ?, ?, ?, 0);`,
      [a.id, a.code, a.name, a.category, a.normal]
    );
  }

  // Seed Products and Tanks
  db.run(`INSERT INTO products (id, code, name, price, cost_price) VALUES ('PRD-01', 'PRD-01', 'Pertalite', 10000, 9650);`);
  db.run(`INSERT INTO tanks (id, code, name, product_id, capacity, current_stock) VALUES ('TNK-01', 'TNK-01', 'Tanki Pertalite', 'PRD-01', 20000, 5000);`);

  // Seed Shifts
  db.run(`INSERT INTO shifts (id, name, operator, initial_cash, total_sales, status) VALUES ('SH-01', 'Shift 1 Pagi', 'Budi', 500000, 0, 'Aktif');`);

  // --- SCENARIO 1: TEST EMPTY DATABASE REPORTS ---
  console.log('Testing Empty Database Reports...');
  // Query debit/credit mutasi per account
  const emptyRes = db.exec(`
    SELECT a.id, a.code, a.name, a.category, a.normal_balance,
           COALESCE(SUM(je.debit), 0) AS total_debit,
           COALESCE(SUM(je.credit), 0) AS total_credit
    FROM accounts a
    LEFT JOIN journal_entries je ON a.id = je.account_id
    GROUP BY a.id;
  `);

  let totalAset = 0, totalKewajiban = 0, totalEkuitas = 0, totalRev = 0, totalExp = 0;
  for (const row of emptyRes[0].values) {
    const [_id, _code, _name, category, normal, deb, cred] = row;
    const bal = normal === 'Debit' ? deb - cred : cred - deb;
    if (category === 'Aset') totalAset += bal;
    else if (category === 'Kewajiban') totalKewajiban += bal;
    else if (category === 'Ekuitas') totalEkuitas += bal;
    else if (category === 'Pendapatan') totalRev += bal;
    else if (category === 'Beban' || category === 'Beban Pokok') totalExp += bal;
  }
  const labaBerjalan = totalRev - totalExp;
  const totalPasiva = totalKewajiban + totalEkuitas + labaBerjalan;

  if (totalAset !== 0 || totalPasiva !== 0 || totalAset !== totalPasiva) {
    throw new Error(`FAIL: Empty DB Neraca not 0: Aset=${totalAset}, Pasiva=${totalPasiva}`);
  }
  console.log('✅ PASS: Empty database generates valid 0-balanced Neraca (Aset=0, Pasiva=0)');

  // --- SCENARIO 2: POST ACTUAL TRANSACTIONS & JOURNALS ---
  console.log('Posting transactions across different payment methods and dates...');

  // Tx 1: Penjualan Tunai Pertalite Rp 200.000 (20 Liter) on 2026-08-15
  db.run(`INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-01', '2026-08-15 10:00:00', '303', 'Penjualan Pertalite Tunai', 'Penjualan', 'PRD-01', 20, 10000, 200000, 'SH-01', 'Budi', 'Selesai', 'Tunai', '2026-08-15 10:00:00', '2026-08-15 10:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-01', '2026-08-15', 'TX-01', 'BKT/01', '303', 'Penjualan Pertalite Tunai', 1, '2026-08-15 10:00:00', '2026-08-15 10:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-01', 'JRN-01', '1-1001', 200000, 0, '2026-08-15 10:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-02', 'JRN-01', '4-1001', 0, 200000, '2026-08-15 10:00:00');`);
  db.run(`UPDATE accounts SET balance = balance + 200000 WHERE id = '1-1001';`);
  db.run(`UPDATE accounts SET balance = balance + 200000 WHERE id = '4-1001';`);

  // Tx 2: Penjualan Kredit (Piutang) Pertalite Rp 150.000 (15 Liter) on 2026-08-20
  db.run(`INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-02', '2026-08-20 11:00:00', '310', 'Penjualan Pertalite Kredit', 'Penjualan', 'PRD-01', 15, 10000, 150000, 'SH-01', 'Budi', 'Selesai', 'Piutang', '2026-08-20 11:00:00', '2026-08-20 11:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-02', '2026-08-20', 'TX-02', 'BKT/02', '310', 'Penjualan Pertalite Kredit', 1, '2026-08-20 11:00:00', '2026-08-20 11:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-03', 'JRN-02', '1-1101', 150000, 0, '2026-08-20 11:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-04', 'JRN-02', '4-1001', 0, 150000, '2026-08-20 11:00:00');`);
  db.run(`UPDATE accounts SET balance = balance + 150000 WHERE id = '1-1101';`);
  db.run(`UPDATE accounts SET balance = balance + 150000 WHERE id = '4-1001';`);

  // Tx 3: Biaya Gaji Rp 50.000 Tunai Kas on 2026-08-25
  db.run(`INSERT INTO transactions (id, date, code, name, category, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-03', '2026-08-25 15:00:00', '306', 'Biaya Gaji', 'Biaya Operasional', 50000, 'SH-01', 'Budi', 'Selesai', 'Tunai', '2026-08-25 15:00:00', '2026-08-25 15:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-03', '2026-08-25', 'TX-03', 'BKT/03', '306', 'Biaya Gaji', 1, '2026-08-25 15:00:00', '2026-08-25 15:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-05', 'JRN-03', '6-1001', 50000, 0, '2026-08-25 15:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-06', 'JRN-03', '1-1001', 0, 50000, '2026-08-25 15:00:00');`);
  db.run(`UPDATE accounts SET balance = balance + 50000 WHERE id = '6-1001';`);
  db.run(`UPDATE accounts SET balance = balance - 50000 WHERE id = '1-1001';`);

  // Tx 4: Penjualan Pertalite on 2026-09-10 (Bulan September!) Rp 300.000 Tunai
  db.run(`INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-04', '2026-09-10 10:00:00', '303', 'Penjualan September', 'Penjualan', 'PRD-01', 30, 10000, 300000, 'SH-01', 'Budi', 'Selesai', 'Tunai', '2026-09-10 10:00:00', '2026-09-10 10:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-04', '2026-09-10', 'TX-04', 'BKT/04', '303', 'Penjualan September', 1, '2026-09-10 10:00:00', '2026-09-10 10:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-07', 'JRN-04', '1-1001', 300000, 0, '2026-09-10 10:00:00');`);
  db.run(`INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
          VALUES ('JE-08', 'JRN-04', '4-1001', 0, 300000, '2026-09-10 10:00:00');`);
  db.run(`UPDATE accounts SET balance = balance + 300000 WHERE id = '1-1001';`);
  db.run(`UPDATE accounts SET balance = balance + 300000 WHERE id = '4-1001';`);

  // Update shift sales
  db.run(`UPDATE shifts SET total_sales = 650000 WHERE id = 'SH-01';`);

  // --- SCENARIO 3: VERIFY ALL-TIME NERACA BALANCE ---
  console.log('Testing All-Time Neraca Balance...');
  const allRes = db.exec(`
    SELECT a.id, a.code, a.name, a.category, a.normal_balance, a.balance,
           COALESCE(SUM(je.debit), 0) AS total_debit,
           COALESCE(SUM(je.credit), 0) AS total_credit
    FROM accounts a
    LEFT JOIN journal_entries je ON a.id = je.account_id
    GROUP BY a.id;
  `);

  totalAset = 0; totalKewajiban = 0; totalEkuitas = 0; totalRev = 0; totalExp = 0;
  for (const row of allRes[0].values) {
    const [_id, code, _name, category, normal, storedBal, deb, cred] = row;
    const calcBal = normal === 'Debit' ? deb - cred : cred - deb;
    if (storedBal !== calcBal) {
      throw new Error(`FAIL: Stored balance (${storedBal}) !== Calculated balance (${calcBal}) for account ${code}`);
    }
    if (category === 'Aset') totalAset += calcBal;
    else if (category === 'Kewajiban') totalKewajiban += calcBal;
    else if (category === 'Ekuitas') totalEkuitas += calcBal;
    else if (category === 'Pendapatan') totalRev += calcBal;
    else if (category === 'Beban' || category === 'Beban Pokok') totalExp += calcBal;
  }
  const labaAll = totalRev - totalExp;
  const pasivaAll = totalKewajiban + totalEkuitas + labaAll;

  console.log(`Total Aset: Rp ${totalAset.toLocaleString('id-ID')}`);
  console.log(`Total Kewajiban: Rp ${totalKewajiban.toLocaleString('id-ID')}`);
  console.log(`Total Ekuitas: Rp ${totalEkuitas.toLocaleString('id-ID')}`);
  console.log(`Laba Bersih: Rp ${labaAll.toLocaleString('id-ID')}`);
  console.log(`Total Pasiva: Rp ${pasivaAll.toLocaleString('id-ID')}`);

  if (totalAset !== pasivaAll) {
    throw new Error(`FAIL: Neraca out of balance! Aset: ${totalAset}, Pasiva: ${pasivaAll}`);
  }
  console.log('✅ PASS: Neraca is perfectly balanced (Total Aset == Total Kewajiban + Ekuitas + Laba)');

  // --- SCENARIO 4: VERIFY PERIOD FILTER (AGUSTUS 2026: 2026-08-01 s/d 2026-08-31) ---
  console.log('Testing Period Filter (August 2026 only)...');
  const augRes = db.exec(`
    SELECT a.id, a.code, a.category, a.normal_balance,
           COALESCE(SUM(CASE WHEN j.date >= '2026-08-01' AND j.date <= '2026-08-31' THEN je.debit ELSE 0 END), 0) AS aug_debit,
           COALESCE(SUM(CASE WHEN j.date >= '2026-08-01' AND j.date <= '2026-08-31' THEN je.credit ELSE 0 END), 0) AS aug_credit
    FROM accounts a
    LEFT JOIN journal_entries je ON a.id = je.account_id
    LEFT JOIN journals j ON je.journal_id = j.id
    GROUP BY a.id;
  `);

  let augRev = 0, augExp = 0;
  for (const row of augRes[0].values) {
    const [_id, _code, category, normal, deb, cred] = row;
    const bal = normal === 'Debit' ? deb - cred : cred - deb;
    if (category === 'Pendapatan') augRev += bal;
    if (category === 'Beban' || category === 'Beban Pokok') augExp += bal;
  }

  // TX-01 (200k) + TX-02 (150k) = 350k. TX-04 (300k on Sept) must NOT be included!
  if (augRev !== 350000) {
    throw new Error(`FAIL: August revenue should be 350.000, got ${augRev}`);
  }
  if (augExp !== 50000) {
    throw new Error(`FAIL: August expense should be 50.000, got ${augExp}`);
  }
  console.log('✅ PASS: Period filter successfully isolates August transactions (Rev=350k, Exp=50k, September excluded)');

  // --- SCENARIO 5: VERIFY CASH FLOW DISTINCTION ---
  console.log('Testing Cash Flow vs Credit Sales...');
  // Cash inflow in August:
  // Kas Utama debited in August: 200.000 (from TX-01 Tunai). TX-02 Piutang does NOT debit Kas Utama!
  const kasRes = db.exec(`
    SELECT COALESCE(SUM(je.debit), 0) AS cash_in,
           COALESCE(SUM(je.credit), 0) AS cash_out
    FROM journal_entries je
    JOIN journals j ON je.journal_id = j.id
    WHERE je.account_id = '1-1001' AND j.date >= '2026-08-01' AND j.date <= '2026-08-31';
  `);
  const cashIn = kasRes[0].values[0][0];
  const cashOut = kasRes[0].values[0][1];

  if (cashIn !== 200000) {
    throw new Error(`FAIL: August cash inflow should be 200.000 (physical cash only), got ${cashIn}`);
  }
  if (cashOut !== 50000) {
    throw new Error(`FAIL: August cash outflow should be 50.000, got ${cashOut}`);
  }
  console.log('✅ PASS: Cash flow does not confuse credit sales (Piutang) with physical cash');

  // --- SCENARIO 6: VERIFY STOCK & SALES RECAP ---
  console.log('Testing Stock & Sales Recap...');
  const stockRes = db.exec(`
    SELECT p.code, p.name,
           COALESCE(SUM(t.current_stock), 0) AS tank_stock,
           COALESCE(SUM(t.capacity), 0) AS tank_cap,
           (SELECT COALESCE(SUM(tx.volume), 0) FROM transactions tx WHERE tx.product_id = p.id AND tx.category = 'Pembelian' AND tx.status = 'Selesai') AS beli,
           (SELECT COALESCE(SUM(tx.volume), 0) FROM transactions tx WHERE tx.product_id = p.id AND tx.category = 'Penjualan' AND tx.status = 'Selesai') AS jual
    FROM products p
    LEFT JOIN tanks t ON p.id = t.product_id
    GROUP BY p.id;
  `);

  const [_pCode, pName, stockAwal, cap, beli, jual] = stockRes[0].values[0];
  console.log(`Product: ${pName}, Cap: ${cap}L, Stock Awal: ${stockAwal}L, Beli: ${beli}L, Jual: ${jual}L`);
  // Jual: TX-01 (20L) + TX-02 (15L) + TX-04 (30L) = 65L
  if (jual !== 65) {
    throw new Error(`FAIL: Total sales volume should be 65L, got ${jual}L`);
  }
  const stockAkhir = stockAwal + beli - jual;
  console.log(`Stock Akhir: ${stockAkhir}L (${((stockAkhir / cap) * 100).toFixed(1)}%)`);
  console.log('✅ PASS: Stock and sales volume correctly calculated from SQLite');
}

testReportingEngine().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

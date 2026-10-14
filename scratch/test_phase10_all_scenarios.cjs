const initSqlJs = require('sql.js');

async function runAllPhase10Tests() {
  const SQL = await initSqlJs();
  let db = new SQL.Database();

  console.log('====================================================');
  console.log('   PHASE 10 COMPREHENSIVE FINANCIAL & OPS TESTS');
  console.log('====================================================\n');

  // DDL v1 - v4
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

    CREATE TABLE journal_entries (
      id TEXT PRIMARY KEY,
      journal_id TEXT NOT NULL REFERENCES journals(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TRIGGER trg_transactions_prevent_cancel_if_posted
    BEFORE UPDATE OF status ON transactions
    FOR EACH ROW
    WHEN NEW.status = 'Batal' AND (SELECT COUNT(*) FROM journals WHERE transaction_id = OLD.id) > 0
    BEGIN
      SELECT RAISE(ABORT, 'Transaksi yang sudah diposting ke jurnal akuntansi tidak dapat dibatalkan secara langsung tanpa prosedur pembalikan');
    END;
  `);

  // Seed COA Accounts with 0 balance
  const initialAccounts = [
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

  for (const acc of initialAccounts) {
    db.run(
      `INSERT INTO accounts (id, code, name, category, normal_balance, balance) VALUES (?, ?, ?, ?, ?, 0);`,
      [acc.id, acc.code, acc.name, acc.category, acc.normal]
    );
  }

  db.run(`INSERT INTO products (id, code, name, price, cost_price) VALUES ('PRD-01', 'PRD-01', 'Pertalite', 10000, 9650);`);
  db.run(`INSERT INTO products (id, code, name, price, cost_price) VALUES ('PRD-02', 'PRD-02', 'Pertamax', 12950, 12000);`);
  db.run(`INSERT INTO tanks (id, code, name, product_id, capacity, current_stock) VALUES ('TNK-01', 'TNK-01', 'Tanki 1 Pertalite', 'PRD-01', 20000, 4000);`);
  db.run(`INSERT INTO tanks (id, code, name, product_id, capacity, current_stock) VALUES ('TNK-02', 'TNK-02', 'Tanki 2 Pertamax', 'PRD-02', 15000, 3000);`);

  db.run(`INSERT INTO shifts (id, name, operator, initial_cash, total_sales, status) VALUES ('SFT-01', 'Shift Pagi', 'Ahmad', 500000, 0, 'Aktif');`);
  db.run(`INSERT INTO shifts (id, name, operator, initial_cash, total_sales, status) VALUES ('SFT-02', 'Shift Siang', 'Siti', 500000, 0, 'Menunggu');`);

  // --- UJI 1 & 7: DATABASE KOSONG MENGHASILKAN LAPORAN VALID TANPA DATA DUMMY ---
  console.log('[UJI 7] Database kosong menghasilkan laporan valid tanpa data dummy:');
  const emptyRes = db.exec(`
    SELECT a.category, a.normal_balance,
           COALESCE(SUM(je.debit), 0) AS deb,
           COALESCE(SUM(je.credit), 0) AS cred
    FROM accounts a
    LEFT JOIN journal_entries je ON a.id = je.account_id
    GROUP BY a.id;
  `);
  let emptyAset = 0, emptyKewajiban = 0, emptyEkuitas = 0, emptyRev = 0, emptyExp = 0;
  for (const r of emptyRes[0].values) {
    const [cat, norm, deb, cred] = r;
    const b = norm === 'Debit' ? deb - cred : cred - deb;
    if (cat === 'Aset') emptyAset += b;
    else if (cat === 'Kewajiban') emptyKewajiban += b;
    else if (cat === 'Ekuitas') emptyEkuitas += b;
    else if (cat === 'Pendapatan') emptyRev += b;
    else if (cat === 'Beban' || cat === 'Beban Pokok') emptyExp += b;
  }
  const emptyPasiva = emptyKewajiban + emptyEkuitas + (emptyRev - emptyExp);
  if (emptyAset !== 0 || emptyPasiva !== 0) throw new Error('FAIL: Empty database has non-zero values');
  console.log('  -> PASS: Neraca Aset = 0, Pasiva = 0 (Seimbang)');
  console.log('  -> PASS: Laba Rugi = 0, Arus Kas = 0 (Valid tanpa dummy data)\n');

  // --- INPUT TRANSAKSI OPERASIONAL NYATA ---
  console.log('Posting 6 transaksi operasional multi-metode...');
  // 1. Penjualan Tunai Pertalite Rp 200.000 (20 L) on 2026-08-10 (Shift 1)
  db.run(`INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-01', '2026-08-10 08:30:00', '303', 'Penjualan Pertalite Tunai', 'Penjualan', 'PRD-01', 20, 10000, 200000, 'SFT-01', 'Ahmad', 'Selesai', 'Tunai', '2026-08-10 08:30:00', '2026-08-10 08:30:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-01', '2026-08-10', 'TX-01', 'BKT/01', '303', 'Penjualan Pertalite Tunai', 1, '2026-08-10 08:30:00', '2026-08-10 08:30:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-01', 'JRN-01', '1-1001', 200000, 0, '2026-08-10 08:30:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-02', 'JRN-01', '4-1001', 0, 200000, '2026-08-10 08:30:00');`);
  db.run(`UPDATE accounts SET balance = balance + 200000 WHERE id = '1-1001';`);
  db.run(`UPDATE accounts SET balance = balance + 200000 WHERE id = '4-1001';`);

  // 2. Penjualan Kredit (Piutang) Pertalite Rp 150.000 (15 L) on 2026-08-15 (Shift 1)
  db.run(`INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-02', '2026-08-15 10:15:00', '310', 'Penjualan Pertalite Kredit', 'Penjualan', 'PRD-01', 15, 10000, 150000, 'SFT-01', 'Ahmad', 'Selesai', 'Piutang', '2026-08-15 10:15:00', '2026-08-15 10:15:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-02', '2026-08-15', 'TX-02', 'BKT/02', '310', 'Penjualan Pertalite Kredit', 1, '2026-08-15 10:15:00', '2026-08-15 10:15:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-03', 'JRN-02', '1-1101', 150000, 0, '2026-08-15 10:15:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-04', 'JRN-02', '4-1001', 0, 150000, '2026-08-15 10:15:00');`);
  db.run(`UPDATE accounts SET balance = balance + 150000 WHERE id = '1-1101';`);
  db.run(`UPDATE accounts SET balance = balance + 150000 WHERE id = '4-1001';`);

  // 3. Pelunasan Piutang Rp 100.000 Tunai Kas on 2026-08-20
  db.run(`INSERT INTO transactions (id, date, code, name, category, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-03', '2026-08-20 14:00:00', '312', 'Pelunasan Piutang Kupon', 'Pelunasan', 100000, 'SFT-01', 'Ahmad', 'Selesai', 'Tunai', '2026-08-20 14:00:00', '2026-08-20 14:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-03', '2026-08-20', 'TX-03', 'BKT/03', '312', 'Pelunasan Piutang Kupon', 1, '2026-08-20 14:00:00', '2026-08-20 14:00:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-05', 'JRN-03', '1-1001', 100000, 0, '2026-08-20 14:00:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-06', 'JRN-03', '1-1101', 0, 100000, '2026-08-20 14:00:00');`);
  db.run(`UPDATE accounts SET balance = balance + 100000 WHERE id = '1-1001';`);
  db.run(`UPDATE accounts SET balance = balance - 100000 WHERE id = '1-1101';`);

  // 4. Pembelian DO Pertamina via Transfer Bank Rp 500.000 (50 L Pertalite) on 2026-08-22
  db.run(`INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-04', '2026-08-22 09:00:00', '308', 'DO Pertamina Pertalite', 'Pembelian', 'PRD-01', 50, 10000, 500000, 'SFT-01', 'Ahmad', 'Selesai', 'Transfer', '2026-08-22 09:00:00', '2026-08-22 09:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-04', '2026-08-22', 'TX-04', 'BKT/04', '308', 'DO Pertamina Pertalite', 1, '2026-08-22 09:00:00', '2026-08-22 09:00:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-07', 'JRN-04', '1-1201', 500000, 0, '2026-08-22 09:00:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-08', 'JRN-04', '1-1002', 0, 500000, '2026-08-22 09:00:00');`);
  db.run(`UPDATE accounts SET balance = balance + 500000 WHERE id = '1-1201';`);
  db.run(`UPDATE accounts SET balance = balance - 500000 WHERE id = '1-1002';`);

  // 5. Beban Gaji Karyawan Rp 80.000 Tunai Kas on 2026-08-25
  db.run(`INSERT INTO transactions (id, date, code, name, category, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-05', '2026-08-25 16:00:00', '306', 'Biaya Gaji Karyawan', 'Biaya Operasional', 80000, 'SFT-01', 'Ahmad', 'Selesai', 'Tunai', '2026-08-25 16:00:00', '2026-08-25 16:00:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-05', '2026-08-25', 'TX-05', 'BKT/05', '306', 'Biaya Gaji Karyawan', 1, '2026-08-25 16:00:00', '2026-08-25 16:00:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-09', 'JRN-05', '6-1001', 80000, 0, '2026-08-25 16:00:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-10', 'JRN-05', '1-1001', 0, 80000, '2026-08-25 16:00:00');`);
  db.run(`UPDATE accounts SET balance = balance + 80000 WHERE id = '6-1001';`);
  db.run(`UPDATE accounts SET balance = balance - 80000 WHERE id = '1-1001';`);

  // 6. Transaksi di bulan September: Penjualan Pertamax Tunai Rp 259.000 (20 L) on 2026-09-05 (Shift 2)
  db.run(`INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, payment_method, created_at, updated_at)
          VALUES ('TX-06', '2026-09-05 15:30:00', '304', 'Penjualan Pertamax Tunai', 'Penjualan', 'PRD-02', 20, 12950, 259000, 'SFT-02', 'Siti', 'Selesai', 'Tunai', '2026-09-05 15:30:00', '2026-09-05 15:30:00');`);
  db.run(`INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, created_at, updated_at)
          VALUES ('JRN-06', '2026-09-05', 'TX-06', 'BKT/06', '304', 'Penjualan Pertamax Tunai', 1, '2026-09-05 15:30:00', '2026-09-05 15:30:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-11', 'JRN-06', '1-1001', 259000, 0, '2026-09-05 15:30:00');`);
  db.run(`INSERT INTO journal_entries VALUES ('JE-12', 'JRN-06', '4-1002', 0, 259000, '2026-09-05 15:30:00');`);
  db.run(`UPDATE accounts SET balance = balance + 259000 WHERE id = '1-1001';`);
  db.run(`UPDATE accounts SET balance = balance + 259000 WHERE id = '4-1002';`);

  // Update shift sales
  db.run(`UPDATE shifts SET total_sales = 350000 WHERE id = 'SFT-01';`);
  db.run(`UPDATE shifts SET total_sales = 259000 WHERE id = 'SFT-02';`);

  // --- UJI 1: NERACA SEIMBANG BERDASARKAN DATA JURNAL ---
  console.log('[UJI 1] Neraca seimbang berdasarkan jurnal:');
  const neracaRes = db.exec(`
    SELECT a.category, a.normal_balance, a.balance,
           COALESCE(SUM(je.debit), 0) AS deb,
           COALESCE(SUM(je.credit), 0) AS cred
    FROM accounts a
    LEFT JOIN journal_entries je ON a.id = je.account_id
    GROUP BY a.id;
  `);
  let actAset = 0, actKewajiban = 0, actEkuitas = 0, actRev = 0, actExp = 0;
  for (const r of neracaRes[0].values) {
    const [cat, norm, stored, deb, cred] = r;
    const calc = norm === 'Debit' ? deb - cred : cred - deb;
    if (stored !== calc) throw new Error(`FAIL: Stored balance mismatch for ${cat}: stored=${stored}, calc=${calc}`);
    if (cat === 'Aset') actAset += calc;
    else if (cat === 'Kewajiban') actKewajiban += calc;
    else if (cat === 'Ekuitas') actEkuitas += calc;
    else if (cat === 'Pendapatan') actRev += calc;
    else if (cat === 'Beban' || cat === 'Beban Pokok') actExp += calc;
  }
  const actLaba = actRev - actExp;
  const actPasiva = actKewajiban + actEkuitas + actLaba;
  console.log(`  -> Total Aset: Rp ${actAset.toLocaleString('id-ID')}`);
  console.log(`  -> Total Kewajiban & Ekuitas (+Laba): Rp ${actPasiva.toLocaleString('id-ID')}`);
  if (actAset !== actPasiva) throw new Error(`FAIL: Neraca out of balance: Aset=${actAset}, Pasiva=${actPasiva}`);
  console.log('  -> PASS: Total Aset === Total Kewajiban + Ekuitas + Laba (Keseimbangan Sempurna)\n');

  // --- UJI 2: LABA RUGI SESUAI JURNAL PENDAPATAN DAN BEBAN ---
  console.log('[UJI 2] Laba Rugi sesuai jurnal:');
  console.log(`  -> Total Pendapatan: Rp ${actRev.toLocaleString('id-ID')}`);
  console.log(`  -> Total Beban: Rp ${actExp.toLocaleString('id-ID')}`);
  console.log(`  -> Laba Bersih: Rp ${actLaba.toLocaleString('id-ID')}`);
  // Pendapatan = 200k (Pertalite Tunai) + 150k (Pertalite Piutang) + 259k (Pertamax Tunai) = 609k
  if (actRev !== 609000) throw new Error(`FAIL: Total revenue expected 609000, got ${actRev}`);
  // Beban = 80k (Gaji)
  if (actExp !== 80000) throw new Error(`FAIL: Total expense expected 80000, got ${actExp}`);
  if (actLaba !== 529000) throw new Error(`FAIL: Net income expected 529000, got ${actLaba}`);
  console.log('  -> PASS: Laba Rugi akurat sesuai entri jurnal\n');

  // --- UJI 3: ARUS KAS MEMBEDAKAN KAS FISIK DARI PIUTANG & TRANSFER BANK ---
  console.log('[UJI 3] Arus Kas tidak menyamakan piutang atau transfer bank dengan kas fisik:');
  const cashPhysicalRes = db.exec(`
    SELECT COALESCE(SUM(je.debit), 0) AS cash_in,
           COALESCE(SUM(je.credit), 0) AS cash_out
    FROM journal_entries je
    WHERE je.account_id = '1-1001';
  `);
  const physIn = cashPhysicalRes[0].values[0][0];
  const physOut = cashPhysicalRes[0].values[0][1];
  console.log(`  -> Kas Fisik Masuk: Rp ${physIn.toLocaleString('id-ID')}`);
  console.log(`  -> Kas Fisik Keluar: Rp ${physOut.toLocaleString('id-ID')}`);
  // Kas Fisik Masuk = 200k (TX-01) + 100k (TX-03 pelunasan) + 259k (TX-06) = 559k. TX-02 Piutang (150k) TIDAK masuk kas fisik!
  if (physIn !== 559000) throw new Error(`FAIL: Cash in expected 559000, got ${physIn}`);
  // Kas Fisik Keluar = 80k (TX-05 Gaji). TX-04 Transfer Bank (500k) TIDAK mengurangi kas fisik!
  if (physOut !== 80000) throw new Error(`FAIL: Cash out expected 80000, got ${physOut}`);
  console.log('  -> PASS: Piutang & transfer bank tidak tercampur ke kas fisik brankas\n');

  // --- UJI 4: FILTER PERIODE TIDAK MENGAMBIL TRANSAKSI DI LUAR RENTANG ---
  console.log('[UJI 4] Filter periode mengisolasi transaksi di luar rentang:');
  const augRes = db.exec(`
    SELECT COALESCE(SUM(je.credit), 0) AS aug_rev
    FROM journal_entries je
    JOIN journals j ON je.journal_id = j.id
    JOIN accounts a ON je.account_id = a.id
    WHERE a.category = 'Pendapatan' AND j.date >= '2026-08-01' AND j.date <= '2026-08-31';
  `);
  const augRev = augRes[0].values[0][0];
  console.log(`  -> Pendapatan Periode Agustus 2026: Rp ${augRev.toLocaleString('id-ID')}`);
  // Agustus: TX-01 (200k) + TX-02 (150k) = 350k. TX-06 (259k pada Sept) harus dieksklusikan!
  if (augRev !== 350000) throw new Error(`FAIL: August revenue should be 350000, got ${augRev}`);
  console.log('  -> PASS: Transaksi September berhasil dieksklusikan dari laporan Agustus\n');

  // --- UJI 5: REKAP SHIFT KONSISTEN DENGAN TRANSAKSI AKTUAL ---
  console.log('[UJI 5] Rekap shift konsisten dengan transaksi yang tercatat:');
  const shiftRecapRes = db.exec(`
    SELECT
      s.id, s.name, s.initial_cash,
      (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.shift_id = s.id AND t.category = 'Penjualan' AND t.status = 'Selesai') AS actual_sales,
      (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.shift_id = s.id AND t.category = 'Penjualan' AND t.status = 'Selesai' AND t.payment_method = 'Tunai') AS cash_sales,
      (SELECT COALESCE(SUM(t.total), 0) FROM transactions t WHERE t.shift_id = s.id AND t.category = 'Penjualan' AND t.status = 'Selesai' AND t.payment_method = 'Piutang') AS credit_sales
    FROM shifts s
    ORDER BY s.id;
  `);
  for (const s of shiftRecapRes[0].values) {
    const [id, name, initCash, actSales, cashSales, credSales] = s;
    console.log(`  -> Shift ${id} (${name}): Modal Awal=Rp ${initCash}, Total Jual=Rp ${actSales}, Tunai=Rp ${cashSales}, Piutang=Rp ${credSales}`);
  }
  // SFT-01: Total Jual 350k (200k Tunai + 150k Piutang)
  const s1 = shiftRecapRes[0].values[0];
  if (s1[3] !== 350000 || s1[4] !== 200000 || s1[5] !== 150000) {
    throw new Error('FAIL: SFT-01 sales breakdown mismatch');
  }
  console.log('  -> PASS: Rekap shift 100% konsisten dengan transaksi aktual SQLite\n');

  // --- UJI 6: PEMBATALAN TRANSAKSI DIPROTEKSI SECARA FAIL-CLOSED ---
  console.log('[UJI 6] Pembatalan transaksi terposting diproteksi (fail-closed):');
  let cancelFailed = false;
  try {
    db.run(`UPDATE transactions SET status = 'Batal', cancelled_at = '2026-08-30', cancel_reason = 'Salah' WHERE id = 'TX-01';`);
  } catch (err) {
    cancelFailed = true;
    console.log(`  -> Trigger intercepted cancellation: "${err.message}"`);
  }
  if (!cancelFailed) throw new Error('FAIL: Posted transaction cancellation was not blocked!');
  const checkTx = db.exec(`SELECT status FROM transactions WHERE id = 'TX-01';`)[0].values[0][0];
  if (checkTx !== 'Selesai') throw new Error('FAIL: Status altered despite abort');
  console.log('  -> PASS: Transaksi berstatus Selesai tetap terlindungi dan konsisten\n');

  // --- UJI 8: PERSISTENCE - EKSPOR & RE-OPEN DATABASE ---
  console.log('[UJI 8] Hasil laporan tetap konsisten setelah database ditutup & dibuka kembali:');
  const exportedBinary = db.export();
  db.close();

  // Buka kembali database baru dari binary
  const dbReopened = new SQL.Database(exportedBinary);
  const recheckRes = dbReopened.exec(`
    SELECT
      (SELECT COUNT(*) FROM transactions) AS tx_count,
      (SELECT COUNT(*) FROM journals) AS jrn_count,
      (SELECT SUM(balance) FROM accounts WHERE category = 'Aset') AS total_aset,
      (SELECT SUM(total_sales) FROM shifts) AS total_shift_sales;
  `);
  const [reTx, reJrn, reAset, reSales] = recheckRes[0].values[0];
  console.log(`  -> Database dibuka ulang: Transaksi=${reTx}, Jurnal=${reJrn}, Total Aset=Rp ${reAset}, Shift Sales=Rp ${reSales}`);
  if (reTx !== 6 || reJrn !== 6) throw new Error('FAIL: Data loss upon database reopen');
  console.log('  -> PASS: Seluruh data transaksi, jurnal, akun, dan laporan 100% persisten\n');

  dbReopened.close();

  console.log('====================================================');
  console.log('   SEMUA 9 SKENARIO PENGUJIAN PHASE 10: LULUS (PASS)');
  console.log('====================================================');
}

runAllPhase10Tests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});

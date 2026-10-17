import initSqlJs from 'sql.js';
import { MIGRATIONS } from '../src/services/database/migrations';
import { MigrationRunner } from '../src/services/database/migrationRunner';
import { MasterDataService } from '../src/services/database/masterDataService';
import { AccountingService } from '../src/services/database/accountingService';
import { ShiftRepository } from '../src/services/database/repositories/shiftRepository';
import { ReportRepository } from '../src/services/database/repositories/reportRepository';
import { TransactionRepository } from '../src/services/database/repositories/transactionRepository';
import { Transaction, Tera } from '../src/types';

async function main() {
  console.log('====================================================================');
  console.log('   TEST SUITE: TRANSAKSI ADMINISTRASI TANPA SHIFT AKTIF');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();

  const createDbExecutor = (db: any) => ({
    query: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
      const stmt = db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return rows;
    },
    run: async (sql: string, params: any[] = []): Promise<{ changes: number }> => {
      db.run(sql, params);
      return { changes: db.getRowsModified() };
    },
    execute: async (sql: string): Promise<void> => {
      db.exec(sql);
    }
  });

  const db = new SQL.Database();
  const executor = createDbExecutor(db);

  // 1. Run migrations v1-v4
  console.log('1. MENJALANKAN MIGRASI v1-v4...');
  const migRes = await MigrationRunner.runMigrations(executor, MIGRATIONS);
  console.log(`   -> Migrasi selesai di versi: ${migRes.currentVersion}`);

  // 2. Initialize master data
  console.log('2. MENGISI MASTER DATA...');
  await MasterDataService.initializeMasterData(executor);

  // Set all shifts to 'Tutup' initially
  await executor.run(`UPDATE shifts SET status = 'Tutup', total_sales = 0, initial_cash = 0, cash_handover = 0, discrepancy = 0;`);
  await executor.run(`DELETE FROM shift_sessions;`);

  const shiftRepo = new ShiftRepository(executor);
  const reportRepo = new ReportRepository(executor);

  // Verify no active shift
  const initialActiveShift = await shiftRepo.getActiveShift();
  console.log(`   -> Shift aktif saat ini: ${initialActiveShift ? initialActiveShift.name : 'TIDAK ADA (NULL)'}`);
  if (initialActiveShift) throw new Error('Harusnya tidak ada shift aktif di awal!');

  // 3. Post Transaction 1: Penjualan Tunai Tanpa Shift (Administratif)
  console.log('\n3. INPUT TRANSAKSI ADMINISTRASI TANPA SHIFT (PENJUALAN TUNAI DENGAN TERA)...');
  const tera1: Tera = {
    id: 'TRA-ADM-001',
    date: '2026-10-14',
    nozzleId: 'NZL-01',
    nozzleCode: 'NZ-01',
    productId: 'PRD-01',
    productName: 'Pertalite',
    price: 10000,
    teraAwal: 100,
    teraAkhir: 110,
    volume: 10,
    selisih: 0,
    salesAmount: 100000,
    officer: 'Admin SPBU',
    status: 'Valid'
  };

  const tx1: Transaction = {
    id: 'TX-ADM-001',
    date: '2026-10-14 10:00:00',
    code: '303',
    masterCodeId: 'MK-303',
    name: 'Penjualan Pertalite Tunai',
    category: 'Penjualan',
    paymentMethod: 'Tunai',
    amount: 100000,
    productId: 'PRD-01',
    product: 'Pertalite',
    volume: 10,
    unitPrice: 10000,
    total: 100000,
    // shiftId is undefined for administrative transaction!
    shiftId: undefined,
    shift: 'Tanpa Sesi / Administratif',
    cashier: 'Admin SPBU',
    status: 'Selesai'
  };

  const postRes1 = await AccountingService.executeTransaction({ transaction: tx1, tera: tera1, executor });
  console.log(`   -> Hasil post: success = ${postRes1.success}, error = ${postRes1.error || 'none'}`);
  if (!postRes1.success) throw new Error(`Gagal posting tx1: ${postRes1.error}`);

  // Verify database record for tx1
  const savedTx1 = await executor.query(`SELECT id, code, shift_id, cashier, total FROM transactions WHERE id = ?;`, ['TX-ADM-001']);
  console.log(`   -> Data tersimpan di DB:`, savedTx1[0]);
  if (savedTx1[0].shift_id !== null) {
    throw new Error(`Expected shift_id to be NULL, got: ${savedTx1[0].shift_id}`);
  }

  const txRepo = new TransactionRepository(executor);
  const repoTx1 = await txRepo.findById('TX-ADM-001');
  if (!repoTx1 || repoTx1.shift !== 'Tanpa Sesi / Administratif') {
    throw new Error(`Expected TransactionRepository to map shift as 'Tanpa Sesi / Administratif', got: ${repoTx1?.shift}`);
  }
  if (!repoTx1 || repoTx1.cashier !== 'Admin SPBU') {
    throw new Error(`Expected TransactionRepository to map cashier as 'Admin SPBU', got: ${repoTx1?.cashier}`);
  }

  // Verify journals
  const journal1 = await executor.query(`SELECT id, trans_code, description FROM journals WHERE transaction_id = ?;`, ['TX-ADM-001']);
  console.log(`   -> Jurnal tercatat:`, journal1[0]);
  const entries1 = await executor.query(`SELECT account_id, debit, credit FROM journal_entries WHERE journal_id = ?;`, [journal1[0].id]);
  console.log(`   -> Rincian jurnal entries:`, entries1);
  const totalDebit1 = entries1.reduce((sum, e) => sum + Number(e.debit), 0);
  const totalCredit1 = entries1.reduce((sum, e) => sum + Number(e.credit), 0);
  if (totalDebit1 !== 100000 || totalCredit1 !== 100000) {
    throw new Error(`Jurnal tidak balance: Debit ${totalDebit1} vs Kredit ${totalCredit1}`);
  }

  // Verify that shifts and shift_sessions were NOT updated
  const shiftCheck1 = await executor.query(`SELECT id, total_sales FROM shifts WHERE total_sales > 0;`);
  if (shiftCheck1.length > 0) {
    throw new Error(`Tabel shifts terupdate secara salah oleh transaksi administratif!`);
  }

  // 4. Post Transaction 2: Penjualan Kredit (Piutang) Tanpa Shift
  console.log('\n4. INPUT TRANSAKSI ADMINISTRASI TANPA SHIFT (PENJUALAN KREDIT / PIUTANG)...');
  const partnerRows = await executor.query(`SELECT id, name FROM business_partners WHERE type = 'Customer';`);
  const partnerId = partnerRows[0]?.id || 'PRT-CUST-01';

  const tera2: Tera = {
    id: 'TRA-ADM-002',
    date: '2026-10-14',
    nozzleId: 'NZL-01',
    nozzleCode: 'NZ-01',
    productId: 'PRD-01',
    productName: 'Pertalite',
    price: 10000,
    teraAwal: 110,
    teraAkhir: 135,
    volume: 25,
    selisih: 0,
    salesAmount: 250000,
    officer: 'Admin SPBU',
    status: 'Valid'
  };

  const tx2: Transaction = {
    id: 'TX-ADM-002',
    date: '2026-10-14 10:15:00',
    code: '310',
    masterCodeId: 'MK-310',
    name: 'Penjualan Pertalite Kredit (Piutang)',
    category: 'Penjualan',
    paymentMethod: 'Piutang',
    partnerId: partnerId,
    partnerName: partnerRows[0]?.name || 'PT Trans Logistik',
    amount: 250000,
    productId: 'PRD-01',
    product: 'Pertalite',
    volume: 25,
    unitPrice: 10000,
    total: 250000,
    shiftId: undefined,
    shift: 'Tanpa Sesi / Administratif',
    cashier: 'Admin SPBU',
    status: 'Selesai'
  };

  const postRes2 = await AccountingService.executeTransaction({ transaction: tx2, tera: tera2, executor });
  if (!postRes2.success) throw new Error(`Gagal posting tx2: ${postRes2.error}`);
  console.log(`   -> Hasil post: success = ${postRes2.success}`);

  // 5. Post Transaction 3: Beli Tunai Kas (Pengeluaran Operasional) Tanpa Shift
  console.log('\n5. INPUT TRANSAKSI ADMINISTRASI TANPA SHIFT (BEBAN / BELI TUNAI KAS)...');
  const tx3: Transaction = {
    id: 'TX-ADM-003',
    date: '2026-10-14 10:30:00',
    code: '313',
    masterCodeId: 'MK-313',
    name: 'Pembelian Persediaan BBM Tunai',
    category: 'Persediaan',
    paymentMethod: 'Tunai',
    amount: 50000,
    product: '-',
    volume: 0,
    unitPrice: 0,
    total: 50000,
    shiftId: undefined,
    shift: 'Tanpa Sesi / Administratif',
    cashier: 'Admin SPBU',
    status: 'Selesai'
  };

  const postRes3 = await AccountingService.executeTransaction({ transaction: tx3, executor });
  if (!postRes3.success) throw new Error(`Gagal posting tx3: ${postRes3.error}`);
  console.log(`   -> Hasil post: success = ${postRes3.success}`);

  // 6. Sekarang Buka Shift 1 secara normal dan Uji Transaksi Shift vs Non-Shift
  console.log('\n6. BUKA SHIFT OPERASIONAL & UJI TRANSAKSI BERSAMAAN...');
  await shiftRepo.bukaShift('SFT-01', {
    date: '2026-10-14',
    startTime: '06:00',
    operator: 'Ahmad Fauzi',
    initialCash: 500000
  });

  const activeShift = await shiftRepo.getActiveShift();
  console.log(`   -> Shift aktif sekarang: [${activeShift?.id}] ${activeShift?.name} oleh ${activeShift?.operator}`);
  if (!activeShift || activeShift.id !== 'SFT-01') throw new Error('Gagal buka SFT-01!');

  // Post Transaction 4: Transaksi milik Shift 1
  const tera4: Tera = {
    id: 'TRA-SFT-004',
    date: '2026-10-14',
    nozzleId: 'NZL-02',
    nozzleCode: 'NZ-02',
    productId: 'PRD-02',
    productName: 'Pertamax',
    price: 12950,
    teraAwal: 200,
    teraAkhir: 210,
    volume: 10,
    selisih: 0,
    salesAmount: 129500,
    officer: activeShift.operator,
    status: 'Valid'
  };

  const tx4: Transaction = {
    id: 'TX-SFT-004',
    date: '2026-10-14 11:00:00',
    code: '304',
    masterCodeId: 'MK-304',
    name: 'Penjualan Pertamax Tunai',
    category: 'Penjualan',
    paymentMethod: 'Tunai',
    amount: 129500,
    productId: 'PRD-02',
    product: 'Pertamax',
    volume: 10,
    unitPrice: 12950,
    total: 129500,
    shiftId: activeShift.id, // DITAUTKAN KE SHIFT
    shift: activeShift.name,
    cashier: activeShift.operator,
    status: 'Selesai'
  };

  const postRes4 = await AccountingService.executeTransaction({ transaction: tx4, tera: tera4, executor });
  if (!postRes4.success) throw new Error(`Gagal posting tx4: ${postRes4.error}`);
  console.log(`   -> Transaksi Shift 1 berhasil diposting: Rp 129.500`);

  // Verify SFT-01 total_sales is 129500
  const sftRow = await executor.query(`SELECT id, total_sales FROM shifts WHERE id = 'SFT-01';`);
  console.log(`   -> Total sales di tabel shifts untuk SFT-01: Rp ${sftRow[0].total_sales}`);
  if (Number(sftRow[0].total_sales) !== 129500) {
    throw new Error(`Expected SFT-01 total_sales to be 129500, got ${sftRow[0].total_sales}`);
  }

  // Post Transaction 5: Transaksi Admin saat ada shift aktif TAPI TIDAK DITAUTKAN KE SHIFT
  console.log('\n7. INPUT TRANSAKSI ADMINISTRASI SAAT SHIFT AKTIF (TIDAK DITAUTKAN KE SHIFT)...');
  const tera5: Tera = {
    id: 'TRA-ADM-005',
    date: '2026-10-14',
    nozzleId: 'NZL-02',
    nozzleCode: 'NZ-02',
    productId: 'PRD-02',
    productName: 'Pertamax',
    price: 12950,
    teraAwal: 210,
    teraAkhir: 215,
    volume: 5,
    selisih: 0,
    salesAmount: 64750,
    officer: 'Admin SPBU',
    status: 'Valid'
  };

  const tx5: Transaction = {
    id: 'TX-ADM-005',
    date: '2026-10-14 11:15:00',
    code: '304',
    masterCodeId: 'MK-304',
    name: 'Penjualan Pertamax Tunai (Admin)',
    category: 'Penjualan',
    paymentMethod: 'Tunai',
    amount: 64750,
    productId: 'PRD-02',
    product: 'Pertamax',
    volume: 5,
    unitPrice: 12950,
    total: 64750,
    shiftId: undefined, // ADMIN TIDAK MENAUTKAN KE SHIFT!
    shift: 'Tanpa Sesi / Administratif',
    cashier: 'Admin SPBU',
    status: 'Selesai'
  };

  const postRes5 = await AccountingService.executeTransaction({ transaction: tx5, tera: tera5, executor });
  if (!postRes5.success) throw new Error(`Gagal posting tx5: ${postRes5.error}`);

  // SFT-01 total_sales MUST STILL BE 129500!
  const sftRowAfter = await executor.query(`SELECT id, total_sales FROM shifts WHERE id = 'SFT-01';`);
  console.log(`   -> Total sales SFT-01 setelah tx admin: Rp ${sftRowAfter[0].total_sales}`);
  if (Number(sftRowAfter[0].total_sales) !== 129500) {
    throw new Error(`SFT-01 total_sales terganggu oleh tx admin! Nilai: ${sftRowAfter[0].total_sales}`);
  }

  // 8. Test Laporan Rekapitulasi Penjualan & Shift
  console.log('\n8. VERIFIKASI LAPORAN REKAPITULASI PENJUALAN & SHIFT...');
  const recap = await reportRepo.getSalesAndShiftRecap();
  console.log('   -> Total Gross Sales Keseluruhan:', recap.totalGrossSales);
  console.log('   -> Cash Sales Keseluruhan:', recap.cashSales);
  console.log('   -> Credit Sales Keseluruhan:', recap.creditSales);
  console.log('   -> Rincian Shifts di Laporan:');
  for (const s of recap.shifts) {
    console.log(`      * [${s.shiftId}] ${s.shiftName} (Kasir: ${s.operator}): Total Penjualan = Rp ${s.totalSales}, Tunai = Rp ${s.cashSales}`);
  }

  // Total gross: tx1 (100000) + tx2 (250000) + tx4 (129500) + tx5 (64750) = 544250
  const expectedGross = 100000 + 250000 + 129500 + 64750;
  const expectedCash = 100000 + 129500 + 64750;
  const expectedCredit = 250000;

  if (recap.totalGrossSales !== expectedGross) {
    throw new Error(`Expected totalGrossSales ${expectedGross}, got ${recap.totalGrossSales}`);
  }
  if (recap.cashSales !== expectedCash) {
    throw new Error(`Expected cashSales ${expectedCash}, got ${recap.cashSales}`);
  }
  if (recap.creditSales !== expectedCredit) {
    throw new Error(`Expected creditSales ${expectedCredit}, got ${recap.creditSales}`);
  }

  // Check shift items
  const nonShiftItem = recap.shifts.find(s => s.shiftId === 'NON-SHIFT');
  if (!nonShiftItem) {
    throw new Error(`Laporan shift tidak mencantumkan baris NON-SHIFT!`);
  }
  console.log(`   -> Baris Non-Shift terverifikasi:`, nonShiftItem);
  const expectedNonShiftSales = 100000 + 250000 + 64750;
  if (nonShiftItem.totalSales !== expectedNonShiftSales) {
    throw new Error(`Expected NON-SHIFT totalSales ${expectedNonShiftSales}, got ${nonShiftItem.totalSales}`);
  }

  const shift1Item = recap.shifts.find(s => s.shiftId === 'SFT-01');
  if (!shift1Item) {
    throw new Error(`Shift SFT-01 tidak ditemukan di laporan!`);
  }
  if (shift1Item.totalSales !== 129500) {
    throw new Error(`Expected SFT-01 totalSales 129500, got ${shift1Item.totalSales}`);
  }
  if (shift1Item.cashSales !== 129500) {
    throw new Error(`Expected SFT-01 cashSales 129500, got ${shift1Item.cashSales}`);
  }

  // 9. Verify Rollback Safety when Transaction Fails
  console.log('\n9. VERIFIKASI ROLLBACK SAFETY SAAT TRANSAKSI GAGAL...');
  const txFail: Transaction = {
    id: 'TX-FAIL-001',
    date: '2026-10-14 12:00:00',
    code: '999', // INVALID MASTER CODE
    masterCodeId: 'NON-EXISTENT',
    name: 'Invalid Code Tx',
    category: 'Penjualan',
    paymentMethod: 'Tunai',
    amount: 1000000,
    product: '-',
    volume: 0,
    unitPrice: 0,
    total: 1000000,
    shiftId: undefined,
    shift: 'Tanpa Sesi / Administratif',
    cashier: 'Admin SPBU',
    status: 'Selesai'
  };

  const failResult = await AccountingService.executeTransaction({ transaction: txFail, executor });
  console.log(`   -> Hasil tx invalid: success = ${failResult.success}, error = ${failResult.error}`);
  if (failResult.success) {
    throw new Error(`Transaksi dengan kode tidak valid seharusnya gagal!`);
  }

  // Verify no dirty transaction or journal was inserted
  const dirtyTx = await executor.query(`SELECT id FROM transactions WHERE id = 'TX-FAIL-001';`);
  if (dirtyTx.length > 0) {
    throw new Error(`Rollback gagal! Transaksi TX-FAIL-001 tetap tersimpan di database.`);
  }
  const dirtyJournals = await executor.query(`SELECT id FROM journals WHERE description LIKE '%TX-FAIL-001%';`);
  if (dirtyJournals.length > 0) {
    throw new Error(`Rollback gagal! Jurnal kotor ditemukan.`);
  }
  console.log(`   -> Rollback safety terverifikasi 100%: Tidak ada data kotor tertinggal.`);

  console.log('\n====================================================================');
  console.log('   SEMUA PENGUJIAN TRANSAKSI ADMINISTRASI LULUS DENGAN SEMPURNA!   ');
  console.log('====================================================================');
}

main().catch((err) => {
  console.error('\n❌ TEST GAGAL DENGAN ERROR:', err);
  process.exit(1);
});

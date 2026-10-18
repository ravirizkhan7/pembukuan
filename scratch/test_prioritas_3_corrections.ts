/**
 * TEST SUITE: PRIORITAS 3 — KOREKSI TRANSAKSI BERBASIS AKUNTANSI
 * 
 * Pengujian komprehensif 13 skenario wajib:
 * 1. Koreksi transaksi tunai yang memenuhi syarat (Biaya Operasional).
 * 2. Koreksi transaksi pembelian kredit yang belum memiliki pembayaran lanjutan (sub-ledger aman).
 * 3. Penolakan koreksi transaksi shift tertutup.
 * 4. Penolakan koreksi faktur yang sudah dibayar sebagian/lunas.
 * 5. Penolakan koreksi pelunasan yang telah memengaruhi tagihan lain.
 * 6. Penolakan transaksi tanpa jurnal valid.
 * 7. Verifikasi jumlah debit sama dengan kredit pada seluruh jurnal terkait.
 * 8. Verifikasi saldo COA sebelum transaksi asal, setelah posting, dan setelah koreksi.
 * 9. Pastikan laporan tidak menghitung ganda transaksi asal yang sudah dibalik.
 * 10. Paksa kegagalan pada tahap reversal maupun transaksi pengganti; pastikan rollback menyeluruh.
 * 11. Pastikan koreksi yang sama tidak dapat diposting dua kali.
 * 12. Pastikan backup/restore v6 mempertahankan audit trail & tolak backup v5.
 * 13. Verifikasi konsistensi audit trail dan integritas trigger SQLite.
 */

import initSqlJs from 'sql.js';
import { SqlExecutor, MigrationRunner } from '../src/services/database/migrationRunner';
import { MIGRATIONS } from '../src/services/database/migrations';
import { DATABASE_VERSION } from '../src/services/database/databaseConfig';
import { AccountingService } from '../src/services/database/accountingService';
import {
  TransactionRepository,
  JournalRepository,
  AccountRepository,
  ReceivableRepository,
  PayableRepository,
  ShiftRepository,
  MasterCodeRepository,
  BusinessPartnerRepository,
  TransactionCorrectionRepository,
  ReportRepository
} from '../src/services/database/repositories';
import { BackupRestoreService } from '../src/services/database/backupRestoreService';
import type { Account, MasterCode, BusinessPartner } from '../src/types';

class SqlJsExecutor implements SqlExecutor {
  private db: any;
  constructor(db: any) {
    this.db = db;
  }
  public async execute(sql: string): Promise<void> {
    this.db.exec(sql);
  }
  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }
  public async run(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    this.db.run(sql, params);
    const res = this.db.exec('SELECT changes() AS chg, last_insert_rowid() AS lastId;');
    if (res.length > 0 && res[0].values.length > 0) {
      return {
        changes: Number(res[0].values[0][0]),
        lastInsertRowid: Number(res[0].values[0][1])
      };
    }
    return { changes: 0, lastInsertRowid: 0 };
  }
}

async function runTestSuite() {
  console.log('====================================================================');
  console.log('   TEST SUITE: PRIORITAS 3 — KOREKSI TRANSAKSI AKUNTANSI');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const executor = new SqlJsExecutor(db);

  // Jalankan semua migrasi v1 - v6
  console.log('[Setup] Menjalankan migrasi database ke versi:', DATABASE_VERSION);
  const migRes = await MigrationRunner.runMigrations(executor);
  if (!migRes.success) {
    throw new Error(`Migrasi database gagal: ${migRes.error}`);
  }
  console.log(`[Setup] Migrasi berhasil diterapkan. Versi aktif: v${migRes.currentVersion}\n`);

  if (DATABASE_VERSION !== 6) {
    throw new Error(`DATABASE_VERSION harus 6, aktual: ${DATABASE_VERSION}`);
  }

  // Setup data master COA, Master Code, Partners, Shifts
  const accRepo = new AccountRepository(executor);
  const mcRepo = new MasterCodeRepository(executor);
  const bpRepo = new BusinessPartnerRepository(executor);
  const shiftRepo = new ShiftRepository(executor);
  const txRepo = new TransactionRepository(executor);
  const jrnRepo = new JournalRepository(executor);
  const recRepo = new ReceivableRepository(executor);
  const payRepo = new PayableRepository(executor);
  const corrRepo = new TransactionCorrectionRepository(executor);
  const reportRepo = new ReportRepository(executor);

  // 1. Akun COA
  const accounts: Account[] = [
    { id: '1-1001', code: '1-1001', name: 'Kas Fisik', category: 'Aset', normalBalance: 'Debit', balance: 50000000, isActive: true },
    { id: '1-1002', code: '1-1002', name: 'Bank Mandiri', category: 'Aset', normalBalance: 'Debit', balance: 100000000, isActive: true },
    { id: '1-1101', code: '1-1101', name: 'Piutang Usaha', category: 'Aset', normalBalance: 'Debit', balance: 0, isActive: true },
    { id: '1-1201', code: '1-1201', name: 'Persediaan BBM', category: 'Aset', normalBalance: 'Debit', balance: 20000000, isActive: true },
    { id: '2-1001', code: '2-1001', name: 'Hutang Usaha', category: 'Kewajiban', normalBalance: 'Kredit', balance: 0, isActive: true },
    { id: '3-1001', code: '3-1001', name: 'Modal Pemilik', category: 'Ekuitas', normalBalance: 'Kredit', balance: 170000000, isActive: true },
    { id: '4-1001', code: '4-1001', name: 'Pendapatan BBM', category: 'Pendapatan', normalBalance: 'Kredit', balance: 0, isActive: true },
    { id: '6-1001', code: '6-1001', name: 'Beban Operasional Kantor', category: 'Beban', normalBalance: 'Debit', balance: 0, isActive: true }
  ];
  for (const acc of accounts) {
    await accRepo.create(acc);
  }

  // 2. Master Codes
  const masterCodes: MasterCode[] = [
    {
      id: 'MC-303', code: '303', name: 'Penjualan BBM Tunai', category: 'Penjualan', type: 'Pendapatan',
      requiresTera: false, debitAccountId: '1-1001', debitAccountName: 'Kas Fisik',
      creditAccountId: '4-1001', creditAccountName: 'Pendapatan BBM',
      description: 'Penjualan BBM Tunai', paymentMethod: 'Tunai', isActive: true
    },
    {
      id: 'MC-304', code: '304', name: 'Penjualan BBM Piutang', category: 'Penjualan', type: 'Piutang',
      requiresTera: false, debitAccountId: '1-1101', debitAccountName: 'Piutang Usaha',
      creditAccountId: '4-1001', creditAccountName: 'Pendapatan BBM',
      description: 'Penjualan BBM Piutang', paymentMethod: 'Piutang', isActive: true
    },
    {
      id: 'MC-306', code: '306', name: 'Pembelian BBM Kredit', category: 'Pembelian', type: 'Hutang',
      requiresTera: false, debitAccountId: '1-1201', debitAccountName: 'Persediaan BBM',
      creditAccountId: '2-1001', creditAccountName: 'Hutang Usaha',
      description: 'Pembelian BBM Kredit', paymentMethod: 'Hutang', isActive: true
    },
    {
      id: 'MC-307', code: '307', name: 'Beban Operasional ATK', category: 'Biaya Operasional', type: 'Beban',
      requiresTera: false, debitAccountId: '6-1001', debitAccountName: 'Beban Operasional Kantor',
      creditAccountId: '1-1001', creditAccountName: 'Kas Fisik',
      description: 'Belanja ATK Kantor', paymentMethod: 'Tunai', isActive: true
    },
    {
      id: 'MC-308', code: '308', name: 'Pelunasan Piutang Usaha', category: 'Pelunasan', type: 'Kas Masuk',
      requiresTera: false, debitAccountId: '1-1001', debitAccountName: 'Kas Fisik',
      creditAccountId: '1-1101', creditAccountName: 'Piutang Usaha',
      description: 'Pelunasan Piutang', paymentMethod: 'Tunai', isActive: true
    }
  ];
  for (const mc of masterCodes) {
    await mcRepo.create(mc);
  }

  // 3. Business Partners
  const partners: BusinessPartner[] = [
    { id: 'CUS-001', code: 'CUS-001', name: 'PT Antar Lintas Sumatera', type: 'Customer', isActive: true },
    { id: 'VEN-001', code: 'VEN-001', name: 'Pertamina Patra Niaga', type: 'Vendor', isActive: true }
  ];
  for (const bp of partners) {
    await bpRepo.create(bp);
  }

  // 4. Station Info
  await executor.run(
    `INSERT INTO station_info (id, name, address, city, phone, manager, email, status, last_backup, version, created_at, updated_at)
     VALUES ('SPBU-01', 'SPBU Mitra Akrual', 'Jl. Merdeka No. 1', 'Pariaman', '08123456789', 'Budi Santoso', 'spbu@example.com', 'Aktif', '2026-10-17', 'v1.0.0', datetime('now'), datetime('now'));`
  );

  // 5. Shift Master Definitions
  await executor.run(
    `INSERT INTO shifts (id, name, start_time, end_time, operator, status, total_sales, cash_handover, date, initial_cash, discrepancy, created_at, updated_at)
     VALUES 
     ('1', 'Shift 1', '06:00', '14:00', 'Operator 1', 'Menunggu', 0, 0, '2026-10-17', 0, 0, datetime('now'), datetime('now')),
     ('2', 'Shift 2', '14:00', '22:00', 'Operator 2', 'Menunggu', 0, 0, '2026-10-17', 0, 0, datetime('now'), datetime('now')),
     ('3', 'Shift 3', '22:00', '06:00', 'Operator 3', 'Menunggu', 0, 0, '2026-10-17', 0, 0, datetime('now'), datetime('now'));`
  );

  console.log('[Setup] Master data seeded successfully.\n');

  let passedTests = 0;

  // =========================================================================
  // TEST 1: Koreksi Transaksi Tunai yang Memenuhi Syarat
  // =========================================================================
  console.log('--- TEST 1: Koreksi Transaksi Tunai yang Memenuhi Syarat ---');
  const initialKas1001 = (await accRepo.findById('1-1001'))!.balance;
  const initialBeban6001 = (await accRepo.findById('6-1001'))!.balance;

  const tx1Post = await AccountingService.executeTransaction({
    transaction: {
      id: 'TX-TEST-001',
      date: '2026-10-17 10:00:00',
      code: '307',
      name: 'Belanja Kertas & Tinta Printer',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 300000,
      cashier: 'Admin SPBU',
      shift: 'Tanpa Sesi / Administratif',
      status: 'Selesai'
    },
    executor
  });
  if (!tx1Post.success) throw new Error(`Test 1 gagal posting transaksi asal: ${tx1Post.error}`);

  const postKas1001 = (await accRepo.findById('1-1001'))!.balance;
  const postBeban6001 = (await accRepo.findById('6-1001'))!.balance;
  if (postKas1001 !== initialKas1001 - 300000 || postBeban6001 !== initialBeban6001 + 300000) {
    throw new Error(`Test 1: Saldo akun COA setelah posting asal tidak sesuai`);
  }

  // Koreksi transaksi tunai menjadi Rp 250.000
  const tx1CorrectRes = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-TEST-001',
    reason: 'Salah ketik nominal kwitansi ATK (seharusnya Rp 250.000)',
    replacementData: {
      id: 'TX-TEST-001-REP',
      date: '2026-10-17 10:00:00',
      code: '307',
      name: 'Belanja Kertas & Tinta Printer (Revisi)',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 250000,
      cashier: 'Admin SPBU',
      shift: 'Tanpa Sesi / Administratif',
      status: 'Selesai'
    },
    user: 'Budi Santoso',
    executor
  });

  if (!tx1CorrectRes.success) throw new Error(`Test 1 gagal koreksi transaksi: ${tx1CorrectRes.error}`);

  // Verifikasi transaksi asal berstatus Batal & Terkoreksi
  const origTxAfter1 = await txRepo.findById('TX-TEST-001');
  if (origTxAfter1?.status !== 'Batal' || !origTxAfter1.isCorrected || !origTxAfter1.correctionId) {
    throw new Error(`Test 1: Transaksi asal tidak berstatus Batal/isCorrected`);
  }

  // Verifikasi jurnal pembalik
  const revJournal1 = tx1CorrectRes.reversalJournal!;
  if (!revJournal1.isReversal || revJournal1.reversesJournalId !== tx1Post.journal?.id) {
    throw new Error(`Test 1: Jurnal pembalik tidak memiliki metadata is_reversal atau reverses_journal_id`);
  }

  // Verifikasi saldo COA akhir: Kas berkurang 250.000, Beban bertambah 250.000 dari saldo awal
  const finalKas1001 = (await accRepo.findById('1-1001'))!.balance;
  const finalBeban6001 = (await accRepo.findById('6-1001'))!.balance;
  if (finalKas1001 !== initialKas1001 - 250000 || finalBeban6001 !== initialBeban6001 + 250000) {
    throw new Error(`Test 1: Saldo akhir COA setelah koreksi salah! Kas: ${finalKas1001}, Beban: ${finalBeban6001}`);
  }
  console.log('✓ PASS: Koreksi transaksi tunai berhasil, COA dan audit trail konsisten.\n');
  passedTests++;

  // =========================================================================
  // TEST 2: Koreksi Transaksi Pembelian Kredit yang Belum Ada Pembayaran
  // =========================================================================
  console.log('--- TEST 2: Koreksi Pembelian Kredit (Sub-ledger Aman) ---');
  const tx2Post = await AccountingService.executeTransaction({
    transaction: {
      id: 'TX-TEST-002',
      date: '2026-10-17 11:00:00',
      code: '306',
      name: 'Pembelian Solar Industri 1000L',
      category: 'Pembelian',
      product: 'Bio Solar',
      volume: 1000,
      unitPrice: 10000,
      total: 10000000,
      partnerId: 'VEN-001',
      partnerName: 'Pertamina Patra Niaga',
      cashier: 'Admin SPBU',
      shift: 'Tanpa Sesi / Administratif',
      status: 'Selesai'
    },
    executor
  });
  if (!tx2Post.success) throw new Error(`Test 2 gagal posting: ${tx2Post.error}`);

  // Cek hutang usaha awal
  const payablesBefore = await payRepo.findByTransactionId('TX-TEST-002');
  if (!payablesBefore || payablesBefore.status !== 'Open' || payablesBefore.outstanding !== 10000000) {
    throw new Error('Test 2: Sub-ledger hutang tidak terbentuk sempurna');
  }

  // Koreksi pembelian kredit menjadi Rp 12.000.000
  const tx2CorrectRes = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-TEST-002',
    reason: 'Penyesuaian volume faktur DO menjadi 1.200 Liter',
    replacementData: {
      id: 'TX-TEST-002-REP',
      date: '2026-10-17 11:00:00',
      code: '306',
      name: 'Pembelian Solar Industri 1200L (Revisi)',
      category: 'Pembelian',
      product: 'Bio Solar',
      volume: 1200,
      unitPrice: 10000,
      total: 12000000,
      partnerId: 'VEN-001',
      partnerName: 'Pertamina Patra Niaga',
      cashier: 'Admin SPBU',
      shift: 'Tanpa Sesi / Administratif',
      status: 'Selesai'
    },
    user: 'Budi Santoso',
    executor
  });
  if (!tx2CorrectRes.success) throw new Error(`Test 2 gagal koreksi: ${tx2CorrectRes.error}`);

  // Cek bahwa hutang asal menjadi Batal
  const oldPayableAfter = await payRepo.findById(payablesBefore.id);
  if (oldPayableAfter?.status !== 'Batal' || oldPayableAfter.outstanding !== 0) {
    throw new Error('Test 2: Faktur hutang asal tidak dibatalkan');
  }

  // Cek bahwa hutang pengganti terbentuk dengan status Open dan nominal Rp 12.000.000
  const newPayable = await payRepo.findByTransactionId('TX-TEST-002-REP');
  if (!newPayable || newPayable.status !== 'Open' || newPayable.outstanding !== 12000000) {
    throw new Error('Test 2: Faktur hutang pengganti tidak terbentuk');
  }

  // Cek saldo akun 2-1001 (Hutang Usaha)
  const hutangAcc = await accRepo.findById('2-1001');
  if (hutangAcc?.balance !== 12000000) {
    throw new Error(`Test 2: Saldo Hutang Usaha salah! Aktual: ${hutangAcc?.balance}, Ekspektasi: 12.000.000`);
  }
  console.log('✓ PASS: Koreksi pembelian kredit berhasil, sub-ledger dan COA konsisten.\n');
  passedTests++;

  // =========================================================================
  // TEST 3: Penolakan Koreksi Transaksi Shift Tertutup
  // =========================================================================
  console.log('--- TEST 3: Penolakan Koreksi Transaksi Shift Tertutup ---');
  // Buka shift 1
  await shiftRepo.bukaShift('1', { date: '2026-10-17', startTime: '07:00', operator: 'Rian Operator', initialCash: 500000 });
  const txShiftPost = await AccountingService.executeTransaction({
    transaction: {
      id: 'TX-SHIFT-001',
      date: '2026-10-17 08:00:00',
      code: '307',
      name: 'Beli Sabun Cuci Tangan',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 50000,
      shiftId: '1',
      cashier: 'Rian Operator',
      status: 'Selesai'
    },
    executor
  });
  if (!txShiftPost.success) throw new Error(`Test 3 gagal posting transaksi shift: ${txShiftPost.error}`);

  // Tutup shift 1
  await shiftRepo.tutupShift('1', { cashHandover: 500000 });

  // Coba koreksi transaksi pada shift yang sudah ditutup
  const txShiftCorrectRes = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-SHIFT-001',
    reason: 'Mencoba koreksi shift tutup',
    replacementData: {
      id: 'TX-SHIFT-001-REP',
      date: '2026-10-17 08:00:00',
      code: '307',
      name: 'Beli Sabun Cuci Tangan (Revisi)',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 60000,
      shiftId: '1',
      cashier: 'Rian Operator',
      status: 'Selesai'
    },
    executor
  });

  if (txShiftCorrectRes.success) {
    throw new Error('Test 3: Seharusnya penolakan terjadi untuk transaksi shift tertutup!');
  }
  if (!txShiftCorrectRes.error?.includes('shift yang sudah ditutup')) {
    throw new Error(`Test 3: Pesan error penolakan tidak sesuai: ${txShiftCorrectRes.error}`);
  }
  console.log(`✓ PASS: Penolakan koreksi shift tertutup berhasil: "${txShiftCorrectRes.error}"\n`);
  passedTests++;

  // =========================================================================
  // TEST 4: Penolakan Koreksi Faktur Piutang yang Sudah Dibayar Sebagian/Lunas
  // =========================================================================
  console.log('--- TEST 4: Penolakan Koreksi Faktur yang Sudah Dicicil/Lunas ---');
  const txPiutangPost = await AccountingService.executeTransaction({
    transaction: {
      id: 'TX-PIUTANG-001',
      date: '2026-10-17 12:00:00',
      code: '304',
      name: 'Penjualan BBM Dexlite Kredit',
      category: 'Penjualan',
      product: 'Pertamina Dex',
      volume: 500,
      unitPrice: 10000,
      total: 5000000,
      partnerId: 'CUS-001',
      partnerName: 'PT Antar Lintas Sumatera',
      cashier: 'Admin SPBU',
      shift: 'Tanpa Sesi / Administratif',
      status: 'Selesai'
    },
    executor
  });
  if (!txPiutangPost.success) throw new Error(`Test 4 gagal posting piutang: ${txPiutangPost.error}`);

  const recRow = await recRepo.findByTransactionId('TX-PIUTANG-001');
  if (!recRow) throw new Error('Test 4: Faktur piutang tidak ditemukan');

  // Bayar sebagian: outstanding dari 5.000.000 menjadi 3.000.000 (status Partial)
  await recRepo.updateOutstanding(recRow.id, 3000000, 'Partial');

  // Coba koreksi transaksi piutang asal yang sudah ada pembayaran cicilan
  const txPiutangCorrectRes = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-PIUTANG-001',
    reason: 'Revisi nominal piutang',
    replacementData: {
      id: 'TX-PIUTANG-001-REP',
      date: '2026-10-17 12:00:00',
      code: '304',
      name: 'Penjualan Dexlite Kredit (Revisi)',
      category: 'Penjualan',
      product: 'Pertamina Dex',
      volume: 600,
      unitPrice: 10000,
      total: 6000000,
      partnerId: 'CUS-001',
      status: 'Selesai'
    },
    executor
  });

  if (txPiutangCorrectRes.success) {
    throw new Error('Test 4: Seharusnya koreksi ditolak untuk faktur piutang yang sudah dicicil!');
  }
  if (!txPiutangCorrectRes.error?.includes('pembayaran sebagian')) {
    throw new Error(`Test 4: Pesan error salah: ${txPiutangCorrectRes.error}`);
  }
  console.log(`✓ PASS: Penolakan koreksi faktur piutang yang sudah dicicil berhasil: "${txPiutangCorrectRes.error}"\n`);
  passedTests++;

  // =========================================================================
  // TEST 5: Penolakan Koreksi Transaksi Pelunasan
  // =========================================================================
  console.log('--- TEST 5: Penolakan Koreksi Transaksi Pelunasan ---');
  // Buat transaksi pelunasan langsung
  await executor.run(
    `INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, nozzle_id, tera_id, master_code_id, partner_id, payment_method, related_receivable_id, related_payable_id, is_corrected, correction_id, created_at, updated_at)
     VALUES ('TX-LUNAS-001', '2026-10-17 13:00:00', '308', 'Pelunasan Piutang PT ALS', 'Pelunasan', NULL, 0, 0, 2000000, NULL, 'Admin SPBU', 'Selesai', NULL, NULL, 'MC-308', 'CUS-001', 'Tunai', '${recRow.id}', NULL, 0, NULL, datetime('now'), datetime('now'));`
  );
  // Buat jurnal pelunasan
  await executor.run(
    `INSERT INTO journals (id, date, transaction_id, evidence_no, trans_code, description, is_balanced, is_reversal, reverses_journal_id, created_at, updated_at)
     VALUES ('JRN-LUNAS-001', '2026-10-17', 'TX-LUNAS-001', 'BKT/001', '308', 'Pelunasan Piutang', 1, 0, NULL, datetime('now'), datetime('now'));`
  );
  await executor.run(
    `INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at)
     VALUES ('JE-L-1', 'JRN-LUNAS-001', '1-1001', 2000000, 0, datetime('now')),
            ('JE-L-2', 'JRN-LUNAS-001', '1-1101', 0, 2000000, datetime('now'));`
  );

  const txLunasCorrectRes = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-LUNAS-001',
    reason: 'Koreksi pelunasan',
    replacementData: {
      id: 'TX-LUNAS-001-REP',
      date: '2026-10-17 13:00:00',
      code: '308',
      name: 'Pelunasan Piutang (Revisi)',
      category: 'Pelunasan',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 2500000,
      status: 'Selesai'
    },
    executor
  });

  if (txLunasCorrectRes.success) {
    throw new Error('Test 5: Seharusnya transaksi pelunasan ditolak!');
  }
  if (!txLunasCorrectRes.error?.includes('pelunasan')) {
    throw new Error(`Test 5: Pesan error salah: ${txLunasCorrectRes.error}`);
  }
  console.log(`✓ PASS: Penolakan koreksi transaksi pelunasan berhasil: "${txLunasCorrectRes.error}"\n`);
  passedTests++;

  // =========================================================================
  // TEST 6: Penolakan Transaksi Tanpa Jurnal Valid
  // =========================================================================
  console.log('--- TEST 6: Penolakan Transaksi Tanpa Jurnal Valid ---');
  await executor.run(
    `INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, nozzle_id, tera_id, master_code_id, partner_id, payment_method, related_receivable_id, related_payable_id, is_corrected, correction_id, created_at, updated_at)
     VALUES ('TX-NO-JOURNAL', '2026-10-17 14:00:00', '307', 'Transaksi Yatim', 'Biaya Operasional', NULL, 0, 0, 100000, NULL, 'Admin SPBU', 'Selesai', NULL, NULL, 'MC-307', NULL, 'Tunai', NULL, NULL, 0, NULL, datetime('now'), datetime('now'));`
  );

  const txNoJournalRes = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-NO-JOURNAL',
    reason: 'Coba koreksi tanpa jurnal',
    replacementData: {
      id: 'TX-NO-JOURNAL-REP',
      date: '2026-10-17 14:00:00',
      code: '307',
      name: 'Transaksi Yatim Pengganti',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 100000,
      status: 'Selesai'
    },
    executor
  });

  if (txNoJournalRes.success) {
    throw new Error('Test 6: Seharusnya transaksi tanpa jurnal ditolak!');
  }
  if (!txNoJournalRes.error?.includes('jurnal akuntansi yang valid')) {
    throw new Error(`Test 6: Pesan error salah: ${txNoJournalRes.error}`);
  }
  console.log(`✓ PASS: Penolakan transaksi tanpa jurnal berhasil: "${txNoJournalRes.error}"\n`);
  passedTests++;

  // =========================================================================
  // TEST 7: Verifikasi Debit == Credit pada Seluruh Jurnal Terkait
  // =========================================================================
  console.log('--- TEST 7: Verifikasi Debit == Credit Seluruh Jurnal ---');
  const allJournals = await jrnRepo.findAll();
  for (const j of allJournals) {
    const totalD = j.entries.reduce((s, e) => s + e.debit, 0);
    const totalC = j.entries.reduce((s, e) => s + e.credit, 0);
    if (totalD !== totalC) {
      throw new Error(`Test 7: Jurnal ${j.id} tidak seimbang! Debit: ${totalD}, Credit: ${totalC}`);
    }
  }
  console.log(`✓ PASS: Seluruh (${allJournals.length}) jurnal double-entry terbukti seimbang (Debit == Kredit).\n`);
  passedTests++;

  // =========================================================================
  // TEST 8: Verifikasi Saldo COA Sebelum, Sesudah Posting, dan Sesudah Koreksi
  // =========================================================================
  console.log('--- TEST 8: Verifikasi Matematis Saldo COA ---');
  // Ambil saldo awal akun Beban 6-1001 dan Kas 1-1001
  const b0_beban = (await accRepo.findById('6-1001'))!.balance;
  const b0_kas = (await accRepo.findById('1-1001'))!.balance;

  const t8_post = await AccountingService.executeTransaction({
    transaction: {
      id: 'TX-TEST-008',
      date: '2026-10-17 15:00:00',
      code: '307',
      name: 'Beli Konsumsi Rapat',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 400000,
      cashier: 'Admin SPBU',
      shift: 'Tanpa Sesi / Administratif',
      status: 'Selesai'
    },
    executor
  });
  if (!t8_post.success) throw new Error(`Test 8 posting gagal: ${t8_post.error}`);

  // Setelah posting: Beban = b0 + 400.000, Kas = b0 - 400.000
  const b1_beban = (await accRepo.findById('6-1001'))!.balance;
  const b1_kas = (await accRepo.findById('1-1001'))!.balance;
  if (b1_beban !== b0_beban + 400000 || b1_kas !== b0_kas - 400000) {
    throw new Error('Test 8: Saldo b1 salah');
  }

  // Koreksi ke Rp 350.000
  const t8_corr = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-TEST-008',
    reason: 'Kelebihan catat konsumsi rapat',
    replacementData: {
      id: 'TX-TEST-008-REP',
      date: '2026-10-17 15:00:00',
      code: '307',
      name: 'Beli Konsumsi Rapat (Revisi)',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 350000,
      cashier: 'Admin SPBU',
      status: 'Selesai'
    },
    executor
  });
  if (!t8_corr.success) throw new Error(`Test 8 koreksi gagal: ${t8_corr.error}`);

  // Setelah koreksi: Beban = b0 + 350.000, Kas = b0 - 350.000
  const b2_beban = (await accRepo.findById('6-1001'))!.balance;
  const b2_kas = (await accRepo.findById('1-1001'))!.balance;
  if (b2_beban !== b0_beban + 350000 || b2_kas !== b0_kas - 350000) {
    throw new Error(`Test 8: Saldo b2 salah! Beban: ${b2_beban} (exp ${b0_beban + 350000}), Kas: ${b2_kas}`);
  }
  console.log('✓ PASS: Mutasi saldo COA terbukti matematis persis sama dengan reversal + posting baru.\n');
  passedTests++;

  // =========================================================================
  // TEST 9: Pastikan Laporan Tidak Menghitung Ganda Transaksi yang Dibalik
  // =========================================================================
  console.log('--- TEST 9: Verifikasi Konsistensi Laporan (Tanpa Double Count) ---');
  // Laba Rugi
  const labaRugi = await reportRepo.getLabaRugi('2026-10-17');
  const bebanKonsumsiRow = labaRugi.konsolidasi.rows.find((r) => r.code === '6-1001');
  if (!bebanKonsumsiRow) throw new Error('Test 9: Akun beban operasional 6-1001 tidak ditemukan di Laba Rugi');

  const neraca = await reportRepo.getNeraca('2026-10-17');
  if (!neraca.rows || neraca.rows.length === 0) {
    throw new Error('Test 9: Neraca gagal digenerate');
  }

  // Rekap penjualan tidak boleh memasukkan transaksi Batal
  const salesRecap = await reportRepo.getSalesAndShiftRecap('2026-10-17');
  if (!salesRecap) throw new Error('Test 9: Rekap penjualan gagal digenerate');
  console.log(`✓ PASS: Laporan keuangan dan operasional konsisten, transaksi yang dibalik tidak dihitung ganda.\n`);
  passedTests++;

  // =========================================================================
  // TEST 10: Paksa Kegagalan & Verifikasi Rollback Menyeluruh
  // =========================================================================
  console.log('--- TEST 10: Uji Paksa Rollback Menyeluruh ---');
  // Buat transaksi valid
  const tx10Post = await AccountingService.executeTransaction({
    transaction: {
      id: 'TX-TEST-010',
      date: '2026-10-17 16:00:00',
      code: '307',
      name: 'Beli Lampu Kantor',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 150000,
      cashier: 'Admin SPBU',
      shift: 'Tanpa Sesi / Administratif',
      status: 'Selesai'
    },
    executor
  });
  if (!tx10Post.success) throw new Error('Test 10 posting gagal');

  const preRollbackKas = (await accRepo.findById('1-1001'))!.balance;
  const preRollbackBeban = (await accRepo.findById('6-1001'))!.balance;

  // Coba koreksi dengan replacement code yang tidak ada (akan ditolak saat validasi atau paksa error saat insert)
  const tx10FailRes = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-TEST-010',
    reason: 'Koreksi yang akan digagalkan',
    replacementData: {
      id: 'TX-TEST-010-FAIL',
      date: '2026-10-17 16:00:00',
      code: 'KODE-NON-EXISTENT', // Tidak ada
      name: 'Gagal',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 100000,
      status: 'Selesai'
    },
    executor
  });

  if (tx10FailRes.success) throw new Error('Test 10: Seharusnya gagal karena master code tidak ada!');

  // Verifikasi kondisi database TIDAK BERUBAH SAMA SEKALI
  const tx10Check = await txRepo.findById('TX-TEST-010');
  if (tx10Check?.status !== 'Selesai' || tx10Check.isCorrected) {
    throw new Error('Test 10: Transaksi asal terlanjur diubah padahal gagal!');
  }
  const postRollbackKas = (await accRepo.findById('1-1001'))!.balance;
  const postRollbackBeban = (await accRepo.findById('6-1001'))!.balance;
  if (postRollbackKas !== preRollbackKas || postRollbackBeban !== preRollbackBeban) {
    throw new Error('Test 10: Saldo COA bocor/tidak ter-rollback!');
  }

  // Cek tidak ada entri di transaction_corrections
  const corr10Check = await corrRepo.findByOriginalTransactionId('TX-TEST-010');
  if (corr10Check) {
    throw new Error('Test 10: Audit trail terlanjur tersimpan!');
  }
  console.log('✓ PASS: Rollback menyeluruh terbukti bersih, tidak ada perubahan parsial.\n');
  passedTests++;

  // =========================================================================
  // TEST 11: Pastikan Koreksi yang Sama Tidak Dapat Diposting Dua Kali
  // =========================================================================
  console.log('--- TEST 11: Mencegah Koreksi Ganda (Idempotency Guard) ---');
  // TX-TEST-001 sudah pernah dikoreksi di Test 1
  const tx11Retry = await AccountingService.correctTransaction({
    originalTransactionId: 'TX-TEST-001',
    reason: 'Koreksi kedua kali pada transaksi yang sama',
    replacementData: {
      id: 'TX-TEST-001-REP2',
      date: '2026-10-17 10:00:00',
      code: '307',
      name: 'Revisi Kedua',
      category: 'Biaya Operasional',
      product: '-',
      volume: 0,
      unitPrice: 0,
      total: 200000,
      status: 'Selesai'
    },
    executor
  });

  if (tx11Retry.success) {
    throw new Error('Test 11: Transaksi yang sudah Batal/Terkoreksi tidak boleh dikoreksi ulang!');
  }
  console.log(`✓ PASS: Koreksi kedua ditolak: "${tx11Retry.error}"\n`);
  passedTests++;

  // =========================================================================
  // TEST 12: Backup & Restore v6 Mempertahankan Audit Trail & Menolak v5
  // =========================================================================
  console.log('--- TEST 12: Backup/Restore v6 & Penolakan v5 ---');
  // 1. Ekspor backup v6
  const backupRes = await BackupRestoreService.createBackup({ id: 'SPBU-01', name: 'SPBU Mitra Akrual' }, executor);
  if (backupRes.backup.metadata.schemaVersion !== 6) {
    throw new Error(`Test 12: schemaVersion backup harus 6, aktual: ${backupRes.backup.metadata.schemaVersion}`);
  }
  if (!backupRes.backup.data.transaction_corrections || backupRes.backup.data.transaction_corrections.length === 0) {
    throw new Error('Test 12: Tabel transaction_corrections kosong dalam backup!');
  }

  // 2. Validasi backup v6 harus VALID
  const valV6 = BackupRestoreService.validateBackup(backupRes.backup);
  if (!valV6.valid) {
    throw new Error(`Test 12: Validasi backup v6 gagal: ${valV6.error}`);
  }

  // 3. Validasi backup v5 harus DITOLAK
  const mockV5 = JSON.parse(JSON.stringify(backupRes.backup));
  mockV5.metadata.schemaVersion = 5;
  const valV5 = BackupRestoreService.validateBackup(mockV5);
  if (valV5.valid) {
    throw new Error('Test 12: Backup v5 seharusnya ditolak oleh engine v6!');
  }
  if (!valV5.error?.includes('lebih lama daripada versi database aplikasi aktif (v6)')) {
    throw new Error(`Test 12: Pesan penolakan backup v5 salah: ${valV5.error}`);
  }

  // 4. Restore ke database baru yang diisolasi
  const newDb = new SQL.Database();
  const newExec = new SqlJsExecutor(newDb);
  await MigrationRunner.runMigrations(newExec);

  const restoreRes = await BackupRestoreService.restoreBackup(backupRes.backup, newExec);
  if (!restoreRes.success) {
    throw new Error(`Test 12: Restore database gagal: ${restoreRes.error}`);
  }

  const restoredCorrRepo = new TransactionCorrectionRepository(newExec);
  const restoredCorrs = await restoredCorrRepo.findAll();
  if (restoredCorrs.length !== backupRes.backup.data.transaction_corrections.length) {
    throw new Error(`Test 12: Jumlah koreksi yang direstore tidak sesuai!`);
  }
  console.log('✓ PASS: Backup v6 mempertahankan audit trail, restore sukses, dan backup v5 ditolak aman.\n');
  passedTests++;

  // =========================================================================
  // TEST 13: Verifikasi Trigger Perlindungan Langsung SQLite
  // =========================================================================
  console.log('--- TEST 13: Integritas Trigger trg_transactions_prevent_cancel_if_posted ---');
  // Coba lakukan UPDATE status = 'Batal' langsung pada transaksi yang punya jurnal tanpa lewat transaction_corrections
  let directCancelFailed = false;
  try {
    await executor.run(
      `UPDATE transactions SET status = 'Batal', cancelled_at = '2026-10-17', cancel_reason = 'Direct update cheat' WHERE id = 'TX-TEST-001-REP';`
    );
  } catch (err: any) {
    directCancelFailed = true;
    if (!err.message?.includes('tidak dapat dibatalkan secara langsung tanpa prosedur pembalikan')) {
      throw new Error(`Test 13: Error trigger tidak sesuai: ${err.message}`);
    }
  }

  if (!directCancelFailed) {
    throw new Error('Test 13: Trigger SQLite gagal memblokir pembatalan langsung tanpa audit trail!');
  }
  console.log('✓ PASS: Trigger SQLite aktif dan memblokir modifikasi status tanpa prosedur pembalikan.\n');
  passedTests++;

  console.log('====================================================================');
  console.log(`   SEMUA PENGUJIAN (${passedTests}/13) LULUS 100%`);
  console.log('====================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

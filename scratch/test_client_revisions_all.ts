/**
 * TEST SUITE: 4 REVISI CLIENT
 * 1. Laporan Neraca & Laba Rugi — Satu tanda tangan kanan bawah & Header lokasi rata tengah
 * 2. Persistensi Nama Pimpinan pada Pengaturan
 * 3. Master Vendor & Pelanggan — CRUD & Relational Reference Protection
 * 4. Pembayaran Utang (Kode 315) — Vendor-first, Filter Tagihan, Validasi Nominal, Pelunasan Parsial & Penuh
 */

import initSqlJs from 'sql.js';
import { SqlExecutor, MigrationRunner } from '../src/services/database/migrationRunner';
import { MIGRATIONS } from '../src/services/database/migrations';
import { MasterDataService } from '../src/services/database/masterDataService';
import { AccountRepository } from '../src/services/database/repositories/accountRepository';
import { BusinessPartnerRepository } from '../src/services/database/repositories/businessPartnerRepository';
import { PayableRepository } from '../src/services/database/repositories/payableRepository';
import { ReportRepository } from '../src/services/database/repositories/reportRepository';
import { AccountingService } from '../src/services/database/accountingService';
import { exportNeracaPdf, exportLabaRugiPdf, exportArusKasPdf, exportStokPdf } from '../src/services/pdfExport';
import * as fs from 'fs';
import * as path from 'path';
import type { StationInfo, Transaction, BusinessPartner } from '../src/types';

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

async function runAllTests() {
  console.log('====================================================================');
  console.log('   TEST SUITE: VERIFIKASI 4 REVISI CLIENT (SPBU MITRA AKRUAL)');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  const executor = new SqlJsExecutor(rawDb);

  // 1. Inisialisasi Migrasi Database
  console.log('--- SETUP: Menjalankan Migrasi Skema v1-v4 ---');
  const migResult = await MigrationRunner.runMigrations(executor, MIGRATIONS);
  console.log(`✓ Migrasi selesai, versi skema saat ini: v${migResult.currentVersion}`);

  // Seeding master data
  const seedSummary = await MasterDataService.initializeMasterData(executor);
  console.log(`✓ Seed master data selesai: ${seedSummary.accountsSeeded} akun, ${seedSummary.partnersSeeded} mitra`);

  // ===========================================================================
  // REVISI 2: PERSISTENSI NAMA PIMPINAN PADA PENGATURAN
  // ===========================================================================
  console.log('\n====================================================================');
  console.log('1. REVISI 2: PERSISTENSI NAMA PIMPINAN PADA PENGATURAN');
  console.log('====================================================================');

  // Pastikan tabel station_info ada dan memiliki kolom manager
  const tableInfo = await executor.query<any>('PRAGMA table_info(station_info);');
  const hasManagerCol = tableInfo.some((col: any) => col.name === 'manager');
  console.log(`✓ PRAGMA table_info(station_info) -> Kolom 'manager' ada: ${hasManagerCol}`);
  if (!hasManagerCol) throw new Error('Kolom manager tidak ditemukan di station_info!');

  // Simpan data pimpinan baru menggunakan safe UPDATE
  const initialInfo: StationInfo = {
    id: 'SPBU-14.201.1954',
    name: 'PT SPBU Mitra Akrual 1954',
    address: 'Jl. Raya Lintas Sumatera KM 32, Kayutanam, Padang Pariaman, Sumatera Barat (Alamat Panjang untuk Pengujian Wrapping Header)',
    phone: '081234567890',
    manager: 'Ir. H. Budi Santoso, M.M.',
    email: 'spbu1954@mitraakrual.com',
    status: 'Operasional Aktif'
  };

  const existingStation = await executor.query<any>('SELECT id FROM station_info LIMIT 1;');
  const existingId = existingStation.length > 0 ? existingStation[0].id : initialInfo.id;
  const nowIso = new Date().toISOString();
  await executor.run(
    `UPDATE station_info SET
       id = ?,
       name = ?,
       address = ?,
       phone = ?,
       manager = ?,
       email = ?,
       status = ?,
       updated_at = ?
     WHERE id = ?;`,
    [
      initialInfo.id,
      initialInfo.name,
      initialInfo.address,
      initialInfo.phone,
      initialInfo.manager,
      initialInfo.email,
      initialInfo.status,
      nowIso,
      existingId
    ]
  );

  // Verifikasi query langsung ke SQLite
  const savedRow = await executor.query<any>('SELECT * FROM station_info WHERE id = ?;', [initialInfo.id]);
  if (!savedRow || savedRow.length === 0) throw new Error('Data station_info tidak ditemukan!');
  console.log(`✓ SQLite query langsung: manager = "${savedRow[0].manager}", address = "${savedRow[0].address.slice(0, 30)}..."`);
  if (savedRow[0].manager !== 'Ir. H. Budi Santoso, M.M.') {
    throw new Error(`Nama pimpinan di SQLite (${savedRow[0].manager}) tidak sesuai!`);
  }

  // Verifikasi reload via MasterDataService.loadAllMasterData
  const reloadedSnapshot = await MasterDataService.loadAllMasterData(executor);
  if (!reloadedSnapshot.stationInfo) throw new Error('stationInfo undefined setelah loadAllMasterData!');
  console.log(`✓ Snapshot reload: manager = "${reloadedSnapshot.stationInfo.manager}"`);
  if (reloadedSnapshot.stationInfo.manager !== 'Ir. H. Budi Santoso, M.M.') {
    throw new Error('Manager name mismatch after snapshot reload!');
  }

  // ===========================================================================
  // REVISI 1: LAPORAN NERACA & LABA RUGI — SATU TANDA TANGAN DI KANAN BAWAH & HEADER
  // ===========================================================================
  console.log('\n====================================================================');
  console.log('2. REVISI 1: LAPORAN NERACA & LABA RUGI — TANDA TANGAN & HEADER');
  console.log('====================================================================');

  const reportRepo = new ReportRepository(executor);
  const reportsData = await reportRepo.getAllReports(undefined, reloadedSnapshot.stationInfo);

  if (!reportsData.neracaKonsolidasi) throw new Error('Neraca konsolidasi kosong!');
  if (!reportsData.labaRugiKonsolidasi) throw new Error('Laba rugi konsolidasi kosong!');

  console.log(`✓ Neraca konsolidasi: entityName = "${reportsData.neracaKonsolidasi.entityName}", location = "${reportsData.neracaKonsolidasi.location.slice(0, 30)}..."`);
  console.log(`✓ Laba Rugi konsolidasi: entityName = "${reportsData.labaRugiKonsolidasi.entityName}", location = "${reportsData.labaRugiKonsolidasi.location.slice(0, 30)}..."`);

  // Verifikasi file printService.ts dan index.css
  const printServiceContent = fs.readFileSync(path.resolve(process.cwd(), 'src/services/printService.ts'), 'utf-8');
  const indexCssContent = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
  const laporanContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Laporan.tsx'), 'utf-8');

  // 1. Verifikasi printService.ts
  const hasOldPembukuanPrint = printServiceContent.includes('Pembukuan');
  const hasLeaderSignPrint = printServiceContent.includes('Direksi / Pimpinan');
  const hasFlexEndPrint = printServiceContent.includes('justify-content: flex-end');
  console.log(`✓ printService: Blok Pembukuan lama hilang: ${!hasOldPembukuanPrint}`);
  console.log(`✓ printService: Blok Pimpinan ada: ${hasLeaderSignPrint}`);
  console.log(`✓ printService: Posisi kanan bawah (flex-end): ${hasFlexEndPrint}`);
  if (hasOldPembukuanPrint) throw new Error('printService.ts masih mengandung tanda tangan Pembukuan lama!');
  if (!hasLeaderSignPrint || !hasFlexEndPrint) throw new Error('printService.ts tidak memuat tanda tangan pimpinan kanan bawah!');

  // 2. Verifikasi index.css
  const hasFlexEndCss = indexCssContent.includes('.formal-report-sign-area') && indexCssContent.includes('justify-content: flex-end');
  const hasCenteredLocCss = indexCssContent.includes('.formal-report-location') && indexCssContent.includes('text-align: center');
  console.log(`✓ index.css: .formal-report-sign-area memiliki justify-content: flex-end: ${hasFlexEndCss}`);
  console.log(`✓ index.css: .formal-report-location memiliki text-align: center: ${hasCenteredLocCss}`);
  if (!hasFlexEndCss) throw new Error('index.css belum memposisikan tanda tangan di kanan bawah!');
  if (!hasCenteredLocCss) throw new Error('index.css belum memposisikan header lokasi rata tengah!');

  // 3. Verifikasi Laporan.tsx
  const hasOldPembukuanLaporan = laporanContent.includes('Pembukuan');
  const hasSingleSignLaporan = laporanContent.includes('stationInfo?.manager || \'Direksi / Pimpinan\'');
  console.log(`✓ Laporan.tsx: Blok Pembukuan lama hilang: ${!hasOldPembukuanLaporan}`);
  console.log(`✓ Laporan.tsx: Blok Pimpinan dengan stationInfo?.manager ada: ${hasSingleSignLaporan}`);
  if (hasOldPembukuanLaporan) throw new Error('Laporan.tsx masih mengandung tanda tangan Pembukuan lama!');
  if (!hasSingleSignLaporan) throw new Error('Laporan.tsx tidak membaca nama pimpinan dari stationInfo!');

  // Verifikasi PDF Generasi (jspdf)
  console.log('--- Menguji Ekspor PDF Resmi ---');
  const resNeracaPdf = await exportNeracaPdf(reportsData, reloadedSnapshot.stationInfo);
  console.log(`✓ PDF Neraca berhasil di-generate: ${resNeracaPdf.filename} (success=${resNeracaPdf.success})`);
  if (!resNeracaPdf.success) throw new Error('PDF Neraca gagal dibuat!');

  const resLrPdf = await exportLabaRugiPdf(reportsData, reloadedSnapshot.stationInfo);
  console.log(`✓ PDF Laba Rugi berhasil di-generate: ${resLrPdf.filename} (success=${resLrPdf.success})`);
  if (!resLrPdf.success) throw new Error('PDF Laba Rugi gagal dibuat!');

  const resAkPdf = await exportArusKasPdf(reportsData, reloadedSnapshot.stationInfo);
  console.log(`✓ PDF Arus Kas berhasil di-generate: ${resAkPdf.filename} (success=${resAkPdf.success})`);
  if (!resAkPdf.success) throw new Error('PDF Arus Kas gagal dibuat!');

  const resStokPdf = await exportStokPdf(reportsData, reloadedSnapshot.stationInfo);
  console.log(`✓ PDF Stok & Penjualan berhasil di-generate: ${resStokPdf.filename} (success=${resStokPdf.success})`);
  if (!resStokPdf.success) throw new Error('PDF Stok & Penjualan gagal dibuat!');

  // ===========================================================================
  // REVISI 3: MASTER VENDOR & PELANGGAN
  // ===========================================================================
  console.log('\n====================================================================');
  console.log('3. REVISI 3: MASTER VENDOR & PELANGGAN');
  console.log('====================================================================');

  const partnerRepo = new BusinessPartnerRepository(executor);

  // 1. Tambah Vendor Baru
  const newVendor: BusinessPartner = {
    id: 'BP-VEND-99',
    code: 'V-PERTAMINA-REG1',
    name: 'PT Pertamina Patra Niaga Regional 1',
    type: 'Vendor',
    phone: '081199887766',
    address: 'Terminal BBM Teluk Kabung, Padang',
    isActive: true
  };
  await partnerRepo.create(newVendor);
  console.log(`✓ Berhasil menambahkan vendor baru: [${newVendor.code}] ${newVendor.name}`);

  // 2. Query dari SQLite
  const fetchedVendor = await partnerRepo.findById(newVendor.id);
  if (!fetchedVendor) throw new Error('Vendor yang baru disimpan tidak ditemukan di SQLite!');
  console.log(`✓ Berhasil fetch vendor dari SQLite: ID=${fetchedVendor.id}, Nama=${fetchedVendor.name}, Aktif=${fetchedVendor.isActive}`);
  if (fetchedVendor.isActive !== true) throw new Error('Status aktif vendor tidak sesuai!');

  // 3. Update Vendor (Edit & Nonaktifkan)
  await partnerRepo.update(newVendor.id, {
    name: 'PT Pertamina Patra Niaga Regional 1 (Sumbagut)',
    isActive: false
  });
  const updatedVendor = await partnerRepo.findById(newVendor.id);
  if (!updatedVendor) throw new Error('Vendor gagal di-update!');
  console.log(`✓ Update vendor berhasil: Nama="${updatedVendor.name}", Aktif=${updatedVendor.isActive}`);
  if (updatedVendor.isActive !== false) throw new Error('Status nonaktif vendor gagal diterapkan!');

  // 4. Verifikasi activeOnly filtering
  const allVendors = await partnerRepo.findByType('Vendor');
  const activeVendors = await partnerRepo.findByType('Vendor', { activeOnly: true });
  console.log(`✓ Total Vendor: ${allVendors.length}, Vendor Aktif Saja: ${activeVendors.length}`);
  const hasInactiveInActiveList = activeVendors.some(v => v.id === newVendor.id);
  if (hasInactiveInActiveList) throw new Error('Vendor nonaktif masuk ke filter activeOnly!');

  // 5. Verifikasi Proteksi Relasional (isReferenced)
  // Vendor tanpa transaksi bisa dihapus
  const isRefBefore = await partnerRepo.isReferenced(newVendor.id);
  console.log(`✓ isReferenced untuk vendor tanpa transaksi: ${isRefBefore}`);
  if (isRefBefore !== false) throw new Error('Vendor baru seharusnya belum berelasi!');

  // Kaitkan vendor ke tabel payables (simulasi utang diawali transaksi pembelian kredit)
  const payRepo = new PayableRepository(executor);
  const testPayableId = 'PAY-TEST-001';
  const initTxId = 'TX-INIT-001';
  await executor.run(
    `INSERT INTO transactions (id, date, code, name, category, cashier, payment_method, partner_id, total, status, created_at, updated_at)
     VALUES (?, '2026-10-16', '201', 'Pembelian DO Pertalite', 'Pembelian', 'Admin', 'Hutang', ?, 15000000, 'Selesai', ?, ?);`,
    [initTxId, newVendor.id, nowIso, nowIso]
  );

  await payRepo.create({
    id: testPayableId,
    transactionId: initTxId,
    partnerId: newVendor.id,
    partnerName: newVendor.name,
    amount: 15000000,
    outstanding: 15000000,
    status: 'Open',
    date: '2026-10-16',
    notes: 'DO Pertalite 15KL'
  });

  // Sekarang vendor sudah memiliki relasi di payables
  const isRefAfter = await partnerRepo.isReferenced(newVendor.id);
  console.log(`✓ isReferenced setelah dikaitkan dengan tagihan hutang: ${isRefAfter}`);
  if (!isRefAfter) throw new Error('isReferenced gagal mendeteksi relasi pada tabel payables!');

  // ===========================================================================
  // REVISI 4: PEMBAYARAN UTANG (KODE 315)
  // ===========================================================================
  console.log('\n====================================================================');
  console.log('4. REVISI 4: PEMBAYARAN UTANG (KODE 315)');
  console.log('====================================================================');

  const accountingService = new AccountingService(executor);
  const accRepo = new AccountRepository(executor);

  // Set saldo awal kas (1-1001) dan utang (2-1001)
  await accRepo.update('1-1001', { balance: 50000000 });
  await accRepo.update('2-1001', { balance: 30000000 });

  // 1. Uji Filter Tagihan berdasarkan Vendor
  const billsForVendor = await executor.query<any>(
    `SELECT * FROM payables WHERE partner_id = ? AND outstanding > 0 AND status IN ('Open', 'Partial');`,
    [newVendor.id]
  );
  console.log(`✓ Tagihan belum lunas untuk vendor ${newVendor.code}: ${billsForVendor.length} tagihan`);
  if (billsForVendor.length !== 1 || billsForVendor[0].id !== testPayableId) {
    throw new Error('Filter tagihan per vendor tidak sesuai!');
  }

  // 2. Validasi Pembayaran Melebihi Sisa Utang (Harus Ditolak)
  const invalidTxOverpaid: Transaction = {
    id: 'TX-PAY-ERR1',
    date: '2026-10-16T10:00:00Z',
    code: '315',
    name: 'Pembayaran Utang BBM Melebihi Saldo',
    category: 'Pelunasan',
    paymentMethod: 'Tunai',
    partnerId: newVendor.id,
    partnerName: newVendor.name,
    relatedPayableId: testPayableId,
    amount: 20000000, // Melebihi outstanding 15.000.000
    total: 20000000,
    status: 'Selesai'
  };

  const overpayResult = await AccountingService.executeTransaction({ transaction: invalidTxOverpaid, executor });
  console.log(`✓ Pembayaran melebihi sisa utang ditolak: success=${overpayResult.success}, error="${overpayResult.error}"`);
  if (overpayResult.success) throw new Error('Pembayaran melebihi sisa utang seharusnya ditolak!');

  // 3. Uji Pembayaran Sebagian (Partial Settlement)
  const partialTx: Transaction = {
    id: 'TX-PAY-PARTIAL',
    date: '2026-10-16T11:00:00Z',
    code: '315',
    name: 'Pembayaran Sebagian Utang DO Pertalite',
    category: 'Pelunasan',
    paymentMethod: 'Tunai',
    partnerId: newVendor.id,
    partnerName: newVendor.name,
    relatedPayableId: testPayableId,
    amount: 5000000, // Bayar 5jt dari 15jt
    total: 5000000,
    status: 'Selesai'
  };

  const partialResult = await AccountingService.executeTransaction({ transaction: partialTx, executor });
  if (!partialResult.success) throw new Error(`Pembayaran sebagian gagal: ${partialResult.error}`);
  console.log(`✓ Pembayaran sebagian berhasil: Jurnal ID = ${partialResult.journal?.id}`);

  // Periksa status payable setelah partial payment
  const payableAfterPartial = await payRepo.findById(testPayableId);
  if (!payableAfterPartial) throw new Error('Payable hilang!');
  console.log(`✓ Status Tagihan setelah pembayaran sebagian: outstanding = Rp ${payableAfterPartial.outstanding.toLocaleString('id-ID')}, status = "${payableAfterPartial.status}"`);
  if (payableAfterPartial.outstanding !== 10000000 || payableAfterPartial.status !== 'Partial') {
    throw new Error('Perhitungan sisa utang atau status partial salah!');
  }

  // 4. Uji Pelunasan Penuh (Full Settlement)
  const fullTx: Transaction = {
    id: 'TX-PAY-FULL',
    date: '2026-10-16T14:00:00Z',
    code: '315',
    name: 'Pelunasan Sisa Utang DO Pertalite',
    category: 'Pelunasan',
    paymentMethod: 'Tunai',
    partnerId: newVendor.id,
    partnerName: newVendor.name,
    relatedPayableId: testPayableId,
    amount: 10000000, // Lunasi sisa 10jt
    total: 10000000,
    status: 'Selesai'
  };

  const fullResult = await AccountingService.executeTransaction({ transaction: fullTx, executor });
  if (!fullResult.success) throw new Error(`Pelunasan penuh gagal: ${fullResult.error}`);
  console.log(`✓ Pelunasan penuh berhasil: Jurnal ID = ${fullResult.journal?.id}`);

  // Periksa status payable setelah lunas
  const payableAfterFull = await payRepo.findById(testPayableId);
  if (!payableAfterFull) throw new Error('Payable hilang!');
  console.log(`✓ Status Tagihan setelah pelunasan penuh: outstanding = Rp ${payableAfterFull.outstanding}, status = "${payableAfterFull.status}"`);
  if (payableAfterFull.outstanding !== 0 || payableAfterFull.status !== 'Paid') {
    throw new Error('Perhitungan sisa utang atau status paid salah!');
  }

  // 5. Tagihan yang sudah Paid tidak boleh dibayar lagi
  const alreadyPaidTx: Transaction = {
    id: 'TX-PAY-AGAIN',
    date: '2026-10-16T15:00:00Z',
    code: '315',
    name: 'Coba Bayar Tagihan yang Sudah Lunas',
    category: 'Pelunasan',
    paymentMethod: 'Tunai',
    partnerId: newVendor.id,
    partnerName: newVendor.name,
    relatedPayableId: testPayableId,
    amount: 1000000,
    total: 1000000,
    status: 'Selesai'
  };
  const alreadyPaidResult = await AccountingService.executeTransaction({ transaction: alreadyPaidTx, executor });
  console.log(`✓ Pembayaran tagihan berstatus Paid ditolak: success=${alreadyPaidResult.success}, error="${alreadyPaidResult.error}"`);
  if (alreadyPaidResult.success) throw new Error('Tagihan yang sudah berstatus Paid seharusnya ditolak!');

  // 6. Verifikasi Keseimbangan Jurnal Double-Entry
  const allJournals = await executor.query<any>('SELECT * FROM journals;');
  console.log(`✓ Total Jurnal Tercatat di SQLite: ${allJournals.length}`);
  for (const j of allJournals) {
    const entries = await executor.query<any>('SELECT * FROM journal_entries WHERE journal_id = ?;', [j.id]);
    let debitSum = 0;
    let creditSum = 0;
    for (const e of entries) {
      debitSum += Number(e.debit);
      creditSum += Number(e.credit);
    }
    if (Math.abs(debitSum - creditSum) > 0.01) {
      throw new Error(`Jurnal ${j.id} tidak seimbang! Debit: ${debitSum}, Kredit: ${creditSum}`);
    }
  }
  console.log(`✓ Seluruh ${allJournals.length} jurnal transaksi double-entry terverifikasi SEIMBANG (Debit == Kredit)`);

  console.log('\n====================================================================');
  console.log('   SELURUH PENGUJIAN 4 REVISI CLIENT BERHASIL LULUS 100%!');
  console.log('====================================================================\n');
}

runAllTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

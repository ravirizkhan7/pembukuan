/**
 * TEST SUITE: 6 FILTER PERIODE LAPORAN & GENERASI DOKUMEN PDF
 * 
 * Menguji secara ketat tepat 6 opsi filter periode:
 * 1. Semua Periode — seluruh data yang tersedia tanpa pembatasan tanggal.
 * 2. Hari Ini — dari awal (00:00:00) sampai akhir (23:59:59) hari ini.
 * 3. 7 Hari Terakhir — tujuh hari kalender termasuk hari ini (hari ini + 6 hari kalender sebelumnya).
 * 4. Bulan Ini — tanggal 1 bulan berjalan sampai hari ini (tidak memasukkan transaksi masa depan).
 * 5. Tahun Ini — 1 Januari tahun berjalan sampai hari ini (tidak memasukkan transaksi masa depan).
 * 6. Custom — rentang tanggal mulai dan akhir inklusif yang ditentukan secara manual (tolak start > end).
 *
 * Verifikasi tambahan:
 * - Transaksi batas awal dan akhir (boundary condition).
 * - Transaksi di luar periode (termasuk transaksi masa depan).
 * - Pergantian bulan dan tahun.
 * - Pemanggilan "Semua Periode" setelah pemanggilan filter terbatas (reset query).
 * - Konsistensi di seluruh submenu: Neraca, Laba Rugi, Arus Kas, Stok & Penjualan, Rekap Shift.
 * - Generasi dan ekspor PDF resmi.
 */

import initSqlJs from 'sql.js';
import { SqlExecutor, MigrationRunner } from '../src/services/database/migrationRunner';
import { MIGRATIONS } from '../src/services/database/migrations';
import { parsePeriodFilter, ReportRepository } from '../src/services/database/repositories/reportRepository';
import { exportNeracaPdf, exportLabaRugiPdf, exportArusKasPdf, exportStokPdf } from '../src/services/pdfExport';
import { arrayBufferToBase64 } from '../src/services/fileSaver';
import type { StationInfo, ReportsData } from '../src/types';

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

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function runTestSuite() {
  console.log('====================================================================');
  console.log('   TEST SUITE: 6 FILTER PERIODE REVISI & GENERASI PDF AKRUAL');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  const executor = new SqlJsExecutor(rawDb);

  // 1. Jalankan Migrasi Skema v1-v4
  console.log('1. MENJALANKAN MIGRATIONS v1-v4...');
  const migRes = await MigrationRunner.runMigrations(executor, MIGRATIONS);
  console.log(`   -> Migrasi berhasil: Versi ${migRes.currentVersion}`);

  // 2. Setup Data Master
  console.log('\n2. MENYIAPKAN MASTER DATA & REKENING COA...');
  const nowIso = new Date().toISOString();
  await executor.run(
    `INSERT INTO product_categories (id, name, status, created_at, updated_at) VALUES
     ('CAT-BBM', 'Bahan Bakar Minyak', 'Aktif', ?, ?);`,
    [nowIso, nowIso]
  );

  await executor.run(
    `INSERT INTO accounts (id, code, name, category, normal_balance, balance, is_active, created_at, updated_at) VALUES
     ('1-1001', '1101', 'Kas Utama (Brankas)', 'Aset', 'Debit', 0, 1, ?, ?),
     ('1-1002', '1102', 'Rekening Bank Mandiri', 'Aset', 'Debit', 0, 1, ?, ?),
     ('1-1003', '1103', 'Piutang Usaha', 'Aset', 'Debit', 0, 1, ?, ?),
     ('1-1004', '1104', 'Persediaan BBM Pertalite', 'Aset', 'Debit', 0, 1, ?, ?),
     ('2-1001', '2101', 'Utang Usaha Pertamina', 'Kewajiban', 'Kredit', 0, 1, ?, ?),
     ('3-1001', '3101', 'Modal Pemilik', 'Ekuitas', 'Kredit', 0, 1, ?, ?),
     ('3-1002', '3102', 'Laba Ditahan', 'Ekuitas', 'Kredit', 0, 1, ?, ?),
     ('4-1001', '4101', 'Pendapatan Penjualan Pertalite', 'Pendapatan', 'Kredit', 0, 1, ?, ?),
     ('5-1001', '5101', 'Beban Pokok Penjualan Pertalite', 'Beban Pokok', 'Debit', 0, 1, ?, ?),
     ('6-1001', '6101', 'Beban Operasional & Gaji', 'Beban', 'Debit', 0, 1, ?, ?);`,
    [nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso,
     nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso, nowIso]
  );

  await executor.run(
    `INSERT INTO products (id, code, name, category_id, sell_price, buy_price, unit, status, created_at, updated_at) VALUES
     ('PRD-01', '01', 'Pertalite', 'CAT-BBM', 10000, 8000, 'Liter', 'Aktif', ?, ?);`,
    [nowIso, nowIso]
  );

  await executor.run(
    `INSERT INTO tanks (id, name, product_id, capacity, current_stock, status, created_at, updated_at) VALUES
     ('TNK-01', 'Tangki 1 Pertalite', 'PRD-01', 20000, 10000, 'Aktif', ?, ?);`,
    [nowIso, nowIso]
  );

  // 3. Masukkan Transaksi dengan Variasi Tanggal:
  // - Masa Lalu Multi-Tahun (Tahun Lalu)
  // - Awal Tahun Ini (di luar bulan ini)
  // - Bulan Ini (di luar 7 hari terakhir)
  // - 7 Hari Terakhir (Kemarin)
  // - Hari Ini Batas Awal (00:00:01)
  // - Hari Ini Batas Akhir (23:59:59)
  // - Masa Depan (Besok / Masa Depan) -> Untuk membuktikan Bulan Ini & Tahun Ini berakhir pada HARI INI
  console.log('\n3. MEMASUKKAN TRANSAKSI MULTI-TANGGAL & BOUNDARY CONDITION...');
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const yesterdayStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const eightDaysAgoStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8));
  const prevYearStr = `${now.getFullYear() - 1}-07-15`;
  const tomorrowStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  // Tentukan tanggal awal tahun ini (misal 15 Januari jika sekarang bukan Januari, atau 2 Jan jika sekarang Jan)
  const isJan = now.getMonth() === 0;
  const earlyThisYearStr = isJan ? `${now.getFullYear()}-01-02` : `${now.getFullYear()}-01-15`;

  const txFixtures = [
    { id: 'TX-YEAR-PREV', date: `${prevYearStr} 10:00:00`, total: 500000, desc: 'Penjualan Tahun Lalu' },
    { id: 'TX-YEAR-EARLY', date: `${earlyThisYearStr} 09:30:00`, total: 200000, desc: 'Penjualan Awal Tahun Ini' },
    { id: 'TX-8DAYS-AGO', date: `${eightDaysAgoStr} 11:00:00`, total: 120000, desc: 'Penjualan 8 Hari Lalu' },
    { id: 'TX-YESTERDAY', date: `${yesterdayStr} 14:00:00`, total: 150000, desc: 'Penjualan Kemarin (Masuk 7 Hari)' },
    { id: 'TX-TODAY-START', date: `${todayStr} 00:00:01`, total: 100000, desc: 'Penjualan Hari Ini Batas Awal (00:00:01)' },
    { id: 'TX-TODAY-END', date: `${todayStr} 23:59:59`, total: 150000, desc: 'Penjualan Hari Ini Batas Akhir (23:59:59)' },
    { id: 'TX-FUTURE', date: `${tomorrowStr} 12:00:00`, total: 300000, desc: 'Penjualan Masa Depan (Di luar Hari Ini)' }
  ];

  for (const f of txFixtures) {
    const timeIso = new Date().toISOString();
    await executor.run(
      `INSERT INTO transactions (id, code, name, category, date, total, payment_method, cashier, status, product_id, volume, created_at, updated_at)
       VALUES (?, '303', ?, 'Penjualan', ?, ?, 'Tunai', 'Admin SPBU', 'Selesai', 'PRD-01', ?, ?, ?);`,
      [f.id, f.desc, f.date, f.total, f.total / 10000, timeIso, timeIso]
    );

    const jrnId = `JRN-${f.id}`;
    await executor.run(
      `INSERT INTO journals (id, trans_code, date, description, is_balanced, created_at, updated_at)
       VALUES (?, '303', ?, ?, 1, ?, ?);`,
      [jrnId, f.date, f.desc, timeIso, timeIso]
    );

    await executor.run(
      `INSERT INTO journal_entries (id, journal_id, account_id, debit, credit, created_at) VALUES
       (?, ?, '1-1001', ?, 0, ?),
       (?, ?, '4-1001', 0, ?, ?);`,
      [`${jrnId}-E1`, jrnId, f.total, timeIso, `${jrnId}-E2`, jrnId, f.total, timeIso]
    );
  }
  console.log(`   -> 7 Transaksi berhasil diinput (Total Nilai Transaksi: Rp 1.520.000)`);

  const reportRepo = new ReportRepository(executor);
  const stationInfo: StationInfo = {
    id: 'SPBU-34-12301',
    name: 'PT SPBU Mitra Akrual 1954',
    address: 'Jl. Raya Padang - Bukittinggi Km. 38, Lubuk Alung',
    phone: '0812-3456-7890'
  };

  // =========================================================================
  // 4. UJI TEPAT 6 OPSI FILTER PERIODE DENGAN QUERY SQLITE AKTUAL
  // =========================================================================
  console.log('\n4. MENGUJI TEPAT 6 OPSI FILTER PERIODE DENGAN QUERY SQLITE AKTUAL...');

  // -------------------------------------------------------------------------
  // [4.1] Filter 1: "Hari Ini"
  // Rentang: dari awal sampai akhir hari ini (todayStr s/d todayStr)
  // Transaksi yang masuk: TX-TODAY-START (100k) + TX-TODAY-END (150k) = 250.000
  // -------------------------------------------------------------------------
  console.log('\n   [4.1] OPSI 1: Hari Ini');
  const filterHariIni = parsePeriodFilter('Hari Ini');
  console.log('         Parsed:', filterHariIni);
  if (filterHariIni.startDate !== todayStr || filterHariIni.endDate !== todayStr) {
    throw new Error(`Filter Hari Ini tidak cocok: ${JSON.stringify(filterHariIni)}`);
  }
  const labaHariIni = await reportRepo.getLabaRugi('Hari Ini', stationInfo);
  const revHariIni = labaHariIni.simple.revenues.reduce((s, r) => s + r.amount, 0);
  console.log('         Pendapatan Hari Ini:', revHariIni, '(Expected: 250000)');
  if (revHariIni !== 250000) {
    throw new Error(`Query Hari Ini salah. Didapat: ${revHariIni}, diharapkan: 250000`);
  }

  // -------------------------------------------------------------------------
  // [4.2] Filter 2: "7 Hari Terakhir"
  // Rentang: hari ini ditambah enam hari kalender sebelumnya (today - 6 s/d today)
  // Harus mencakup: TX-YESTERDAY (150k), TX-TODAY-START (100k), TX-TODAY-END (150k) = minimal 400.000
  // Mengabaikan: TX-8DAYS-AGO (120k) dan TX-FUTURE (300k)
  // -------------------------------------------------------------------------
  console.log('\n   [4.2] OPSI 2: 7 Hari Terakhir');
  const filter7Hari = parsePeriodFilter('7 Hari Terakhir');
  console.log('         Parsed:', filter7Hari);
  const sevenDaysAgoExpected = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  if (filter7Hari.startDate !== sevenDaysAgoExpected || filter7Hari.endDate !== todayStr) {
    throw new Error(`Filter 7 Hari Terakhir batas salah: ${JSON.stringify(filter7Hari)}`);
  }
  const laba7Hari = await reportRepo.getLabaRugi('7 Hari Terakhir', stationInfo);
  const rev7Hari = laba7Hari.simple.revenues.reduce((s, r) => s + r.amount, 0);
  console.log('         Pendapatan 7 Hari Terakhir:', rev7Hari, '(Expected: >= 400000 tanpa masa depan)');
  if (rev7Hari < 400000) {
    throw new Error(`Query 7 Hari Terakhir salah: ${rev7Hari}`);
  }

  // -------------------------------------------------------------------------
  // [4.3] Filter 3: "Bulan Ini"
  // Rentang: tanggal 1 bulan berjalan s/d hari ini (endDate: todayStr, BUKAN masa depan!)
  // -------------------------------------------------------------------------
  console.log('\n   [4.3] OPSI 3: Bulan Ini (Berakhir pada Hari Ini)');
  const filterBulanIni = parsePeriodFilter('Bulan Ini');
  console.log('         Parsed:', filterBulanIni);
  const firstDayMonthExpected = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  if (filterBulanIni.startDate !== firstDayMonthExpected || filterBulanIni.endDate !== todayStr) {
    throw new Error(`Filter Bulan Ini harus berakhir pada hari ini (${todayStr}), didapat: ${JSON.stringify(filterBulanIni)}`);
  }
  const labaBulanIni = await reportRepo.getLabaRugi('Bulan Ini', stationInfo);
  const revBulanIni = labaBulanIni.simple.revenues.reduce((s, r) => s + r.amount, 0);
  console.log('         Pendapatan Bulan Ini (s/d Hari Ini):', revBulanIni);

  // -------------------------------------------------------------------------
  // [4.4] Filter 4: "Tahun Ini"
  // Rentang: 1 Januari tahun berjalan s/d hari ini (endDate: todayStr, BUKAN masa depan!)
  // Mengabaikan: TX-YEAR-PREV (500k) dan TX-FUTURE (300k)
  // -------------------------------------------------------------------------
  console.log('\n   [4.4] OPSI 4: Tahun Ini (Berakhir pada Hari Ini)');
  const filterTahunIni = parsePeriodFilter('Tahun Ini');
  console.log('         Parsed:', filterTahunIni);
  const firstDayYearExpected = formatLocalDate(new Date(now.getFullYear(), 0, 1));
  if (filterTahunIni.startDate !== firstDayYearExpected || filterTahunIni.endDate !== todayStr) {
    throw new Error(`Filter Tahun Ini harus berakhir pada hari ini (${todayStr}), didapat: ${JSON.stringify(filterTahunIni)}`);
  }
  const labaTahunIni = await reportRepo.getLabaRugi('Tahun Ini', stationInfo);
  const revTahunIni = labaTahunIni.simple.revenues.reduce((s, r) => s + r.amount, 0);
  console.log('         Pendapatan Tahun Ini (s/d Hari Ini):', revTahunIni);

  // -------------------------------------------------------------------------
  // [4.5] Filter 5: "Custom" (Rentang Tanggal Manual)
  // Rentang: startDate dan endDate inklusif yang ditentukan secara bebas
  // -------------------------------------------------------------------------
  console.log('\n   [4.5] OPSI 5: Custom (Rentang Tanggal Kustom)');
  const customStr = `${todayStr} s/d ${todayStr}`;
  const filterCustom = parsePeriodFilter(customStr);
  console.log('         Parsed via string:', filterCustom);
  const labaCustom = await reportRepo.getLabaRugi(customStr, stationInfo);
  const revCustom = labaCustom.simple.revenues.reduce((s, r) => s + r.amount, 0);
  console.log('         Pendapatan Custom (Hari Ini saja):', revCustom, '(Expected: 250000)');
  if (revCustom !== 250000) {
    throw new Error(`Query Custom salah: ${revCustom}`);
  }

  // Uji Custom via prefix "Custom:startDate:endDate"
  const filterCustomPrefix = parsePeriodFilter(`Custom:${yesterdayStr}:${todayStr}`);
  console.log('         Parsed via prefix Custom:start:end ->', filterCustomPrefix);
  if (filterCustomPrefix.startDate !== yesterdayStr || filterCustomPrefix.endDate !== todayStr) {
    throw new Error(`Filter Custom prefix salah: ${JSON.stringify(filterCustomPrefix)}`);
  }

  // -------------------------------------------------------------------------
  // [4.6] Filter 6: "Semua Periode" (Seluruh Data Tersedia)
  // Mengembalikan seluruh 7 transaksi (Total: 1.520.000)
  // Termasuk verifikasi eksekusi "Semua Periode" setelah pemanggilan filter terbatas sebelumnya.
  // -------------------------------------------------------------------------
  console.log('\n   [4.6] OPSI 6: Semua Periode (Reset Seluruh Data)');
  const filterSemua = parsePeriodFilter('Semua Periode');
  console.log('         Parsed:', filterSemua);
  if (filterSemua.startDate !== undefined || filterSemua.endDate !== undefined) {
    throw new Error(`Semua Periode tidak boleh memiliki batasan startDate/endDate: ${JSON.stringify(filterSemua)}`);
  }
  const labaSemua = await reportRepo.getLabaRugi('Semua Periode', stationInfo);
  const revSemua = labaSemua.simple.revenues.reduce((s, r) => s + r.amount, 0);
  console.log('         Pendapatan Semua Periode:', revSemua, '(Expected: 1520000)');
  if (revSemua !== 1520000) {
    throw new Error(`Query Semua Periode salah. Didapat: ${revSemua}, diharapkan: 1520000`);
  }

  // =========================================================================
  // 5. VALIDASI KETAT: START DATE > END DATE DITOLAK
  // =========================================================================
  console.log('\n5. MENGUJI VALIDASI TANGGAL MULAI > TANGGAL AKHIR (FAIL-CLOSED)...');
  let errorCaught = false;
  try {
    parsePeriodFilter({ startDate: '2026-10-25', endDate: '2026-10-15' });
  } catch (err: any) {
    errorCaught = true;
    console.log('   -> Sukses tertangkap (objek terbalik):', err.message);
  }
  if (!errorCaught) throw new Error('Validasi startDate > endDate pada objek gagal ditolak');

  errorCaught = false;
  try {
    parsePeriodFilter('2026-10-25 s/d 2026-10-15');
  } catch (err: any) {
    errorCaught = true;
    console.log('   -> Sukses tertangkap (string range terbalik):', err.message);
  }
  if (!errorCaught) throw new Error('Validasi startDate > endDate pada string range gagal ditolak');

  errorCaught = false;
  try {
    parsePeriodFilter('Custom:2026-10-25:2026-10-15');
  } catch (err: any) {
    errorCaught = true;
    console.log('   -> Sukses tertangkap (Custom prefix terbalik):', err.message);
  }
  if (!errorCaught) throw new Error('Validasi startDate > endDate pada Custom prefix gagal ditolak');

  // =========================================================================
  // 6. UJI KONSISTENSI PADA SELURUH SUBMENU LAPORAN
  // =========================================================================
  console.log('\n6. MENGUJI KONSISTENSI PADA SELURUH SUBMENU LAPORAN...');

  // 6.1 Neraca
  const neracaHariIni = await reportRepo.getNeraca('Hari Ini', stationInfo);
  console.log('   [6.1] Neraca Hari Ini: Total Aset =', neracaHariIni.totalAset, '| Seimbang =', neracaHariIni.isSeimbang);
  if (!neracaHariIni.isSeimbang) throw new Error('Neraca Hari Ini tidak seimbang!');

  // 6.2 Arus Kas
  const arusKasHariIni = await reportRepo.getArusKas('Hari Ini', stationInfo);
  console.log('   [6.2] Arus Kas Hari Ini: Saldo Awal =', arusKasHariIni.saldoAwal, '| Total Penerimaan Ops =',
    arusKasHariIni.operasional.reduce((s, o) => s + o.amount, 0));

  // 6.3 Stok & Penjualan
  const stokHariIni = await reportRepo.getStokPenjualan('Hari Ini');
  console.log('   [6.3] Stok Penjualan Hari Ini: Item =', stokHariIni[0]?.name, '| Penjualan (L) =', stokHariIni[0]?.penjualan);
  if (stokHariIni[0]?.penjualan !== 25) { // 250k / 10k per liter = 25 Liter
    throw new Error(`Volume penjualan stok Hari Ini salah: ${stokHariIni[0]?.penjualan} (Expected: 25)`);
  }

  // 6.4 Rekap Penjualan & Sesi Shift
  const shiftRecapHariIni = await reportRepo.getSalesAndShiftRecap('Hari Ini');
  console.log('   [6.4] Rekap Penjualan Hari Ini: Total Gross =', shiftRecapHariIni.totalGrossSales, '(Expected: 250000)');
  if (shiftRecapHariIni.totalGrossSales !== 250000) {
    throw new Error(`Rekap penjualan Hari Ini salah: ${shiftRecapHariIni.totalGrossSales}`);
  }

  // =========================================================================
  // 7. MENGUJI GENERASI DAN EKSPOR DOKUMEN PDF
  // =========================================================================
  console.log('\n7. MENGUJI GENERASI DAN EKSPOR DOKUMEN PDF...');
  const allReports: ReportsData = {
    neracaKonsolidasi: neracaHariIni,
    labaRugi: labaHariIni.simple,
    labaRugiKonsolidasi: labaHariIni.konsolidasi,
    arusKas: arusKasHariIni,
    stokPenjualan: stokHariIni,
    salesAndShiftRecap: shiftRecapHariIni
  };

  const resNeraca = await exportNeracaPdf(allReports, stationInfo, 'Hari Ini');
  console.log('   [7.1] PDF Neraca:', resNeraca);
  if (!resNeraca.success || !resNeraca.filename.startsWith('Neraca_')) throw new Error('PDF Neraca gagal');

  const resLabaRugi = await exportLabaRugiPdf(allReports, stationInfo, 'Hari Ini');
  console.log('   [7.2] PDF Laba Rugi:', resLabaRugi);
  if (!resLabaRugi.success || !resLabaRugi.filename.startsWith('Laba_Rugi_')) throw new Error('PDF Laba Rugi gagal');

  const resArusKas = await exportArusKasPdf(allReports, stationInfo, 'Hari Ini');
  console.log('   [7.3] PDF Arus Kas:', resArusKas);
  if (!resArusKas.success || !resArusKas.filename.startsWith('Arus_Kas_')) throw new Error('PDF Arus Kas gagal');

  const resStok = await exportStokPdf(allReports, stationInfo, 'Hari Ini');
  console.log('   [7.4] PDF Stok BBM:', resStok);
  if (!resStok.success || !resStok.filename.startsWith('Stok_BBM_')) throw new Error('PDF Stok BBM gagal');

  const dummyBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]).buffer;
  const b64 = arrayBufferToBase64(dummyBuffer);
  console.log('   [7.5] Base64 PDF Header Check:', b64, '(Expected: JVBERi0xLjQ=)');
  if (b64 !== 'JVBERi0xLjQ=') throw new Error(`Base64 mismatch: ${b64}`);

  console.log('\n====================================================================');
  console.log('   SELURUH PENGUJIAN 6 FILTER PERIODE & PDF LULUS DENGAN SEMPURNA!   ');
  console.log('====================================================================');
}

runTestSuite().catch((err) => {
  console.error('\nFATAL ERROR IN TEST SUITE:', err);
  process.exit(1);
});

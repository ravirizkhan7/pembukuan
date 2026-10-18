/**
 * TEST SUITE: QA SIGNATURES, CITY DYNAMICS & PDF/PRINT RENDERING
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { SqlExecutor, MigrationRunner } from '../src/services/database/migrationRunner';
import { MIGRATIONS } from '../src/services/database/migrations';
import { MasterDataService } from '../src/services/database/masterDataService';
import { ReportRepository, formatCityTitleCase, formatIndonesianDate, formatSignerLocationDate } from '../src/services/database/repositories/reportRepository';
import { exportNeracaPdf, exportLabaRugiPdf } from '../src/services/pdfExport';
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

async function runQaSignaturesAndCity() {
  console.log('====================================================================');
  console.log('   QA: VALIDASI TANDA TANGAN, KOTA & DOKUMEN CETAK/PDF');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  const executor = new SqlJsExecutor(rawDb);

  // 1. Setup DB v5
  await MigrationRunner.runMigrations(executor, MIGRATIONS);
  await MasterDataService.initializeMasterData(executor);

  const reportRepo = new ReportRepository(executor);

  // 2. Setup Station Info dengan kota 'pariaman'
  const nowIso = new Date().toISOString();
  await executor.run(
    `UPDATE station_info SET
       id = 'SPBU-34-12301',
       name = 'SPBU 34.12301 Pertamina',
       address = 'Jl. Raya Padang - Bukittinggi Km. 42',
       city = 'pariaman',
       phone = '081234567890',
       manager = 'H. Syahrul, S.E.',
       updated_at = ?;`,
    [nowIso]
  );

  // Verifikasi pembacaan dari profil SQLite
  const stationInfoRows = await executor.query<any>('SELECT * FROM station_info WHERE id = ?;', ['SPBU-34-12301']);
  const dbStationInfo: StationInfo = {
    id: stationInfoRows[0].id,
    name: stationInfoRows[0].name,
    address: stationInfoRows[0].address,
    city: stationInfoRows[0].city,
    phone: stationInfoRows[0].phone,
    manager: stationInfoRows[0].manager,
    email: stationInfoRows[0].email,
    status: stationInfoRows[0].status,
    lastBackup: stationInfoRows[0].last_backup,
    version: stationInfoRows[0].version
  };

  console.log('1. MEMERIKSA FORMAT TANGGAL DAN KOTA TITLE-CASE:');
  console.log(`   -> Input: city="${dbStationInfo.city}", date="2026-01-31"`);
  const formattedSigner1 = formatSignerLocationDate(dbStationInfo.city, '2026-01-31');
  console.log(`   -> Hasil format: "${formattedSigner1}"`);
  if (formattedSigner1 !== 'Pariaman, 31 Januari 2026') {
    throw new Error(`Expected 'Pariaman, 31 Januari 2026', got '${formattedSigner1}'`);
  }
  console.log('   -> PASS: Format [Kota TitleCase], [Tanggal Indonesia] terverifikasi.');

  // 3. Uji Laporan Neraca & Laba Rugi dengan filter rentang (periode akhir spesifik)
  console.log('\n2. MEMERIKSA SIGNER DATE PADA NERACA & LABA RUGI:');
  const neracaCustom = await reportRepo.getNeraca('2026-01-01 s/d 2026-01-31', dbStationInfo);
  console.log(`   -> Neraca signerDate: "${neracaCustom.signerDate}"`);
  if (neracaCustom.signerDate !== 'Pariaman, 31 Januari 2026') {
    throw new Error(`Neraca signerDate salah: ${neracaCustom.signerDate}`);
  }

  const labaCustomRes = await reportRepo.getLabaRugi('2026-01-01 s/d 2026-01-31', dbStationInfo);
  const labaCustom = labaCustomRes.konsolidasi;
  console.log(`   -> Laba Rugi signerDate: "${labaCustom.signerDate}"`);
  if (labaCustom.signerDate !== 'Pariaman, 31 Januari 2026') {
    throw new Error(`Laba Rugi signerDate salah: ${labaCustom.signerDate}`);
  }
  console.log('   -> PASS: Neraca dan Laba Rugi menggunakan tanggal akhir periode.');

  // 4. Uji 'Semua Periode' fallback ke tanggal lokal hari ini
  console.log('\n3. MEMERIKSA FALLBACK "SEMUA PERIODE" KE TANGGAL HARI INI:');
  const neracaAll = await reportRepo.getNeraca('Semua Periode', dbStationInfo);
  console.log(`   -> Neraca Semua Periode signerDate: "${neracaAll.signerDate}"`);
  const today = new Date();
  const expectedTodayMonth = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][today.getMonth()];
  const expectedTodayStr = `Pariaman, ${today.getDate()} ${expectedTodayMonth} ${today.getFullYear()}`;
  if (neracaAll.signerDate !== expectedTodayStr) {
    throw new Error(`Expected '${expectedTodayStr}', got '${neracaAll.signerDate}'`);
  }
  console.log('   -> PASS: Semua Periode fallback ke tanggal lokal pembuatan dokumen.');

  // 5. Uji Perubahan Kota di SQLite tercermin dinamis pada laporan
  console.log('\n4. MENGUJI PERUBAHAN KOTA DI SQLITE TERCERMIN OTOMATIS:');
  await executor.run("UPDATE station_info SET city = 'bukittinggi' WHERE id = 'SPBU-34-12301';");
  // Panggil getNeraca tanpa stationInfo (agar auto-resolve dari SQLite)
  const neracaAutoResolved = await reportRepo.getNeraca('2026-08-01 s/d 2026-08-31');
  console.log(`   -> Neraca auto-resolved signerDate: "${neracaAutoResolved.signerDate}"`);
  if (neracaAutoResolved.signerDate !== 'Bukittinggi, 31 Agustus 2026') {
    throw new Error(`Expected 'Bukittinggi, 31 Agustus 2026', got '${neracaAutoResolved.signerDate}'`);
  }
  console.log('   -> PASS: Perubahan profil SQLite langsung tercermin pada laporan.');

  // 6. Uji Kasus Kota Kosong (tidak mengarang kota)
  console.log('\n5. MENGUJI PROFIL KOTA KOSONG (ZERO INVENTION):');
  await executor.run("UPDATE station_info SET city = '' WHERE id = 'SPBU-34-12301';");
  const neracaEmptyCity = await reportRepo.getNeraca('2026-08-01 s/d 2026-08-31');
  console.log(`   -> Neraca empty-city signerDate: "${neracaEmptyCity.signerDate}"`);
  if (neracaEmptyCity.signerDate !== '31 Agustus 2026') {
    throw new Error(`Expected '31 Agustus 2026' without city/comma, got '${neracaEmptyCity.signerDate}'`);
  }
  console.log('   -> PASS: Jika kota kosong, sistem menampilkan tanggal saja tanpa koma atau kota fiktif.');

  // 7. Kembalikan ke 'pariaman' dan uji pembuatan file PDF fisik
  console.log('\n6. MENGUJI RENDER DOKUMEN PDF (NERACA & LABA RUGI):');
  await executor.run("UPDATE station_info SET city = 'pariaman' WHERE id = 'SPBU-34-12301';");
  const activeStation = (await reportRepo.getNeraca('31-Jan-2026')).entityName;

  const sampleReports: ReportsData = {
    neracaKonsolidasi: neracaCustom,
    labaRugiKonsolidasi: labaCustom
  };

  const neracaPdfResult = await exportNeracaPdf(sampleReports, dbStationInfo, '31 Januari 2026');
  console.log(`   -> PDF Neraca dihasilkan: ${neracaPdfResult.filename}`);
  if (!neracaPdfResult.uri || !fs.existsSync(neracaPdfResult.uri)) {
    throw new Error('Berkas fisik PDF Neraca tidak ditemukan!');
  }
  const neracaPdfContent = fs.readFileSync(neracaPdfResult.uri, 'latin1');
  if (!neracaPdfContent.includes('Pariaman, 31 Januari 2026')) {
    throw new Error('PDF Neraca tidak memuat teks tanda tangan "Pariaman, 31 Januari 2026"');
  }
  if (!neracaPdfContent.includes('Pimpinan / Direktur SPBU')) {
    throw new Error('PDF Neraca tidak memuat jabatan pimpinan!');
  }
  if (neracaPdfContent.includes('Diketahui,')) {
    throw new Error('PDF Neraca masih memuat prefix terlarang "Diketahui,"!');
  }
  console.log('   -> PASS: PDF Neraca terverifikasi fisik memuat tanda tangan tunggal Pimpinan di kanan bawah tanpa prefix "Diketahui,"');

  const labaPdfResult = await exportLabaRugiPdf(sampleReports, dbStationInfo, '31 Januari 2026');
  console.log(`   -> PDF Laba Rugi dihasilkan: ${labaPdfResult.filename}`);
  if (!labaPdfResult.uri || !fs.existsSync(labaPdfResult.uri)) {
    throw new Error('Berkas fisik PDF Laba Rugi tidak ditemukan!');
  }
  const labaPdfContent = fs.readFileSync(labaPdfResult.uri, 'latin1');
  if (!labaPdfContent.includes('Pariaman, 31 Januari 2026')) {
    throw new Error('PDF Laba Rugi tidak memuat teks tanda tangan "Pariaman, 31 Januari 2026"');
  }
  if (!labaPdfContent.includes('Pimpinan / Direktur SPBU')) {
    throw new Error('PDF Laba Rugi tidak memuat jabatan pimpinan!');
  }
  if (labaPdfContent.includes('Diketahui,')) {
    throw new Error('PDF Laba Rugi masih memuat prefix terlarang "Diketahui,"!');
  }
  console.log('   -> PASS: PDF Laba Rugi terverifikasi fisik memuat tanda tangan tunggal Pimpinan di kanan bawah tanpa prefix "Diketahui,"');

  console.log('\n====================================================================');
  console.log('   QA TANDA TANGAN & KOTA LAPORAN LULUS DENGAN SEMPURNA (100% PASS)');
  console.log('====================================================================\n');
}

runQaSignaturesAndCity().catch((err) => {
  console.error('\n❌ FATAL QA ERROR:', err);
  process.exit(1);
});

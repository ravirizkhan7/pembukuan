/**
 * TEST SUITE: PRIORITAS 1 & 2
 * - Pengaturan Kota Laporan & Migration v5
 * - Format Tanggal Indonesia & Tanda Tangan Laporan (Pariaman, 31 Januari 2026)
 * - Reference Integrity & Delete Guards across Master Entities
 */

import initSqlJs from 'sql.js';
import { SqlExecutor, MigrationRunner } from '../src/services/database/migrationRunner';
import { MIGRATIONS } from '../src/services/database/migrations';
import { DATABASE_VERSION } from '../src/services/database/databaseConfig';
import { MasterDataService } from '../src/services/database/masterDataService';
import { AccountRepository } from '../src/services/database/repositories/accountRepository';
import { MasterCodeRepository } from '../src/services/database/repositories/masterCodeRepository';
import { ProductRepository } from '../src/services/database/repositories/productRepository';
import { ProductCategoryRepository } from '../src/services/database/repositories/productCategoryRepository';
import { TankRepository } from '../src/services/database/repositories/tankRepository';
import { NozzleRepository } from '../src/services/database/repositories/nozzleRepository';
import { PegawaiRepository } from '../src/services/database/repositories/pegawaiRepository';
import { BusinessPartnerRepository } from '../src/services/database/repositories/businessPartnerRepository';
import { ReportRepository, formatCityTitleCase, formatIndonesianDate, formatSignerLocationDate } from '../src/services/database/repositories/reportRepository';
import type { StationInfo, Product, ProductCategory, Tank, Nozzle, MasterCode, Pegawai, Account } from '../src/types';

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
  console.log('   TEST SUITE: PRIORITAS 1 & 2 (KOTA LAPORAN & CRUD MASTER)');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  const executor = new SqlJsExecutor(rawDb);

  // ------------------------------------------------------------------
  // 1. MIGRATION RUNNER & DATABASE VERSION
  // ------------------------------------------------------------------
  console.log('TEST 1: Migration Runner & Version 5 Upgrade');
  const res = await MigrationRunner.runMigrations(executor);
  if (!res.success) throw new Error(`Migrations failed: ${res.error}`);

  const currentVer = await MigrationRunner.getCurrentVersion(executor);
  console.log(`- Current DB Version: ${currentVer} (Expected: ${DATABASE_VERSION})`);
  if (currentVer !== 5 || DATABASE_VERSION !== 5) {
    throw new Error(`DB version mismatch: expected 5, got ${currentVer}`);
  }

  // Check physical column in station_info
  const columns = await executor.query<{ name: string }>('PRAGMA table_info(station_info);');
  const colNames = columns.map(c => c.name);
  console.log(`- station_info columns: ${colNames.join(', ')}`);
  if (!colNames.includes('city')) {
    throw new Error('Column "city" not found in physical table station_info!');
  }
  console.log('  -> PASS: Migration v5 created column "city" physically.\n');

  // ------------------------------------------------------------------
  // 2. MASTER DATA SERVICE & CITY PERSISTENCE
  // ------------------------------------------------------------------
  console.log('TEST 2: Master Data Service & City Persistence');
  await MasterDataService.initializeMasterData(executor);

  let masterData = await MasterDataService.loadAllMasterData(executor);
  console.log(`- Initial loaded station city: "${masterData.stationInfo?.city || ''}" (Should be empty until filled)`);
  if (masterData.stationInfo?.city) {
    throw new Error('Initial city should be empty if not explicitly set!');
  }

  // Update city to 'pariaman'
  await executor.run(
    `UPDATE station_info SET city = ?, manager = ? WHERE id = ?;`,
    ['pariaman', 'H. Syahrul, S.E.', masterData.stationInfo!.id]
  );

  masterData = await MasterDataService.loadAllMasterData(executor);
  console.log(`- Updated city in DB: "${masterData.stationInfo?.city}"`);
  if (masterData.stationInfo?.city !== 'pariaman') {
    throw new Error(`Expected city 'pariaman', got ${masterData.stationInfo?.city}`);
  }
  console.log('  -> PASS: StationInfo city persists and loads correctly without fake defaults.\n');

  // ------------------------------------------------------------------
  // 3. DATE & SIGNER FORMATTING
  // ------------------------------------------------------------------
  console.log('TEST 3: Date & Signer Title Case Formatting');
  const titleCase1 = formatCityTitleCase('pariaman');
  const titleCase2 = formatCityTitleCase('KOTA PARIAMAN');
  const titleCase3 = formatCityTitleCase('padang pariaman barat');
  console.log(`- formatCityTitleCase('pariaman'): "${titleCase1}"`);
  console.log(`- formatCityTitleCase('KOTA PARIAMAN'): "${titleCase2}"`);
  console.log(`- formatCityTitleCase('padang pariaman barat'): "${titleCase3}"`);
  if (titleCase1 !== 'Pariaman' || titleCase2 !== 'Kota Pariaman' || titleCase3 !== 'Padang Pariaman Barat') {
    throw new Error('City Title Case formatting failed');
  }

  const indoDate1 = formatIndonesianDate('2026-01-31');
  const indoDate2 = formatIndonesianDate('2026-08-17');
  console.log(`- formatIndonesianDate('2026-01-31'): "${indoDate1}"`);
  console.log(`- formatIndonesianDate('2026-08-17'): "${indoDate2}"`);
  if (indoDate1 !== '31 Januari 2026' || indoDate2 !== '17 Agustus 2026') {
    throw new Error('Indonesian Date formatting failed');
  }

  const signerLine = formatSignerLocationDate('pariaman', '2026-01-31');
  console.log(`- formatSignerLocationDate('pariaman', '2026-01-31'): "${signerLine}"`);
  if (signerLine !== 'Pariaman, 31 Januari 2026') {
    throw new Error(`Expected 'Pariaman, 31 Januari 2026', got '${signerLine}'`);
  }

  // Report Repository integration test
  const reportRepo = new ReportRepository(executor);
  const neraca = await reportRepo.getNeraca('2026-01-01 s/d 2026-01-31');
  console.log(`- Neraca signerDate: "${neraca.signerDate}"`);
  if (neraca.signerDate !== 'Pariaman, 31 Januari 2026') {
    throw new Error(`Neraca signerDate mismatch: got '${neraca.signerDate}'`);
  }

  const labaRugi = await reportRepo.getLabaRugi('2026-01-01 s/d 2026-01-31');
  console.log(`- Laba Rugi signerDate: "${labaRugi.konsolidasi.signerDate}"`);
  if (labaRugi.konsolidasi.signerDate !== 'Pariaman, 31 Januari 2026') {
    throw new Error(`Laba Rugi signerDate mismatch: got '${labaRugi.konsolidasi.signerDate}'`);
  }
  console.log('  -> PASS: Indonesian date and title-case city format matches Pariaman, 31 Januari 2026.\n');

  // ------------------------------------------------------------------
  // 4. CRUD MASTER DATA & REFERENCE PROTECTION
  // ------------------------------------------------------------------
  console.log('TEST 4: Reference Integrity & Delete Guards across Master Entities');

  const masterCodeRepo = new MasterCodeRepository(executor);
  const productRepo = new ProductRepository(executor);
  const categoryRepo = new ProductCategoryRepository(executor);
  const tankRepo = new TankRepository(executor);
  const nozzleRepo = new NozzleRepository(executor);
  const accountRepo = new AccountRepository(executor);
  const pegawaiRepo = new PegawaiRepository(executor);

  // A. Master Code
  console.log('\n--- 4A: Master Code ---');
  // Create an unused master code
  const dummyMc: MasterCode = {
    id: 'MC-TEST-999',
    code: '999',
    name: 'Tes Transaksi Bebas',
    category: 'Penjualan',
    type: 'Penjualan Standar',
    debitAccountId: '1-1001',
    creditAccountId: '4-1001',
    requiresTera: false,
    isActive: true
  };
  await masterCodeRepo.create(dummyMc);
  let mcRef = await masterCodeRepo.isReferenced('MC-TEST-999');
  console.log(`- Unused Master Code isReferenced: ${mcRef}`);
  if (mcRef) throw new Error('Unused MC should not be referenced');
  await masterCodeRepo.delete('MC-TEST-999');
  console.log('- Unused Master Code successfully deleted.');

  // Check code 303 after being used in transaction
  const usedMc = (await masterCodeRepo.findAll()).find(m => m.code === '303');
  if (usedMc) {
    await executor.run(
      `INSERT INTO transactions (id, date, code, name, category, product_id, volume, unit_price, total, shift_id, cashier, status, master_code_id, created_at, updated_at)
       VALUES ('TX-REF-MC', '2026-01-15', '303', 'Penjualan Pertalite', 'Penjualan', 'PRD-01', 10, 10000, 100000, 'SFT-01', 'Ahmad Fauzi', 'Selesai', ?, datetime('now'), datetime('now'));`,
      [usedMc.id]
    );
    const isUsedRef = await masterCodeRepo.isReferenced(usedMc.id);
    console.log(`- Master Code #303 isReferenced: ${isUsedRef}`);
    let threw = false;
    try {
      await masterCodeRepo.delete(usedMc.id);
    } catch (err: any) {
      threw = true;
      console.log(`  -> Correctly blocked with message: "${err.message}"`);
    }
    if (!threw) throw new Error('Master Code #303 deletion should have been blocked!');
  }

  // B. Kategori Produk
  console.log('\n--- 4B: Kategori Produk ---');
  const dummyCat = await categoryRepo.create({ id: 'PCAT-TEST-99', name: 'Kategori Uji Coba', status: 'Aktif' });
  let catRef = await categoryRepo.isReferenced(dummyCat.id);
  console.log(`- Unused Category isReferenced: ${catRef}`);
  if (catRef) throw new Error('Unused Category should not be referenced');
  await categoryRepo.delete(dummyCat.id);
  console.log('- Unused Category successfully deleted.');

  // Used Category PCAT-001 (BBM)
  const isPcatUsed = await categoryRepo.isReferenced('PCAT-001');
  console.log(`- Category PCAT-001 (BBM) isReferenced: ${isPcatUsed}`);
  let catThrew = false;
  try {
    await categoryRepo.delete('PCAT-001');
  } catch (err: any) {
    catThrew = true;
    console.log(`  -> Correctly blocked with message: "${err.message}"`);
  }
  if (!catThrew) throw new Error('Category PCAT-001 deletion should have been blocked!');

  // C. Produk BBM
  console.log('\n--- 4C: Produk BBM ---');
  const dummyProd: Product = {
    id: 'PRD-TEST-99',
    code: 'TEST99',
    name: 'Produk Uji Coba Non-Relasi',
    categoryId: 'PCAT-001',
    unit: 'Liter',
    buyPrice: 10000,
    sellPrice: 12000,
    status: 'Aktif'
  };
  await productRepo.create(dummyProd);
  let prodRef = await productRepo.isReferenced('PRD-TEST-99');
  console.log(`- Unused Product isReferenced: ${prodRef}`);
  if (prodRef) throw new Error('Unused Product should not be referenced');
  await productRepo.delete('PRD-TEST-99');
  console.log('- Unused Product successfully deleted.');

  // Used Product PRD-01 (Pertalite)
  const isPrdUsed = await productRepo.isReferenced('PRD-01');
  console.log(`- Product PRD-01 isReferenced: ${isPrdUsed}`);
  let prodThrew = false;
  try {
    await productRepo.delete('PRD-01');
  } catch (err: any) {
    prodThrew = true;
    console.log(`  -> Correctly blocked with message: "${err.message}"`);
  }
  if (!prodThrew) throw new Error('Product PRD-01 deletion should have been blocked!');

  // D. Tangki Pendam
  console.log('\n--- 4D: Tangki Pendam ---');
  const dummyTank: Tank = {
    id: 'TNK-99',
    name: 'Tangki Tes Mandiri',
    productId: 'PRD-01',
    productName: 'Pertalite',
    capacity: 10000,
    currentStock: 5000,
    unit: 'Liter',
    lastSounding: '2026-01-01 00:00:00',
    status: 'Aktif'
  };
  await tankRepo.create(dummyTank);
  let tankRef = await tankRepo.isReferenced('TNK-99');
  console.log(`- Unused Tank isReferenced: ${tankRef}`);
  if (tankRef) throw new Error('Unused Tank should not be referenced');
  await tankRepo.delete('TNK-99');
  console.log('- Unused Tank successfully deleted.');

  // Used Tank TNK-01 (linked to nozzles)
  const isTankUsed = await tankRepo.isReferenced('TNK-01');
  console.log(`- Tank TNK-01 isReferenced: ${isTankUsed}`);
  let tankThrew = false;
  try {
    await tankRepo.delete('TNK-01');
  } catch (err: any) {
    tankThrew = true;
    console.log(`  -> Correctly blocked with message: "${err.message}"`);
  }
  if (!tankThrew) throw new Error('Tank TNK-01 deletion should have been blocked!');

  // E. Nozzle Dispenser
  console.log('\n--- 4E: Nozzle Dispenser ---');
  const dummyNozzle: Nozzle = {
    id: 'NZL-99',
    code: 'NZ-99',
    island: 'Pulau Tes',
    tankId: 'TNK-01',
    productId: 'PRD-01',
    productName: 'Pertalite',
    currentMeter: 0,
    status: 'Aktif'
  };
  await nozzleRepo.create(dummyNozzle);
  let nzlRef = await nozzleRepo.isReferenced('NZL-99');
  console.log(`- Unused Nozzle isReferenced: ${nzlRef}`);
  if (nzlRef) throw new Error('Unused Nozzle should not be referenced');
  await nozzleRepo.delete('NZL-99');
  console.log('- Unused Nozzle successfully deleted.');

  // Used Nozzle NZL-01 (linked to tera or transactions)
  await executor.run(
    `INSERT INTO tera (id, date, nozzle_id, price, tera_awal, tera_akhir, volume, sales_amount, officer, status, created_at, updated_at)
     VALUES ('TERA-REF-NZL', '2026-01-15', 'NZL-01', 10000, 1000, 1020, 20, 0, 'Petugas Tera', 'Valid', datetime('now'), datetime('now'));`
  );
  const isNzlUsed = await nozzleRepo.isReferenced('NZL-01');
  console.log(`- Nozzle NZL-01 isReferenced: ${isNzlUsed}`);
  let nzlThrew = false;
  try {
    await nozzleRepo.delete('NZL-01');
  } catch (err: any) {
    nzlThrew = true;
    console.log(`  -> Correctly blocked with message: "${err.message}"`);
  }
  if (!nzlThrew) throw new Error('Nozzle NZL-01 deletion should have been blocked!');

  // F. COA / Akun
  console.log('\n--- 4F: Bagan Akun (COA) ---');
  const dummyAcc: Account = {
    id: '9-9999',
    code: '9-9999',
    name: 'Akun Tes Mandiri',
    category: 'Beban',
    normalBalance: 'Debit',
    balance: 0,
    isActive: true
  };
  await accountRepo.create(dummyAcc);
  let accRef = await accountRepo.isReferenced('9-9999');
  console.log(`- Unused Account isReferenced: ${accRef}`);
  if (accRef) throw new Error('Unused Account should not be referenced');
  await accountRepo.delete('9-9999');
  console.log('- Unused Account successfully deleted.');

  // Used Account 1-1001 (Kas Utama - in journal entries and master codes)
  const isAccUsed = await accountRepo.isReferenced('1-1001');
  console.log(`- Account 1-1001 isReferenced: ${isAccUsed}`);
  let accThrew = false;
  try {
    await accountRepo.delete('1-1001');
  } catch (err: any) {
    accThrew = true;
    console.log(`  -> Correctly blocked with message: "${err.message}"`);
  }
  if (!accThrew) throw new Error('Account 1-1001 deletion should have been blocked!');

  // G. Pegawai
  console.log('\n--- 4G: Pegawai ---');
  const dummyPeg: Pegawai = {
    id: 'EMP-999',
    name: 'Pegawai Uji Bebas',
    role: 'Operator Dispenser',
    status: 'Aktif',
    shiftId: 'SFT-01'
  };
  await pegawaiRepo.create(dummyPeg);
  let pegRef = await pegawaiRepo.isReferenced('EMP-999');
  console.log(`- Unused Pegawai isReferenced: ${pegRef}`);
  if (pegRef) throw new Error('Unused Pegawai should not be referenced');
  await pegawaiRepo.delete('EMP-999');
  console.log('- Unused Pegawai successfully deleted.');

  // Used Pegawai OPR-001 (has attendance / transactions)
  await executor.run(
    `INSERT INTO attendances (id, employee_id, shift_id, date, status, created_at, updated_at)
     VALUES ('ATT-REF-EMP', 'OPR-001', 'SFT-01', '2026-01-15', 'Hadir', datetime('now'), datetime('now'));`
  );
  const isPegUsed = await pegawaiRepo.isReferenced('OPR-001');
  console.log(`- Pegawai OPR-001 isReferenced: ${isPegUsed}`);
  let pegThrew = false;
  try {
    await pegawaiRepo.delete('OPR-001');
  } catch (err: any) {
    pegThrew = true;
    console.log(`  -> Correctly blocked with message: "${err.message}"`);
  }
  if (!pegThrew) throw new Error('Pegawai OPR-001 deletion should have been blocked!');

  console.log('\n====================================================================');
  console.log('   ALL TESTS IN PRIORITAS 1 & 2 SUITE PASSED PERFECTLY!');
  console.log('====================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

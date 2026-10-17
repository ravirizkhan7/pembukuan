import initSqlJs from 'sql.js';
import { MIGRATIONS } from '../src/services/database/migrations';
import { MigrationRunner } from '../src/services/database/migrationRunner';
import { MasterDataService } from '../src/services/database/masterDataService';
import {
  BackupRestoreService,
  computeBackupChecksum,
  TOPOLOGICAL_TABLES,
  SpbuBackupFile
} from '../src/services/database/backupRestoreService';
import { TransactionRepository } from '../src/services/database/repositories/transactionRepository';
import { JournalRepository } from '../src/services/database/repositories/journalRepository';
import { ReceivableRepository } from '../src/services/database/repositories/receivableRepository';

async function main() {
  console.log('====================================================================');
  console.log('   PHASE 11: SQLITE BACKUP & RESTORE INTEGRITY TEST SUITE');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();

  // Helper to create an in-memory SQL.js executor
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

  // -------------------------------------------------------------------------
  // 1. SETUP SOURCE DATABASE DENGAN MIGRATIONS AKTUAL (v1 s.d. v4)
  // -------------------------------------------------------------------------
  console.log('1. MENYIAPKAN DATABASE SUMBER (MIGRATIONS v1-v4 & DATA OPERASIONAL)...');
  const sourceDb = new SQL.Database();
  const sourceExecutor = createDbExecutor(sourceDb);

  const migRes = await MigrationRunner.runMigrations(sourceExecutor, MIGRATIONS);
  console.log(`   -> Migrasi berhasil: Versi ${migRes.currentVersion}`);

  // Inisialisasi master data resmi (categories, products, tanks, nozzles, COA, shifts, pegawai)
  await MasterDataService.initializeMasterData(sourceExecutor);

  const nowIso = new Date().toISOString();
  await sourceExecutor.run(
    `UPDATE station_info SET
       id = 'SPBU-34-12301',
       name = 'SPBU Dago Bandung',
       address = 'Jl. Ir. H. Juanda No. 123',
       phone = '08123456789',
       manager = 'Budi Santoso',
       email = 'admin@spbu3412301.com',
       version = 'v0.1.0-generic',
       updated_at = ?;`,
    [nowIso]
  );

  // Ambil referensi master yang valid
  const pegawaiRows = await sourceExecutor.query<any>('SELECT id, shift_id FROM pegawai LIMIT 1;');
  const empId = pegawaiRows[0]?.id || 'PEG-01';
  const sftId = pegawaiRows[0]?.shift_id || 'SFT-01';

  const productRows = await sourceExecutor.query<any>('SELECT id FROM products LIMIT 1;');
  const prodId = productRows[0]?.id || 'PRD-01';

  const partnerRows = await sourceExecutor.query<any>('SELECT id FROM business_partners LIMIT 1;');
  const partnerId = partnerRows[0]?.id || 'BP-01';

  // Seed Absensi
  await sourceExecutor.run(
    `INSERT INTO attendances (id, employee_id, shift_id, date, status, notes, check_in_time, created_at, updated_at)
     VALUES ('ATT-01', ?, ?, '2026-10-14', 'Hadir', 'Shift pagi lancar', '06:55', ?, ?);`,
    [empId, sftId, nowIso, nowIso]
  );

  // Seed Transaksi 1: Penjualan Tunai
  const txRepo = new TransactionRepository(sourceExecutor);
  const tx1 = await txRepo.create({
    id: 'TX-CASH-001',
    date: '2026-10-14',
    code: 'TRX-20261014-001',
    name: 'Penjualan Pertalite Tunai',
    category: 'Penjualan',
    productId: prodId,
    volume: 25,
    unitPrice: 10000,
    total: 250000,
    cashier: 'Agus Supriyadi',
    shiftId: sftId,
    paymentMethod: 'Tunai',
    status: 'Selesai'
  });

  // Seed Jurnal 1: Penjualan Tunai (Kas Utama Debit, Pendapatan Kredit)
  const jrnRepo = new JournalRepository(sourceExecutor);
  await jrnRepo.create({
    id: 'JRN-001',
    date: '2026-10-14',
    referenceNo: tx1.code,
    description: 'Penjualan BBM Tunai',
    source: 'Penjualan',
    transactionId: tx1.id,
    isBalanced: true,
    entries: [
      { id: 'JE-01', accountId: '1-1001', debit: 250000, credit: 0, description: 'Penerimaan Kas Kasir' },
      { id: 'JE-02', accountId: '4-1001', debit: 0, credit: 250000, description: 'Pendapatan Penjualan BBM' }
    ]
  });

  // Seed Transaksi 2: Penjualan Tempo / Piutang
  const tx2 = await txRepo.create({
    id: 'TX-CREDIT-002',
    date: '2026-10-14',
    code: 'TRX-20261014-002',
    name: 'Penjualan Solar Kredit',
    category: 'Penjualan',
    productId: prodId,
    volume: 15,
    unitPrice: 10000,
    total: 150000,
    cashier: 'Agus Supriyadi',
    shiftId: sftId,
    paymentMethod: 'Piutang',
    partnerId: partnerId,
    status: 'Selesai'
  });

  // Seed Jurnal 2: Penjualan Tempo (Piutang Debit, Pendapatan Kredit)
  await jrnRepo.create({
    id: 'JRN-002',
    date: '2026-10-14',
    referenceNo: tx2.code,
    description: 'Penjualan BBM Tempo Mitra',
    source: 'Penjualan',
    transactionId: tx2.id,
    isBalanced: true,
    entries: [
      { id: 'JE-03', accountId: '1-1101', debit: 150000, credit: 0, description: 'Piutang Usaha Bertambah' },
      { id: 'JE-04', accountId: '4-1001', debit: 0, credit: 150000, description: 'Pendapatan Penjualan BBM' }
    ]
  });

  // Seed Piutang
  const rcvRepo = new ReceivableRepository(sourceExecutor);
  await rcvRepo.create({
    id: 'RCV-001',
    partnerId: partnerId,
    transactionId: tx2.id,
    amount: 150000,
    outstanding: 150000,
    date: '2026-10-14',
    status: 'Open',
    notes: 'Tagihan tempo PT Transportindo'
  });

  // Periksa integritas awal database sumber
  const preIntegrity = await sourceExecutor.query<any>('PRAGMA integrity_check;');
  const preFk = await sourceExecutor.query<any>('PRAGMA foreign_key_check;');
  if (preIntegrity[0]?.integrity_check !== 'ok' || preFk.length > 0) {
    throw new Error('Database sumber gagal melewati integrity check atau foreign key check!');
  }
  console.log('   -> Database sumber siap & valid (0 pelanggaran foreign key, integrity: ok).\n');

  // -------------------------------------------------------------------------
  // 2. EKSPOR BACKUP & VERIFIKASI METADATA
  // -------------------------------------------------------------------------
  console.log('2. MEMBUAT BACKUP DATABASE LENGKAP...');
  const { backup, filename, jsonString } = await BackupRestoreService.createBackup(
    { id: 'SPBU-34-12301', name: 'SPBU Dago Bandung' },
    sourceExecutor
  );

  console.log(`   -> Nama Berkas: ${filename}`);
  console.log(`   -> App ID: ${backup.metadata.appId}`);
  console.log(`   -> Skema Versi: v${backup.metadata.schemaVersion}`);
  console.log(`   -> Total Rekaman: ${backup.metadata.totalRecords} baris`);
  console.log(`   -> Checksum: ${backup.metadata.checksum}`);

  if (backup.metadata.appId !== 'spbu-pembukuan-offline') throw new Error('AppId mismatch');
  if (backup.metadata.schemaVersion !== 4) throw new Error('Schema version mismatch');
  if (backup.metadata.totalRecords <= 0) throw new Error('Total records should be > 0');
  if (Object.keys(backup.data).length < 15) throw new Error('Expected at least 15 tables in backup');
  console.log('   -> PASS: Metadata dan seluruh tabel penting berhasil diekspor.\n');

  // -------------------------------------------------------------------------
  // 3. SKENARIO PENGUJIAN VALIDASI & ATURAN KESELAMATAN (SAFETY GATES)
  // -------------------------------------------------------------------------
  console.log('3. MENGUJI VALIDASI DAN PENOLAKAN BERKAS TIDAK AMAN...');

  // 3a. Berkas JSON Rusak / Terpotong
  const truncatedJson = jsonString.substring(0, 150);
  const valTruncated = BackupRestoreService.validateBackup(truncatedJson);
  if (!valTruncated.valid && valTruncated.error?.includes('rusak')) {
    console.log('   -> PASS: Berkas JSON rusak/terpotong ditolak secara aman.');
  } else {
    throw new Error('Gagal menolak berkas JSON terpotong!');
  }

  // 3b. Identitas Aplikasi Tidak Cocok
  const wrongAppFile = JSON.parse(jsonString);
  wrongAppFile.metadata.appId = 'app-warung-kopi';
  const valWrongApp = BackupRestoreService.validateBackup(wrongAppFile);
  if (!valWrongApp.valid && valWrongApp.error?.includes('Identitas aplikasi tidak cocok')) {
    console.log('   -> PASS: Identitas aplikasi yang tidak cocok ditolak secara aman.');
  } else {
    throw new Error('Gagal menolak App ID asing!');
  }

  // 3c-1. Penolakan Backup dengan Versi Skema Lebih Lama (v3 vs v4)
  const lowerSchemaFile = JSON.parse(jsonString);
  lowerSchemaFile.metadata.schemaVersion = 3; // App saat ini v4
  const valLowerSchema = BackupRestoreService.validateBackup(lowerSchemaFile);
  if (!valLowerSchema.valid && valLowerSchema.error?.includes('lebih lama')) {
    console.log('   -> PASS: Berkas dengan versi skema lebih lama (v3 vs v4) ditolak secara aman sebelum database disentuh.');
  } else {
    throw new Error('Gagal menolak versi skema v3 yang lebih lama!');
  }

  // 3c-2. Penolakan Backup dengan Versi Skema Lebih Tinggi (v5 vs v4)
  const higherSchemaFile = JSON.parse(jsonString);
  higherSchemaFile.metadata.schemaVersion = 5; // App saat ini v4
  const valHigherSchema = BackupRestoreService.validateBackup(higherSchemaFile);
  if (!valHigherSchema.valid && valHigherSchema.error?.includes('lebih tinggi')) {
    console.log('   -> PASS: Berkas dengan versi skema lebih tinggi (v5 vs v4) ditolak secara aman (no auto-downgrade).');
  } else {
    throw new Error('Gagal menolak versi skema yang lebih tinggi!');
  }

  // 3d. Deteksi Kerusakan Data / Hash Integritas Mismatch (SHA-256)
  const tamperedFile = JSON.parse(jsonString);
  tamperedFile.data.accounts[0].name = 'Akun Palsu Manipulasi';
  const valTampered = BackupRestoreService.validateBackup(tamperedFile);
  if (!valTampered.valid && valTampered.error?.includes('Hash')) {
    console.log('   -> PASS: Perubahan data/korupsi berkas terdeteksi dan ditolak via verifikasi Hash SHA-256.');
  } else {
    throw new Error(`Gagal mendeteksi kerusakan hash integritas! Error: ${valTampered.error}`);
  }

  // 3e. Pelanggaran Foreign Key Terdeteksi di Memori
  const brokenFkFile = JSON.parse(jsonString);
  brokenFkFile.data.journal_entries[0].journal_id = 'JRN-NON-EXISTENT'; // Parent tidak ada
  // Update checksum agar lolos checksum check dan secara spesifik menguji FK check
  brokenFkFile.metadata.checksum = computeBackupChecksum(JSON.stringify(brokenFkFile.data), 'sha256');
  const valBrokenFk = BackupRestoreService.validateBackup(brokenFkFile);
  if (!valBrokenFk.valid && valBrokenFk.error?.includes('Foreign Key')) {
    console.log('   -> PASS: Pelanggaran relasi Foreign Key terdeteksi dan ditolak sebelum menyentuh database.');
  } else {
    throw new Error(`Gagal mendeteksi broken foreign key! Error: ${valBrokenFk.error}`);
  }

  console.log('   -> PASS: Seluruh skenario penolakan berkas tidak aman berhasil.\n');

  // -------------------------------------------------------------------------
  // 4. RESTORE KE DATABASE TARGET YANG BERSIH
  // -------------------------------------------------------------------------
  console.log('4. MENJALANKAN RESTORE KE DATABASE TARGET BARU...');
  const targetDb = new SQL.Database();
  const targetExecutor = createDbExecutor(targetDb);

  // Buat skema awal v4 pada target
  await MigrationRunner.runMigrations(targetExecutor, MIGRATIONS);

  // Jalankan restore atomik
  const restoreRes = await BackupRestoreService.restoreBackup(backup, targetExecutor);
  console.log(`   -> Hasil Restore: ${restoreRes.message}`);
  console.log(`   -> Total Tabel Dipulihkan: ${restoreRes.restoredTables}`);
  console.log(`   -> Total Baris Dipulihkan: ${restoreRes.restoredRecords}`);

  if (!restoreRes.success) throw new Error('Restore failed');
  console.log('   -> PASS: Operasi restore selesai dengan sukses.\n');

  // -------------------------------------------------------------------------
  // 5. PERBANDINGAN STRUKTUR, JUMLAH REKAMAN & DATA DETAIL (BEFORE VS AFTER)
  // -------------------------------------------------------------------------
  console.log('5. MEMBANDINGKAN DATA SEBELUM DAN SESUDAH RESTORE (1:1 PARITY AUDIT)...');

  let tableMatchCount = 0;
  for (const table of TOPOLOGICAL_TABLES) {
    const srcRows = await sourceExecutor.query<any>(`SELECT COUNT(*) as count FROM ${table};`);
    const tgtRows = await targetExecutor.query<any>(`SELECT COUNT(*) as count FROM ${table};`);
    const srcCount = Number(srcRows[0].count);
    const tgtCount = Number(tgtRows[0].count);

    if (srcCount !== tgtCount) {
      throw new Error(`Inkonsistensi jumlah baris tabel ${table}: Sumber=${srcCount}, Target=${tgtCount}`);
    }
    tableMatchCount++;
  }
  console.log(`   -> Kesesuaian Baris: Seluruh ${tableMatchCount} tabel memiliki jumlah baris identik 100%.`);

  // Verifikasi keselarasan transaksi & jurnal
  const srcTx = await sourceExecutor.query<any>('SELECT id, code, total, payment_method FROM transactions ORDER BY id ASC;');
  const tgtTx = await targetExecutor.query<any>('SELECT id, code, total, payment_method FROM transactions ORDER BY id ASC;');
  if (JSON.stringify(srcTx) !== JSON.stringify(tgtTx)) {
    throw new Error('Data transaksi sebelum dan sesudah restore tidak cocok!');
  }
  console.log(`   -> Transaksi Terverifikasi: ${tgtTx.length} transaksi identik tanpa duplikasi.`);

  const srcJournals = await sourceExecutor.query<any>('SELECT id, evidence_no, is_balanced FROM journals ORDER BY id ASC;');
  const tgtJournals = await targetExecutor.query<any>('SELECT id, evidence_no, is_balanced FROM journals ORDER BY id ASC;');
  if (JSON.stringify(srcJournals) !== JSON.stringify(tgtJournals)) {
    throw new Error('Data jurnal sebelum dan sesudah restore tidak cocok!');
  }
  console.log(`   -> Jurnal Terverifikasi: ${tgtJournals.length} jurnal identik tanpa duplikasi.`);

  const srcJE = await sourceExecutor.query<any>('SELECT id, journal_id, account_id, debit, credit FROM journal_entries ORDER BY id ASC;');
  const tgtJE = await targetExecutor.query<any>('SELECT id, journal_id, account_id, debit, credit FROM journal_entries ORDER BY id ASC;');
  if (JSON.stringify(srcJE) !== JSON.stringify(tgtJE)) {
    throw new Error('Data detail jurnal entries tidak cocok!');
  }
  console.log(`   -> Baris Jurnal (Entries): ${tgtJE.length} entri debit/kredit identik.`);

  // Verifikasi saldo piutang
  const srcRcv = await sourceExecutor.query<any>('SELECT id, amount, outstanding, status FROM receivables ORDER BY id ASC;');
  const tgtRcv = await targetExecutor.query<any>('SELECT id, amount, outstanding, status FROM receivables ORDER BY id ASC;');
  if (JSON.stringify(srcRcv) !== JSON.stringify(tgtRcv)) {
    throw new Error('Data piutang tidak cocok!');
  }
  console.log(`   -> Piutang Usaha: ${tgtRcv.length} tagihan piutang identik.`);

  // Verifikasi utang
  const srcPay = await sourceExecutor.query<any>('SELECT id, amount, outstanding, status FROM payables ORDER BY id ASC;');
  const tgtPay = await targetExecutor.query<any>('SELECT id, amount, outstanding, status FROM payables ORDER BY id ASC;');
  if (JSON.stringify(srcPay) !== JSON.stringify(tgtPay)) {
    throw new Error('Data utang tidak cocok!');
  }
  console.log(`   -> Utang Usaha: ${tgtPay.length} catatan utang identik.`);

  // Verifikasi pegawai & absensi
  const srcPegawai = await sourceExecutor.query<any>('SELECT id, name, role FROM pegawai ORDER BY id ASC;');
  const tgtPegawai = await targetExecutor.query<any>('SELECT id, name, role FROM pegawai ORDER BY id ASC;');
  if (JSON.stringify(srcPegawai) !== JSON.stringify(tgtPegawai)) {
    throw new Error('Data pegawai tidak cocok!');
  }
  const srcAtt = await sourceExecutor.query<any>('SELECT id, employee_id, date, status FROM attendances ORDER BY id ASC;');
  const tgtAtt = await targetExecutor.query<any>('SELECT id, employee_id, date, status FROM attendances ORDER BY id ASC;');
  if (JSON.stringify(srcAtt) !== JSON.stringify(tgtAtt)) {
    throw new Error('Data absensi tidak cocok!');
  }
  console.log(`   -> Pegawai & Absensi: ${tgtPegawai.length} pegawai dan ${tgtAtt.length} absensi terverifikasi identik.`);

  console.log('   -> PASS: Audit paritas 1:1 data sebelum vs sesudah restore sukses penuh.\n');

  // -------------------------------------------------------------------------
  // 5b. KONSISTENSI SCHEMA_MIGRATIONS & APP_METADATA PASCA-RESTORE
  // -------------------------------------------------------------------------
  console.log('5b. MEMERIKSA KONSISTENSI SCHEMA_MIGRATIONS & APP_METADATA PASCA-RESTORE...');
  const appliedAfterRestore = await targetExecutor.query<any>(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;'
  );
  console.log(`   -> Riwayat Migrasi Aktif: ${appliedAfterRestore.map((a) => `v${a.version} (${a.name})`).join(', ')}`);
  if (appliedAfterRestore.length !== 4) {
    throw new Error(`Jumlah catatan migrasi tidak sesuai (diharapkan 4, ditemukan ${appliedAfterRestore.length})`);
  }
  const appMetaVer = await targetExecutor.query<any>("SELECT value FROM app_metadata WHERE key = 'schema_version';");
  if (appMetaVer[0]?.value !== '4') {
    throw new Error(`Versi skema app_metadata tidak sesuai: ${appMetaVer[0]?.value}`);
  }
  console.log('   -> PASS: schema_migrations dan app_metadata tetap utuh, valid, dan konsisten (v4).\n');

  // -------------------------------------------------------------------------
  // 5c. SIMULASI PENUTUPAN & PEMBUKAAN ULANG DATABASE (APP RESTART & IDEMPOTENCY)
  // -------------------------------------------------------------------------
  console.log('5c. SIMULASI PENUTUPAN & PEMBUKAAN ULANG DATABASE (APP RESTART & IDEMPOTENCY)...');
  const targetBinary = targetDb.export();
  const reopenedDb = new SQL.Database(targetBinary);
  const reopenedExecutor = createDbExecutor(reopenedDb);

  const initResult = await MigrationRunner.runMigrations(reopenedExecutor, MIGRATIONS);
  console.log(
    `   -> Hasil Inisialisasi Ulang: alreadyUpToDate=${initResult.alreadyUpToDate}, appliedCount=${initResult.appliedCount}, currentVersion=v${initResult.currentVersion}`
  );
  if (!initResult.alreadyUpToDate || initResult.appliedCount !== 0 || initResult.currentVersion !== 4) {
    throw new Error('Inisialisasi ulang gagal atau migrasi diaplikasikan ulang secara keliru!');
  }

  // Verifikasi data operasional tetap utuh setelah database dibuka ulang
  const reopenedTx = await reopenedExecutor.query<any>('SELECT COUNT(*) as count FROM transactions;');
  if (Number(reopenedTx[0].count) !== 2) {
    throw new Error('Data transaksi rusak setelah database dibuka ulang!');
  }
  console.log('   -> PASS: Inisialisasi aplikasi berhasil tanpa mengulang migrasi secara keliru, database berfungsi normal.\n');
  reopenedDb.close();

  // -------------------------------------------------------------------------
  // 6. UJI INTEGRITAS PRAGMA SQLITE PADA DATABASE TARGET
  // -------------------------------------------------------------------------
  console.log('6. MEMERIKSA PRAGMA INTEGRITY & PRAGMA FOREIGN KEY CHECK...');
  const postIntegrity = await targetExecutor.query<any>('PRAGMA integrity_check;');
  console.log(`   -> PRAGMA integrity_check: ${postIntegrity[0]?.integrity_check}`);
  if (postIntegrity[0]?.integrity_check !== 'ok') {
    throw new Error('Integrity check pada target database gagal!');
  }

  const postFk = await targetExecutor.query<any>('PRAGMA foreign_key_check;');
  console.log(`   -> PRAGMA foreign_key_check: ${postFk.length} pelanggaran`);
  if (postFk.length > 0) {
    throw new Error(`Target database memiliki ${postFk.length} pelanggaran relasi kunci asing!`);
  }
  console.log('   -> PASS: Database hasil pemulihan memenuhi standar integritas SQLite murni.\n');

  // -------------------------------------------------------------------------
  // 7. KEGAGALAN RESTORE TIDAK MERUSAK DATABASE AKTIF (ROLLBACK SAFETY)
  // -------------------------------------------------------------------------
  console.log('7. MENGUJI KETAHANAN KEGAGALAN RESTORE (ROLLBACK TRANSACTION SAFETY)...');
  // Ambil snapshot jumlah baris sebelum restore gagal
  const accountsBeforeFail = await targetExecutor.query<any>('SELECT COUNT(*) as count FROM accounts;');
  const txBeforeFail = await targetExecutor.query<any>('SELECT COUNT(*) as count FROM transactions;');

  // Siapkan file yang sengaja cacat pada saat query eksekusi SQL (misal nilai melanggar CHECK constraint)
  const corruptFile: SpbuBackupFile = JSON.parse(jsonString);
  // Tambah baris transaksi dengan total negatif (-500000) yang melanggar constraint CHECK(total > 0)
  corruptFile.data.transactions.push({
    id: 'TX-ILLEGAL',
    code: 'TRX-ILLEGAL',
    date: '2026-10-14',
    name: 'Transaksi Ilegal',
    category: 'Penjualan',
    total: -500000, // CHECK constraint violation!
    cashier: 'Operator',
    created_at: nowIso,
    updated_at: nowIso
  });
  corruptFile.metadata.totalRecords++;
  corruptFile.metadata.tableCounts.transactions++;
  corruptFile.metadata.checksum = computeBackupChecksum(JSON.stringify(corruptFile.data));

  let rollbackTriggered = false;
  try {
    await BackupRestoreService.restoreBackup(corruptFile, targetExecutor);
  } catch (err: any) {
    rollbackTriggered = true;
    console.log(`   -> Penolakan & Rollback tertangkap sesuai harapan: ${err.message}`);
  }

  if (!rollbackTriggered) {
    throw new Error('Transaksi ilegal tidak memicu rollback!');
  }

  // Verifikasi bahwa database target TIDAK rusak dan jumlah data tetap sama persis
  const accountsAfterFail = await targetExecutor.query<any>('SELECT COUNT(*) as count FROM accounts;');
  const txAfterFail = await targetExecutor.query<any>('SELECT COUNT(*) as count FROM transactions;');

  if (
    Number(accountsBeforeFail[0].count) !== Number(accountsAfterFail[0].count) ||
    Number(txBeforeFail[0].count) !== Number(txAfterFail[0].count)
  ) {
    throw new Error('Database aktif rusak akibat restore yang gagal!');
  }
  console.log('   -> PASS: Rollback menjamin database aktif 100% utuh saat restore mengalami kegagalan.\n');

  // -------------------------------------------------------------------------
  // 8. VERIFIKASI MASTER DATA SERVICE MEMUAT DARI HASIL RESTORE KE MODEL APLIKASI
  // -------------------------------------------------------------------------
  console.log('8. VERIFIKASI PEMUATAN DATA KE REACT APP CONTEXT MODEL...');
  const loadedSnapshot = await MasterDataService.loadAllMasterData(targetExecutor);

  console.log(`   -> Kategori Produk: ${loadedSnapshot.productCategories.length}`);
  console.log(`   -> Produk: ${loadedSnapshot.products.length}`);
  console.log(`   -> Tangki: ${loadedSnapshot.tanks.length}`);
  console.log(`   -> Nozzle: ${loadedSnapshot.nozzles.length}`);
  console.log(`   -> Akun COA: ${loadedSnapshot.accounts.length}`);
  console.log(`   -> Transaksi: ${loadedSnapshot.transactions.length}`);
  console.log(`   -> Jurnal: ${loadedSnapshot.journals.length}`);
  console.log(`   -> Piutang: ${loadedSnapshot.receivables.length}`);

  if (loadedSnapshot.transactions.length !== 2) throw new Error('Transaction count in snapshot mismatch');
  if (loadedSnapshot.journals.length !== 2) throw new Error('Journal count in snapshot mismatch');
  if (loadedSnapshot.accounts.length < 5) throw new Error('COA accounts should be present');

  console.log('   -> PASS: Model aplikasi berhasil memuat seluruh data dari SQLite hasil restore.\n');

  // Bersihkan database in-memory
  sourceDb.close();
  targetDb.close();

  console.log('====================================================================');
  console.log('   SELURUH PENGUJIAN PHASE 11 BERHASIL DENGAN SEMPURNA (100% PASS)');
  console.log('====================================================================\n');
}

main().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});

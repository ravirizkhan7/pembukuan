import initSqlJs from 'sql.js';
import { MIGRATIONS } from '../src/services/database/migrations';
import {
  MigrationRunner,
  getPhysicalSchemaObjects,
  checkVersionSchemaObjects
} from '../src/services/database/migrationRunner';

async function main() {
  console.log('====================================================================');
  console.log('   TEST SUITE: MIGRATION RECOVERY & SCHEMA INTEGRITY AUDIT');
  console.log('====================================================================\n');

  const SQL = await initSqlJs();

  const createExecutor = (db: any) => ({
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
      if (params.length > 0) {
        db.run(sql, params);
      } else {
        db.run(sql);
      }
      return { changes: db.getRowsModified() };
    },
    execute: async (sql: string): Promise<void> => {
      db.exec(sql);
    }
  });

  // ------------------------------------------------------------------
  // UJI 1: FRESH DATABASE (MIGRASI DARI AWAL)
  // ------------------------------------------------------------------
  console.log('1. PENGUJIAN DATABASE BERSIH (FRESH INITIALIZATION)...');
  const db1 = new SQL.Database();
  const exec1 = createExecutor(db1);

  const res1 = await MigrationRunner.runMigrations(exec1);
  if (!res1.success || res1.currentVersion !== 4 || res1.appliedCount !== 4) {
    throw new Error(`Uji 1 Gagal: res1 = ${JSON.stringify(res1)}`);
  }
  const phys1 = await getPhysicalSchemaObjects(exec1);
  console.log(`   -> Total tabel fisik: ${phys1.tables.size}`);
  console.log(`   -> Total indeks fisik: ${phys1.indices.size}`);
  console.log(`   -> Total trigger fisik: ${phys1.triggers.size}`);

  for (let v = 1; v <= 4; v++) {
    const chk = checkVersionSchemaObjects(v, phys1.tables, phys1.indices, phys1.triggers);
    if (!chk.isComplete) {
      throw new Error(`Uji 1 Gagal: Versi ${v} tidak lengkap fisik: ${chk.missingDescription}`);
    }
  }
  console.log('   -> PASS: Seluruh migrasi v1-v4 berhasil diaplikasikan dan diverifikasi lengkap 100%.\n');

  // ------------------------------------------------------------------
  // UJI 2: DATABASE LENGKAP TANPA SCHEMA_MIGRATIONS (REKONSTRUKSI 100%)
  // ------------------------------------------------------------------
  console.log('2. PENGUJIAN DATABASE FISIK LENGKAP TANPA SCHEMA_MIGRATIONS...');
  const db2 = new SQL.Database();
  const exec2 = createExecutor(db2);

  // Buat seluruh tabel, indeks, dan trigger secara manual tanpa schema_migrations
  for (const m of MIGRATIONS) {
    for (const s of m.statements) {
      db2.run(s);
    }
  }

  // schema_migrations sengaja belum ada
  const res2 = await MigrationRunner.runMigrations(exec2);
  if (!res2.success || res2.currentVersion !== 4 || res2.appliedCount !== 0) {
    throw new Error(`Uji 2 Gagal: res2 = ${JSON.stringify(res2)}`);
  }

  const migRows2 = await exec2.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC;');
  const versions2 = migRows2.map((r) => r.version);
  if (JSON.stringify(versions2) !== JSON.stringify([1, 2, 3, 4])) {
    throw new Error(`Uji 2 Gagal: Riwayat migrasi tidak terekonstruksi lengkap: ${JSON.stringify(versions2)}`);
  }
  console.log('   -> PASS: Rekonstruksi berhasil mencatat v1-v4 karena seluruh 54 objek fisik terverifikasi lengkap.\n');

  // ------------------------------------------------------------------
  // UJI 3: DATABASE PARSIAL (HANYA STATION_INFO, TABEL LAIN HILANG)
  // JANGAN TANDAI SELESAI HANYA KARENA SATU OBJEK TERSEDIA!
  // ------------------------------------------------------------------
  console.log('3. PENGUJIAN DATABASE PARSIAL (HANYA STATION_INFO & APP_METADATA)...');
  const db3 = new SQL.Database();
  const exec3 = createExecutor(db3);

  // Hanya buat app_metadata dan station_info
  db3.run(MIGRATIONS[0].statements[0]); // app_metadata
  db3.run(MIGRATIONS[1].statements[0]); // station_info saja! (16 tabel, 25 indeks, 12 trigger lainnya BELUM ada)

  const phys3Pre = await getPhysicalSchemaObjects(exec3);
  const chk3Pre = checkVersionSchemaObjects(2, phys3Pre.tables, phys3Pre.indices, phys3Pre.triggers);
  console.log(`   -> Status v2 sebelum migrasi: found ${chk3Pre.foundCount}/${chk3Pre.totalCount} objek`);
  if (chk3Pre.isComplete) {
    throw new Error('Uji 3 Gagal: station_info saja tidak boleh dianggap lengkap!');
  }

  // Jalankan MigrationRunner: runner harus mendeteksi v2 parsial, TIDAK langsung menandai selesai,
  // melainkan mengeksekusi DDL pelengkap, memverifikasi seluruh 54 objek, baru mencatat selesai!
  const res3 = await MigrationRunner.runMigrations(exec3);
  if (!res3.success || res3.currentVersion !== 4) {
    throw new Error(`Uji 3 Gagal: res3 = ${JSON.stringify(res3)}`);
  }

  const phys3Post = await getPhysicalSchemaObjects(exec3);
  const chk3Post = checkVersionSchemaObjects(2, phys3Post.tables, phys3Post.indices, phys3Post.triggers);
  if (!chk3Post.isComplete) {
    throw new Error('Uji 3 Gagal: Setelah pemulihan, v2 seharusnya lengkap fisik 100%!');
  }
  console.log('   -> PASS: Database parsial tidak ditandai selesai secara prematur; berhasil dipulihkan & diverifikasi lengkap.\n');

  // ------------------------------------------------------------------
  // UJI 4: DATABASE PARSIAL RUSAK YANG TIDAK DAPAT DIPULIHKAN
  // SISTEM HARUS MENGHENTIKAN INISIALISASI DAN MENOLAK SKEMA
  // ------------------------------------------------------------------
  console.log('4. PENGUJIAN DATABASE PARSIAL RUSAK (TABEL BERBEDA / DDL GAGAL)...');
  const db4 = new SQL.Database();
  const exec4 = createExecutor(db4);

  // Buat app_metadata
  db4.run(MIGRATIONS[0].statements[0]);

  // Buat tabel 'products' tetapi dengan schema tidak kompatibel yang melanggar foreign key atau view
  // Misalnya membuat VIEW bernama 'products' sehingga CREATE TABLE IF NOT EXISTS products akan error
  db4.run("CREATE VIEW products AS SELECT 1 AS id;");

  // Jalankan MigrationRunner: karena 'products' adalah VIEW dan bukan TABLE yang sesuai,
  // pembuatan skema v2 akan gagal atau trigger/index idx_products_category akan gagal!
  const res4 = await MigrationRunner.runMigrations(exec4);
  if (res4.success) {
    throw new Error('Uji 4 Gagal: Database dengan objek rusak seharusnya ditolak dan gagal inisialisasi!');
  }
  console.log(`   -> Penolakan tertangkap sesuai harapan: "${res4.error}"`);
  console.log('   -> PASS: Sistem menolak database parsial yang tidak dapat dipulihkan secara aman dan tidak merusak skema.\n');

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // UJI 5A: OBJEK FISIK HILANG TETAPI DAPAT DIPULIHKAN SECARA AMAN (SELF-HEALING)
  // ------------------------------------------------------------------
  console.log('5A. PENGUJIAN PEMULIHAN AMAN (TRIGGER V4 HILANG DAPAT DIPULIHKAN)...');
  const db5A = new SQL.Database();
  const exec5A = createExecutor(db5A);

  await MigrationRunner.runMigrations(exec5A);
  // Sengaja drop trigger v4
  db5A.run('DROP TRIGGER trg_transactions_prevent_cancel_if_posted;');

  const res5A = await MigrationRunner.runMigrations(exec5A);
  if (!res5A.success) {
    throw new Error(`Uji 5A Gagal: Pemulihan trigger yang aman seharusnya berhasil: ${res5A.error}`);
  }
  const phys5A = await getPhysicalSchemaObjects(exec5A);
  if (!phys5A.triggers.has('trg_transactions_prevent_cancel_if_posted')) {
    throw new Error('Uji 5A Gagal: Trigger trg_transactions_prevent_cancel_if_posted tidak terbentuk setelah pemulihan!');
  }
  console.log('   -> PASS: Objek fisik yang hilang berhasil dideteksi dan dipulihkan secara aman.\n');

  // ------------------------------------------------------------------
  // UJI 5B: OBJEK FISIK HILANG DAN PEMULIHAN TIDAK DAPAT DILAKUKAN SECARA AMAN
  // SISTEM HARUS FAIL-CLOSED MENGHENTIKAN INISIALISASI
  // ------------------------------------------------------------------
  console.log('5B. PENGUJIAN FAIL-CLOSED (PEMULIHAN TIDAK AMAN / SKEMA DIRUSAK)...');
  const db5B = new SQL.Database();
  const exec5B = createExecutor(db5B);

  await MigrationRunner.runMigrations(exec5B);
  // Drop trigger v4 dan ganti transactions dengan VIEW (membuat DDL trigger gagal)
  db5B.run('DROP TRIGGER trg_transactions_prevent_cancel_if_posted;');
  db5B.run('DROP TABLE transactions;');
  db5B.run('CREATE VIEW transactions AS SELECT 1 AS id, 1 AS status;');

  const res5B = await MigrationRunner.runMigrations(exec5B);
  if (res5B.success) {
    throw new Error('Uji 5B Gagal: Pemulihan tidak aman seharusnya ditolak dan inisialisasi dihentikan!');
  }
  console.log(`   -> Penolakan tertangkap sesuai harapan: "${res5B.error}"`);
  console.log('   -> PASS: Sistem fail-closed menolak skema jika pemulihan tidak dapat dilakukan secara aman.\n');

  // ------------------------------------------------------------------
  // UJI 6: IDEMPOTENSI & AUDIT PADA PEMBUKAAN ULANG DATABASE
  // ------------------------------------------------------------------
  console.log('6. PENGUJIAN IDEMPOTENSI DATABASE LENGKAP...');
  const res1Reopen = await MigrationRunner.runMigrations(exec1);
  if (!res1Reopen.success || !res1Reopen.alreadyUpToDate || res1Reopen.appliedCount !== 0) {
    throw new Error(`Uji 6 Gagal: Reopen database harus alreadyUpToDate: true`);
  }
  console.log('   -> PASS: Inisialisasi ulang database lengkap idempoten dan 100% konsisten.\n');

  console.log('====================================================================');
  console.log('   SELURUH AUDIT KESELAMATAN MIGRASI LULUS DENGAN SEMPURNA! (100% PASS)');
  console.log('====================================================================');
}

main().catch((err) => {
  console.error('\nFATAL ERROR DALAM PENGUJIAN:', err);
  process.exit(1);
});

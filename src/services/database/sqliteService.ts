import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection
} from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';
import { DATABASE_NAME, DATABASE_VERSION, DATABASE_MIGRATIONS } from './databaseConfig';
import { MigrationRunner } from './migrationRunner';

/**
 * SQLite Service Singleton
 * Mengelola siklus hidup koneksi tunggal (single reusable connection)
 * ke database native SQLite (Android) serta web platform.
 */
class SQLiteService {
  private static instance: SQLiteService | null = null;
  private sqliteConnection: SQLiteConnection | null = null;
  private dbConnection: SQLiteDBConnection | null = null;
  private isInitialized = false;
  private initPromise: Promise<SQLiteDBConnection> | null = null;

  private constructor() {
    // Private constructor untuk menerapkan Singleton
  }

  public static getInstance(): SQLiteService {
    if (!SQLiteService.instance) {
      SQLiteService.instance = new SQLiteService();
    }
    return SQLiteService.instance;
  }

  /**
   * Menyiapkan Web Store jika aplikasi dijalankan pada browser / web preview
   */
  private async setupWebPlatform(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      defineJeepSqlite(window);
      if (!document.querySelector('jeep-sqlite')) {
        const jeepEl = document.createElement('jeep-sqlite');
        jeepEl.setAttribute('wasmPath', '/assets');
        document.body.appendChild(jeepEl);
        await customElements.whenDefined('jeep-sqlite');
      }

      if (this.sqliteConnection) {
        await this.sqliteConnection.initWebStore();
      }
    } catch (err) {
      console.warn('[SQLiteService] Web store setup warning (Web environment only):', err);
    }
  }

  /**
   * Menginisialisasi koneksi SQLite tunggal yang dapat digunakan kembali (reusable)
   */
  public async initialize(): Promise<SQLiteDBConnection> {
    // Jika sudah diinisialisasi dan koneksi masih aktif, kembalikan koneksi yang ada
    if (this.isInitialized && this.dbConnection) {
      const isStillOpen = await this.dbConnection.isDBOpen();
      if (isStillOpen?.result) {
        return this.dbConnection;
      }
    }

    // Jika sedang dalam proses inisialisasi, tunggu promise yang sedang berjalan
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log(`[SQLiteService] Inisialisasi SQLite database: ${DATABASE_NAME} (Platform: ${Capacitor.getPlatform()})`);

        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);

        // Jika di web, siapkan jeep-sqlite web store
        if (Capacitor.getPlatform() === 'web') {
          await this.setupWebPlatform();
        }

        // Daftarkan migration statements
        await this.sqliteConnection.addUpgradeStatement(DATABASE_NAME, DATABASE_MIGRATIONS);

        // Periksa apakah koneksi sudah pernah dibuat di dictionary plugin
        const checkConn = await this.sqliteConnection.isConnection(DATABASE_NAME, false);
        if (checkConn?.result) {
          this.dbConnection = await this.sqliteConnection.retrieveConnection(DATABASE_NAME, false);
        } else {
          this.dbConnection = await this.sqliteConnection.createConnection(
            DATABASE_NAME,
            false,
            'no-encryption',
            DATABASE_VERSION,
            false
          );
        }

        // Buka database jika belum terbuka
        const isOpen = await this.dbConnection.isDBOpen();
        if (!isOpen?.result) {
          await this.dbConnection.open();
        }

        // Pastikan Foreign Keys constraint aktif pada koneksi database
        await this.dbConnection.execute('PRAGMA foreign_keys = ON;');

        // Jalankan migration runner untuk menjamin sinkronisasi skema & pencatatan versi
        const migrationResult = await MigrationRunner.runMigrations(this);
        if (!migrationResult.success) {
          throw new Error(`Migrasi database gagal: ${migrationResult.error}`);
        }

        // Jika di web, sinkronkan ke store IndexedDB
        if (Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
          await this.sqliteConnection.saveToStore(DATABASE_NAME);
        }

        this.isInitialized = true;
        console.log(`[SQLiteService] Database ${DATABASE_NAME} berhasil dibuka & siap digunakan.`);
        return this.dbConnection;
      } catch (error) {
        this.isInitialized = false;
        this.dbConnection = null;
        console.error('[SQLiteService] Gagal menginisialisasi SQLite database:', error);
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Mengambil instance koneksi database aktif
   */
  public async getConnection(): Promise<SQLiteDBConnection> {
    if (this.dbConnection) {
      const checkOpen = await this.dbConnection.isDBOpen();
      if (checkOpen?.result) {
        return this.dbConnection;
      }
    }
    return this.initialize();
  }

  /**
   * Menjalankan query SELECT dengan parameter binding
   */
  public async query<T = any>(statement: string, params: any[] = []): Promise<T[]> {
    const db = await this.getConnection();
    const result = await db.query(statement, params);
    return (result.values as T[]) || [];
  }

  /**
   * Menjalankan statement INSERT / UPDATE / DELETE dengan parameter binding
   */
  public async run(statement: string, params: any[] = []): Promise<{ changes: number; lastId?: number }> {
    const db = await this.getConnection();
    const isTrans = await db.isTransactionActive();
    const isInsideTransaction = !!isTrans?.result;
    const result = await db.run(statement, params, !isInsideTransaction);

    // Pada web, persist ke IndexedDB setelah mutasi jika di luar transaksi
    if (!isInsideTransaction && Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
      await this.sqliteConnection.saveToStore(DATABASE_NAME);
    }

    return {
      changes: result.changes?.changes || 0,
      lastId: result.changes?.lastId
    };
  }

  /**
   * Menjalankan statement SQL mentah tanpa parameter binding (DDL, PRAGMA, batch)
   */
  public async execute(statements: string): Promise<void> {
    const db = await this.getConnection();
    // Normalisasi DDL: Plugin @capacitor-community/sqlite Android membagi script berdasarkan ";\n".
    // Pada trigger multi-statement, titik koma internal di dalam blok BEGIN ... END yang diikuti newline
    // dapat terpecah dan menyebabkan syntax error. Gantikan titik koma internal dengan "; ".
    const normalized = statements.replace(/;\s*[\r\n]+/g, (match, offset, str) => {
      const remaining = str.slice(offset + match.length).trim();
      return remaining.length === 0 ? ';' : '; ';
    });
    await db.execute(normalized);

    // Pada web, persist ke IndexedDB setelah mutasi DDL
    if (Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
      await this.sqliteConnection.saveToStore(DATABASE_NAME);
    }
  }

  /**
   * Menjalankan sekumpulan operasi dalam transaksi database (BEGIN ... COMMIT / ROLLBACK)
   */
  public async runTransaction<T>(action: (db: SQLiteDBConnection) => Promise<T>): Promise<T> {
    const db = await this.getConnection();
    const isTrans = await db.isTransactionActive();
    if (isTrans?.result) {
      // Jika sudah berada dalam transaksi aktif, jalankan action langsung tanpa nested begin/commit
      return await action(db);
    }

    await db.beginTransaction();
    try {
      const result = await action(db);
      await db.commitTransaction();

      if (Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
        await this.sqliteConnection.saveToStore(DATABASE_NAME);
      }

      return result;
    } catch (err) {
      await db.rollbackTransaction();
      console.error('[SQLiteService] Transaksi di-rollback karena error:', err);
      throw err;
    }
  }

  /**
   * Mendapatkan versi SQLite native
   */
  public async getSqliteVersion(): Promise<string> {
    const rows = await this.query<{ version: string }>('SELECT sqlite_version() AS version;');
    if (rows && rows.length > 0 && rows[0].version) {
      return rows[0].version;
    }
    return 'Unknown';
  }

  /**
   * Menutup koneksi database secara graceful
   */
  public async close(): Promise<void> {
    if (this.dbConnection) {
      try {
        const isOpen = await this.dbConnection.isDBOpen();
        if (isOpen?.result) {
          await this.dbConnection.close();
        }
        if (this.sqliteConnection) {
          await this.sqliteConnection.closeConnection(DATABASE_NAME, false);
        }
      } catch (err) {
        console.warn('[SQLiteService] Error closing connection:', err);
      } finally {
        this.dbConnection = null;
        this.isInitialized = false;
      }
    }
  }

  public isReady(): boolean {
    return this.isInitialized && this.dbConnection !== null;
  }
}

export const sqliteService = SQLiteService.getInstance();

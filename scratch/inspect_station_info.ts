import initSqlJs from 'sql.js';
import { SqlExecutor, MigrationRunner } from '../src/services/database/migrationRunner';

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

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const executor = new SqlJsExecutor(db);

  await MigrationRunner.runMigrations(executor);

  const info = await executor.query<any>('PRAGMA table_info(station_info);');
  console.log('station_info columns:', JSON.stringify(info, null, 2));

  const rows = await executor.query<any>('SELECT * FROM station_info;');
  console.log('station_info rows:', JSON.stringify(rows, null, 2));
}

main().catch(console.error);

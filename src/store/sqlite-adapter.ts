import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";

let sqlJsReady: Promise<any> | null = null;

async function ensureSqlJs() {
  if (!sqlJsReady) {
    sqlJsReady = initSqlJs();
  }
  return sqlJsReady;
}

export interface SqliteResult {
  changes: number;
  lastInsertRowid: number;
}

export interface SqliteDatabase {
  run(sql: string, params?: unknown[]): SqliteResult;
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined;
  all<T = unknown>(sql: string, params?: unknown[]): T[];
  exec(sql: string): void;
  close(): void;
}

export async function openDb(dbPath: string): Promise<SqliteDatabase> {
  const SQL = await ensureSqlJs();

  let db: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    const dir = path.dirname(dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new SQL.Database();
  }

  return new SqlJsAdapter(db, dbPath);
}

class SqlJsAdapter implements SqliteDatabase {
  private dirty = false;

  constructor(
    private db: SqlJsDatabase,
    private dbPath: string
  ) {}

  run(sql: string, params?: unknown[]): SqliteResult {
    this.db.run(sql, params);
    this.dirty = true;
    this.saveToFile();
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: 0,
    };
  }

  get<T = unknown>(sql: string, params?: unknown[]): T | undefined {
    const stmt = this.db.prepare(sql);
    stmt.bind(params ?? []);
    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all<T = unknown>(sql: string, params?: unknown[]): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params ?? []);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  exec(sql: string): void {
    this.db.exec(sql);
    this.dirty = true;
    this.saveToFile();
  }

  close(): void {
    if (this.dirty) this.saveToFile();
    this.db.close();
  }

  private saveToFile(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this.dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, buffer);
  }
}

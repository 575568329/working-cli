import { openDb, type SqliteDatabase } from "./sqlite-adapter.js";
import { mkdirSync, existsSync } from "fs";
import path from "path";

export interface SearchHistoryRecord {
  id: number;
  keyword: string;
  city: string | null;
  filters: string;
  result_count: number;
  created_at: string;
}

export interface MessageRecord {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export class Database {
  private db: SqliteDatabase | null = null;
  private dbPath: string;
  private ready = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    if (this.ready) return;

    const dir = path.dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = await openDb(this.dbPath);
    this.ready = true;
    this.initTables();
  }

  private ensureReady(): SqliteDatabase {
    if (!this.db || !this.ready) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return this.db;
  }

  private initTables(): void {
    const db = this.ensureReady();
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        city TEXT,
        filters TEXT DEFAULT '{}',
        result_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conversation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  // ── 搜索历史 ──

  saveSearchHistory(record: {
    keyword: string;
    city?: string;
    filters?: string;
    resultCount: number;
  }): void {
    const db = this.ensureReady();
    db.run(
      "INSERT INTO search_history (keyword, city, filters, result_count) VALUES (?, ?, ?, ?)",
      [record.keyword, record.city ?? null, record.filters ?? "{}", record.resultCount]
    );
  }

  getSearchHistory(limit = 20): SearchHistoryRecord[] {
    const db = this.ensureReady();
    return db.all<SearchHistoryRecord>(
      "SELECT * FROM search_history ORDER BY id DESC LIMIT ?",
      [limit]
    );
  }

  // ── 会话消息 ──

  saveMessage(sessionId: string, role: string, content: string): void {
    const db = this.ensureReady();
    db.run(
      "INSERT INTO conversation (session_id, role, content) VALUES (?, ?, ?)",
      [sessionId, role, content]
    );
  }

  getMessages(sessionId: string, limit = 50): MessageRecord[] {
    const db = this.ensureReady();
    return db.all<MessageRecord>(
      "SELECT * FROM conversation WHERE session_id = ? ORDER BY id ASC LIMIT ?",
      [sessionId, limit]
    );
  }

  clearMessages(sessionId: string): void {
    const db = this.ensureReady();
    db.run("DELETE FROM conversation WHERE session_id = ?", [sessionId]);
  }

  // ── 用户画像 ──

  saveProfile(key: string, value: string): void {
    const db = this.ensureReady();
    db.run(
      "INSERT OR REPLACE INTO user_profile (key, value) VALUES (?, ?)",
      [key, value]
    );
  }

  getProfile(key: string): string | undefined {
    const db = this.ensureReady();
    const row = db.get<{ value: string }>(
      "SELECT value FROM user_profile WHERE key = ?",
      [key]
    );
    return row?.value;
  }

  getAllProfile(): Record<string, string> {
    const db = this.ensureReady();
    const rows = db.all<{ key: string; value: string }>("SELECT key, value FROM user_profile");
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ── 生命周期 ──

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.ready = false;
    }
  }
}

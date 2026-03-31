import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../../src/store/db.js";
import { rmSync, existsSync } from "fs";
import path from "path";
import os from "os";

const DB_PATH = path.join(os.tmpdir(), `boss-agent-test-${Date.now()}.db`);

describe("Database", () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database(DB_PATH);
    await db.init();
  });

  afterEach(() => {
    db.close();
    if (existsSync(DB_PATH)) rmSync(DB_PATH, { force: true });
  });

  // ── 搜索历史 ──

  it("应保存和查询搜索历史", () => {
    db.saveSearchHistory({ keyword: "Java", city: "杭州", resultCount: 35 });
    const history = db.getSearchHistory();
    expect(history).toHaveLength(1);
    expect(history[0].keyword).toBe("Java");
    expect(history[0].city).toBe("杭州");
    expect(history[0].result_count).toBe(35);
  });

  it("应按时间倒序返回", () => {
    db.saveSearchHistory({ keyword: "Java", resultCount: 10 });
    db.saveSearchHistory({ keyword: "Python", resultCount: 20 });
    const history = db.getSearchHistory();
    expect(history[0].keyword).toBe("Python");
    expect(history[1].keyword).toBe("Java");
  });

  it("应支持 limit 参数", () => {
    for (let i = 0; i < 5; i++) {
      db.saveSearchHistory({ keyword: `Job${i}`, resultCount: i });
    }
    const history = db.getSearchHistory(3);
    expect(history).toHaveLength(3);
  });

  // ── 会话消息 ──

  it("应保存和查询会话消息", () => {
    db.saveMessage("session-1", "user", "找Java岗位");
    db.saveMessage("session-1", "assistant", "找到35个");
    const msgs = db.getMessages("session-1");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
  });

  it("不同 session 应隔离", () => {
    db.saveMessage("session-1", "user", "hello");
    db.saveMessage("session-2", "user", "world");
    expect(db.getMessages("session-1")).toHaveLength(1);
    expect(db.getMessages("session-2")).toHaveLength(1);
  });

  it("clearMessages 应清除指定 session", () => {
    db.saveMessage("session-1", "user", "hello");
    db.saveMessage("session-2", "user", "world");
    db.clearMessages("session-1");
    expect(db.getMessages("session-1")).toHaveLength(0);
    expect(db.getMessages("session-2")).toHaveLength(1);
  });

  // ── 用户画像 ──

  it("应保存和读取用户画像", () => {
    db.saveProfile("skills", JSON.stringify(["Java", "Go"]));
    const value = db.getProfile("skills");
    expect(value).toBe(JSON.stringify(["Java", "Go"]));
  });

  it("getAllProfile 应返回所有画像", () => {
    db.saveProfile("skills", "[]");
    db.saveProfile("experience", "3-5年");
    const all = db.getAllProfile();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all.skills).toBe("[]");
  });

  it("saveProfile 应覆盖已有值", () => {
    db.saveProfile("key", "old");
    db.saveProfile("key", "new");
    expect(db.getProfile("key")).toBe("new");
  });

  it("getProfile 不存在的 key 应返回 undefined", () => {
    expect(db.getProfile("nonexistent")).toBeUndefined();
  });
});

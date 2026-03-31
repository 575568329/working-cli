import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isCredentialValid,
  hasRequiredCookies,
  getMissingCookies,
  createCredential,
  saveCredential,
  loadCredential,
  clearCredential,
  getCredentialPath,
} from "../../src/client/auth.js";
import { existsSync, rmSync } from "fs";
import path from "path";

describe("auth", () => {
  beforeEach(() => {
    // 每个测试前清理凭证文件，确保隔离
    const credPath = getCredentialPath();
    if (existsSync(credPath)) {
      rmSync(credPath);
    }
  });

  afterEach(() => {
    // 每个测试后清理凭证文件
    const credPath = getCredentialPath();
    if (existsSync(credPath)) {
      rmSync(credPath);
    }
  });

  // ── Credential 工具 ──

  describe("isCredentialValid", () => {
    it("有效 Credential 返回 true", () => {
      const cred = createCredential({ __zp_stoken__: "abc", geek_zp_token: "xyz" });
      expect(isCredentialValid(cred)).toBe(true);
    });

    it("null 返回 false", () => {
      expect(isCredentialValid(null)).toBe(false);
    });

    it("空 cookies 返回 false", () => {
      expect(isCredentialValid({ cookies: {} })).toBe(false);
    });
  });

  describe("hasRequiredCookies", () => {
    it("包含所有必需 Cookie 返回 true", () => {
      const cred = createCredential({ __zp_stoken__: "a", geek_zp_token: "b" });
      expect(hasRequiredCookies(cred)).toBe(true);
    });

    it("缺少必需 Cookie 返回 false", () => {
      const cred = createCredential({ __zp_stoken__: "a" });
      expect(hasRequiredCookies(cred)).toBe(false);
    });
  });

  describe("getMissingCookies", () => {
    it("应返回缺少的 Cookie 名称", () => {
      const cred = createCredential({ __zp_stoken__: "a" });
      const missing = getMissingCookies(cred);
      expect(missing).toContain("geek_zp_token");
    });

    it("不缺时返回空数组", () => {
      const cred = createCredential({ __zp_stoken__: "a", geek_zp_token: "b" });
      expect(getMissingCookies(cred)).toEqual([]);
    });
  });

  describe("createCredential", () => {
    it("应创建带 savedAt 的 Credential", () => {
      const before = Date.now();
      const cred = createCredential({ __zp_stoken__: "test" });
      const after = Date.now();
      expect(cred.cookies).toEqual({ __zp_stoken__: "test" });
      expect(cred.savedAt).toBeGreaterThanOrEqual(before);
      expect(cred.savedAt).toBeLessThanOrEqual(after);
    });
  });

  // ── 持久化 ──

  describe("saveCredential / loadCredential", () => {
    it("保存后能加载", () => {
      const cred = createCredential({ __zp_stoken__: "token1", geek_zp_token: "token2" });
      saveCredential(cred);

      const loaded = loadCredential();
      expect(loaded).not.toBeNull();
      expect(loaded!.cookies.__zp_stoken__).toBe("token1");
      expect(loaded!.cookies.geek_zp_token).toBe("token2");
    });

    it("无文件时返回 null", () => {
      expect(loadCredential()).toBeNull();
    });

    it("缺少必需 Cookie 的文件返回 null", () => {
      const cred = createCredential({ __zp_stoken__: "only-one" });
      saveCredential(cred);
      // 强制写入不完整的 cookies
      expect(loadCredential()).toBeNull();
    });
  });

  describe("clearCredential", () => {
    it("清除后文件不存在", () => {
      const cred = createCredential({ __zp_stoken__: "a", geek_zp_token: "b" });
      saveCredential(cred);
      expect(existsSync(getCredentialPath())).toBe(true);

      clearCredential();
      expect(existsSync(getCredentialPath())).toBe(false);
    });

    it("文件不存在时也不报错", () => {
      expect(() => clearCredential()).not.toThrow();
    });
  });
});

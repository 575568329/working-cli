import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import path from "path";
import type { Credential } from "./types.js";
import { REQUIRED_COOKIES } from "./constants.js";

const CONFIG_DIR = path.join(homedir(), ".boss-agent");
const CREDENTIAL_FILE = path.join(CONFIG_DIR, "credential.json");
const CREDENTIAL_TTL_SECONDS = 7 * 86400; // 7 天

// ── Credential 工具 ──

export function isCredentialValid(cred: Credential | null): cred is Credential {
  if (!cred || !cred.cookies) return false;
  return Object.keys(cred.cookies).length > 0;
}

export function hasRequiredCookies(cred: Credential): boolean {
  for (const name of REQUIRED_COOKIES) {
    if (!cred.cookies[name]) return false;
  }
  return true;
}

export function getMissingCookies(cred: Credential): string[] {
  return [...REQUIRED_COOKIES].filter((name) => !cred.cookies[name]);
}

export function createCredential(cookies: Record<string, string>): Credential {
  return { cookies, savedAt: Date.now() };
}

// ── 持久化 ──

export function saveCredential(cred: Credential): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const data = {
    cookies: cred.cookies,
    savedAt: cred.savedAt ?? Date.now(),
  };
  writeFileSync(CREDENTIAL_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function loadCredential(): Credential | null {
  if (!existsSync(CREDENTIAL_FILE)) return null;

  try {
    const data = JSON.parse(readFileSync(CREDENTIAL_FILE, "utf-8"));
    const cred: Credential = {
      cookies: data.cookies ?? {},
      savedAt: data.savedAt,
    };

    if (!isCredentialValid(cred)) return null;
    if (!hasRequiredCookies(cred)) {
      const missing = getMissingCookies(cred).join(", ");
      console.warn(`Cookie 缺少必需字段: ${missing}`);
      return null;
    }

    // TTL 检查：超过 7 天时发出警告但仍返回
    if (cred.savedAt && Date.now() - cred.savedAt > CREDENTIAL_TTL_SECONDS) {
      console.warn("Cookie 已超过 7 天，建议重新登录");
    }

    return cred;
  } catch {
    return null;
  }
}

export function clearCredential(): void {
  if (existsSync(CREDENTIAL_FILE)) {
    unlinkSync(CREDENTIAL_FILE);
  }
}

// ── 统一获取 Credential ──

export function getCredential(): Credential | null {
  // 1. 尝试加载已保存的
  const saved = loadCredential();
  if (saved) return saved;

  // 2. 浏览器 Cookie 提取（需要 browser-cookie3，后续实现）
  // TODO: extractBrowserCredential()

  return null;
}

export function getCredentialPath(): string {
  return CREDENTIAL_FILE;
}

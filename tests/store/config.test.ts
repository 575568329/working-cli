import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, saveConfig, deepMerge } from "../../src/store/config.js";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";

const TEST_DIR = path.join(os.tmpdir(), "boss-agent-test-config-" + Date.now());

describe("deepMerge", () => {
  it("应合并嵌套对象", () => {
    const result = deepMerge(
      { a: { b: 1, c: 2 }, d: 3 },
      { a: { b: 10 } } as any
    );
    expect(result.a.b).toBe(10);
    expect(result.a.c).toBe(2);
    expect(result.d).toBe(3);
  });

  it("数组应直接替换", () => {
    const result = deepMerge(
      { skills: [1, 2, 3] },
      { skills: [4, 5] } as any
    );
    expect(result.skills).toEqual([4, 5]);
  });
});

describe("loadConfig", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.OPENAI_API_KEY;
  });

  it("无配置文件时返回默认值", () => {
    const config = loadConfig(TEST_DIR);
    expect(config.llm.provider).toBe("openai");
    expect(config.llm.model).toBe("gpt-4o");
    expect(config.search.pageSize).toBe(15);
    expect(config.antiDetect.requestDelay).toBe(1.0);
  });

  it("配置文件应覆盖默认值", () => {
    writeFileSync(
      path.join(TEST_DIR, "config.json"),
      JSON.stringify({ llm: { provider: "claude", model: "claude-sonnet-4-20250514" } })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.llm.provider).toBe("claude");
    expect(config.llm.model).toBe("claude-sonnet-4-20250514");
    // 未覆盖的保持默认
    expect(config.search.pageSize).toBe(15);
  });

  it("环境变量应覆盖 apiKey", () => {
    const config = loadConfig(TEST_DIR);
    expect(config.llm.apiKey).toBe("test-key");
  });

  it("ANTHROPIC_API_KEY 应作为 fallback", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    const config = loadConfig(TEST_DIR);
    expect(config.llm.apiKey).toBe("anthropic-key");
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("损坏的配置文件应被忽略", () => {
    writeFileSync(path.join(TEST_DIR, "config.json"), "invalid json{{{");
    const config = loadConfig(TEST_DIR);
    expect(config.llm.provider).toBe("openai"); // 回退到默认
  });
});

describe("saveConfig", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("应保存配置到文件", () => {
    saveConfig(TEST_DIR, { search: { defaultCity: "杭州", pageSize: 20 } });
    const configPath = path.join(TEST_DIR, "config.json");
    expect(existsSync(configPath)).toBe(true);
    const saved = JSON.parse(
      require("fs").readFileSync(configPath, "utf-8")
    );
    expect(saved.search.defaultCity).toBe("杭州");
  });

  it("应与现有配置合并", () => {
    saveConfig(TEST_DIR, { search: { defaultCity: "杭州", pageSize: 15 } });
    saveConfig(TEST_DIR, { llm: { provider: "claude", model: "claude-3" } });
    const configPath = path.join(TEST_DIR, "config.json");
    const saved = JSON.parse(
      require("fs").readFileSync(configPath, "utf-8")
    );
    expect(saved.search.defaultCity).toBe("杭州");
    expect(saved.llm.provider).toBe("claude");
  });
});

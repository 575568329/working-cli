# Boss Agent 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现一个基于终端的 Boss 直聘求职助手，支持自然语言对话 + 斜杠命令。

**Architecture:** 分层架构 — REPL 交互层 → Command Router / LangChain Agent → Services → BossClient → LLM Provider / Store。自底向上构建，每层独立可测。

**Tech Stack:** TypeScript 5.x / Node.js 22+ / Bun 1.x / LangChain.js / better-sqlite3 + bun:sqlite / chalk + cli-table3

**Runtime:** 优先 Bun（更快），兼容 Node.js。所有代码双运行时可运行。

**Design Doc:** `docs/plans/20260331-boss-agent-design.md`

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `.env.example`
- Create: `boss-agent.json.example`
- Create: `src/index.ts`
- Create: `.gitignore`

**Step 1: 初始化项目**

```bash
cd "D:/cursorObject/Boss Cli"
npm init -y
```

**Step 2: 配置 package.json**

修改 `package.json`，设置：
- `"name": "boss-agent"`
- `"type": "module"`
- `"bin": { "boss-agent": "./dist/index.js" }`
- scripts（双运行时）:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "dev:bun": "bun run --watch src/index.ts",
    "build": "tsup",
    "build:bun": "bun build src/index.ts --outdir dist --target bun",
    "start": "node dist/index.js",
    "start:bun": "bun dist/index.js",
    "test": "vitest run",
    "test:bun": "bun test",
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 3: 安装核心依赖**

```bash
# 核心依赖
npm install langchain @langchain/core @langchain/openai @langchain/anthropic better-sqlite3 zod chalk cli-table3 asciichart qrcode-terminal commander
npm install -D typescript tsx tsup @types/better-sqlite3 @types/node vitest
```

> **Bun 兼容说明：** 去掉了 `dotenv`（Bun 原生读 `.env`）。运行时通过 `process.versions.bun` 检测，SQLite 用条件导入。

**Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: 创建 tsup.config.ts**

```typescript
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  dts: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

**Step 6: 创建 src/index.ts 占位**

```typescript
console.log("boss-agent v0.1.0");
```

**Step 7: 创建配置模板**

`.env.example`:
```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

`boss-agent.json.example`:
```json
{
  "llm": { "provider": "openai", "model": "gpt-4o" },
  "search": { "defaultCity": "全国", "pageSize": 15 },
  "profile": { "skills": [] },
  "antiDetect": { "requestDelay": 1.0, "enableBurstPenalty": true, "maxRetries": 3 },
  "store": { "dbPath": "~/.boss-agent/data.db" }
}
```

`.gitignore`:
```
node_modules/
dist/
.env
boss-agent.json
bun.lockb
*.db
~/.boss-agent/
```

**Step 8: 验证双运行时**

```bash
# Node
npx tsx src/index.ts
# Bun
bun run src/index.ts
```

Both expected: `boss-agent v0.1.0`

**Step 9: 提交**

```bash
git init && git add -A && git commit -m "chore: 项目脚手架初始化"
```

---

## Task 2: 类型定义和常量

**Files:**
- Create: `src/client/types.ts`
- Create: `src/client/constants.ts`
- Test: `tests/client/constants.test.ts`

**Step 1: 写常量测试**

```typescript
// tests/client/constants.test.ts
import { describe, it, expect } from "vitest";
import { CITY_CODES, resolveCity, SEARCH_FILTER_OPTIONS, HEADERS, API_URLS } from "../../src/client/constants.js";

describe("resolveCity", () => {
  it("应返回城市编码", () => {
    expect(resolveCity("北京")).toBe("101010100");
    expect(resolveCity("上海")).toBe("101020100");
    expect(resolveCity("杭州")).toBe("101210100");
  });

  it("数字字符串应透传", () => {
    expect(resolveCity("101010100")).toBe("101010100");
  });

  it("未知城市应返回全国", () => {
    expect(resolveCity("火星")).toBe(CITY_CODES["全国"]);
  });
});
```

**Step 2: 实现类型定义**

`src/client/types.ts` — 定义 Job、SearchParams、SearchResult、JobDetail、UserProfile 等核心接口。参考 boss-cli 的 API 响应结构。

**Step 3: 实现常量**

`src/client/constants.ts` — 包含：
- `BASE_URL = "https://www.zhipin.com"`
- `API_URLS` — 各 API 端点路径
- `HEADERS` — Chrome 145 浏览器指纹
- `CITY_CODES` — 40+ 城市名到编码映射
- `resolveCity()` — 城市名解析
- `SEARCH_FILTER_OPTIONS` — 筛选项合法值

**Step 4: 运行测试**

```bash
npx vitest run tests/client/constants.test.ts
```

Expected: PASS

**Step 5: 提交**

```bash
git add -A && git commit -m "feat: 类型定义和常量（城市编码、API端点、浏览器指纹）"
```

---

## Task 3: 配置管理

**Files:**
- Create: `src/store/defaults.ts`
- Create: `src/store/config.ts`
- Test: `tests/store/config.test.ts`

**Step 1: 写配置加载测试**

```typescript
// tests/store/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, saveConfig } from "../../src/store/config.js";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";

const TEST_DIR = path.join(os.tmpdir(), "boss-agent-test-config");

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
});
```

**Step 2: 实现默认配置**

`src/store/defaults.ts` — AppConfig 接口和 DEFAULT_CONFIG 对象。

**Step 3: 实现配置加载**

`src/store/config.ts` — loadConfig（多层覆盖 + 环境变量）、saveConfig、deepMerge。

**Step 4: 运行测试**

```bash
npx vitest run tests/store/config.test.ts
```

Expected: PASS

**Step 5: 提交**

```bash
git add -A && git commit -m "feat: 配置管理（多层覆盖、环境变量、默认值）"
```

---

## Task 4: 工具函数

**Files:**
- Create: `src/utils/delay.ts`
- Create: `src/utils/format.ts`
- Test: `tests/utils/delay.test.ts`
- Test: `tests/utils/format.test.ts`

**Step 1: 写延迟工具测试**

```typescript
// tests/utils/delay.test.ts
import { describe, it, expect } from "vitest";
import { gaussianRandom, sleep, calculateBurstPenalty } from "../../src/utils/delay.js";

describe("gaussianRandom", () => {
  it("应在合理范围内", () => {
    for (let i = 0; i < 100; i++) {
      const val = gaussianRandom(1.0, 0.3);
      expect(val).toBeGreaterThan(-0.5);
      expect(val).toBeLessThan(2.5);
    }
  });
});

describe("calculateBurstPenalty", () => {
  it("无请求时返回0", () => {
    expect(calculateBurstPenalty([])).toBe(0);
  });

  it("15s内3次请求应有惩罚", () => {
    const now = Date.now();
    const recent = [now - 5000, now - 3000, now - 1000];
    const penalty = calculateBurstPenalty(recent);
    expect(penalty).toBeGreaterThan(0);
  });
});
```

**Step 2: 实现 delay.ts**

高斯随机延迟、burst 惩罚、sleep 工具函数。

**Step 3: 写格式化工具测试**

```typescript
// tests/utils/format.test.ts
import { describe, it, expect } from "vitest";
import { parseSalaryRange, formatJobRow, truncate } from "../../src/utils/format.js";

describe("parseSalaryRange", () => {
  it("应解析 K 范围", () => {
    expect(parseSalaryRange("20-30K")).toEqual({ min: 20000, max: 30000 });
    expect(parseSalaryRange("5-10K")).toEqual({ min: 5000, max: 10000 });
  });

  it("应解析 'XX以上'", () => {
    expect(parseSalaryRange("50K以上")).toEqual({ min: 50000, max: Infinity });
  });
});
```

**Step 4: 实现 format.ts**

薪资解析、表格行格式化、字符串截断。

**Step 5: 运行测试**

```bash
npx vitest run tests/utils/
```

Expected: PASS

**Step 6: 提交**

```bash
git add -A && git commit -m "feat: 工具函数（高斯延迟、薪资解析、格式化）"
```

---

## Task 5: BossClient API 客户端

**Files:**
- Create: `src/client/boss-client.ts`
- Test: `tests/client/boss-client.test.ts`

**Step 1: 写客户端测试**

使用 nock 或 mock HTTP 拦截，测试：
- 搜索请求参数正确构造
- 响应 JSON 正确解析
- 限流延迟生效
- 重试逻辑（429/5xx）
- code=37 抛出 SessionExpiredError
- code=9 触发退避

**Step 2: 实现 BossClient**

核心方法：
- `constructor(credential, config)` — 初始化 HTTP 客户端
- `searchJobs(params)` — 职位搜索
- `getJobDetail(securityId)` — 职位详情
- `getRecommendJobs(page)` — 个性化推荐
- `getUserInfo()` — 用户信息
- `getDeliverList(page)` — 已投递
- `getJobHistory(page)` — 浏览历史

反检测内置：
- 高斯随机延迟
- 5% 长停顿
- 突发惩罚
- 限流指数退避
- Cookie 自动回写
- 浏览器指纹 Headers

**Step 3: 运行测试**

```bash
npx vitest run tests/client/boss-client.test.ts
```

**Step 4: 提交**

```bash
git add -A && git commit -m "feat: BossClient API 客户端（反检测、限流、重试）"
```

---

## Task 6: 认证系统

**Files:**
- Create: `src/client/auth.ts`
- Test: `tests/client/auth.test.ts`

**Step 1: 写认证测试**

测试 Credential 类：
- isValid / hasRequiredCookies
- toDict / fromDict 序列化

测试 save/load/clear：
- 保存后能加载
- 无文件返回 null
- 清除后文件不存在

**Step 2: 实现认证模块**

- `Credential` 类
- `saveCredential()` / `loadCredential()` / `clearCredential()`
- `getCredential()` — 三级 fallback
- QR 码扫码登录（异步流程，终端渲染）

**Step 3: 运行测试**

```bash
npx vitest run tests/client/auth.test.ts
```

**Step 4: 提交**

```bash
git add -A && git commit -m "feat: 认证系统（Cookie 存储、QR 扫码、三级 fallback）"
```

---

## Task 7: Store 持久化层（双运行时 SQLite）

**Files:**
- Create: `src/store/db.ts`
- Create: `src/store/sqlite-adapter.ts`
- Test: `tests/store/db.test.ts`

**Bun 兼容关键点：** SQLite 需要条件导入。Node 用 `better-sqlite3`，Bun 用内置 `bun:sqlite`。通过适配器模式统一接口。

**Step 1: 实现 SQLite 适配器**

```typescript
// src/store/sqlite-adapter.ts
// 统一 SQLite 接口，运行时自动选择实现

export interface SqliteConnection {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close(): void;
}

export interface SqliteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  get<T = unknown>(...params: unknown[]): T | undefined;
  all<T = unknown>(...params: unknown[]): T[];
}

const isBun = typeof (globalThis as any).Bun !== "undefined";

export function openDb(dbPath: string): SqliteConnection {
  if (isBun) {
    // Bun 运行时：使用 bun:sqlite
    const { Database } = require("bun:sqlite") as any;
    return new BunSqliteAdapter(new Database(dbPath));
  }
  // Node 运行时：使用 better-sqlite3
  const BetterSqlite3 = require("better-sqlite3") as any;
  return new NodeSqliteAdapter(new BetterSqlite3(dbPath));
}

class NodeSqliteAdapter implements SqliteConnection {
  constructor(private db: any) {}
  prepare(sql: string) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: unknown[]) => stmt.run(...params),
      get: <T = unknown>(...params: unknown[]): T | undefined => stmt.get(...params) as T,
      all: <T = unknown>(...params: unknown[]): T[] => stmt.all(...params) as T[],
    };
  }
  exec(sql: string) { this.db.exec(sql); }
  close() { this.db.close(); }
}

class BunSqliteAdapter implements SqliteConnection {
  constructor(private db: any) {}
  prepare(sql: string) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: unknown[]) => stmt.run(...params),
      get: <T = unknown>(...params: unknown[]): T | undefined => stmt.get(...params) as T,
      all: <T = unknown>(...params: unknown[]): T[] => stmt.all(...params) as T[],
    };
  }
  exec(sql: string) { this.db.exec(sql); }
  close() { this.db.close(); }
}
```

**Step 2: 写数据库测试**

```typescript
// tests/store/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../../src/store/db.js";
import { rmSync } from "fs";
import path from "path";
import os from "os";

const DB_PATH = path.join(os.tmpdir(), "boss-agent-test.db");

describe("Database", () => {
  let db: Database;

  beforeEach(() => { db = new Database(DB_PATH); });
  afterEach(() => { db.close(); rmSync(DB_PATH, { force: true }); });

  it("应保存和查询搜索历史", () => {
    db.saveSearchHistory({ keyword: "Java", city: "杭州", filters: "{}", resultCount: 35 });
    const history = db.getSearchHistory();
    expect(history).toHaveLength(1);
    expect(history[0].keyword).toBe("Java");
  });

  it("应保存和查询会话消息", () => {
    db.saveMessage("session-1", "user", "找Java岗位");
    db.saveMessage("session-1", "assistant", "找到35个");
    const msgs = db.getMessages("session-1");
    expect(msgs).toHaveLength(2);
  });
});
```

**Step 3: 实现 Database 类**

使用 `openDb()` 适配器。SQLite 表创建、CRUD 操作：搜索历史、会话消息、用户画像。

```typescript
// src/store/db.ts
import { openDb, type SqliteConnection } from "./sqlite-adapter.js";

export class Database {
  private db: SqliteConnection;

  constructor(dbPath: string) {
    this.db = openDb(dbPath);
    this.initTables();
  }
  // ...
}
```

**Step 4: 运行测试（双运行时）**

```bash
# Node
npx vitest run tests/store/db.test.ts
# Bun
bun test tests/store/db.test.ts
```

**Step 4: 提交**

```bash
git add -A && git commit -m "feat: SQLite 持久化（搜索历史、会话消息）"
```

---

## Task 8: 业务服务层

**Files:**
- Create: `src/services/search-service.ts`
- Create: `src/services/analyze-service.ts`
- Create: `src/services/match-service.ts`
- Create: `src/services/export-service.ts`
- Test: `tests/services/analyze-service.test.ts`
- Test: `tests/services/match-service.test.ts`
- Test: `tests/services/export-service.test.ts`

**Step 1: 写分析服务测试**

```typescript
// tests/services/analyze-service.test.ts
import { describe, it, expect } from "vitest";
import { AnalyzeService } from "../../src/services/analyze-service.js";

const mockJobs = [
  { salaryDesc: "20-30K", skills: ["Java", "Spring"] },
  { salaryDesc: "30-50K", skills: ["Java", "Redis", "Go"] },
  { salaryDesc: "25-40K", skills: ["Java", "Spring", "MySQL"] },
];

describe("AnalyzeService", () => {
  const service = new AnalyzeService();

  it("应计算薪资统计", () => {
    const result = service.analyzeSalary(mockJobs as any);
    expect(result.average).toBeGreaterThan(0);
    expect(result.median).toBeGreaterThan(0);
    expect(result.distribution).toBeDefined();
  });

  it("应统计技能需求", () => {
    const result = service.analyzeSkills(mockJobs as any);
    expect(result[0].name).toBe("Java");
    expect(result[0].count).toBe(3);
  });
});
```

**Step 2: 实现各 Service**

- `SearchService` — 封装 BossClient 调用，处理分页、结果缓存
- `AnalyzeService` — 薪资统计（均值/中位数/分布）、技能词频
- `MatchService` — 技能交集匹配度评分
- `ExportService` — CSV/JSON 文件写入

**Step 3: 运行测试**

```bash
npx vitest run tests/services/
```

**Step 4: 提交**

```bash
git add -A && git commit -m "feat: 业务服务层（搜索、分析、匹配、导出）"
```

---

## Task 9: 命令路由器

**Files:**
- Create: `src/commands/router.ts`
- Test: `tests/commands/router.test.ts`

**Step 1: 写路由器测试**

```typescript
// tests/commands/router.test.ts
import { describe, it, expect } from "vitest";
import { parseCommand } from "../../src/commands/router.js";

describe("parseCommand", () => {
  it("应解析简单命令", () => {
    const cmd = parseCommand("/status");
    expect(cmd.name).toBe("status");
    expect(cmd.args).toEqual([]);
    expect(cmd.flags).toEqual({});
  });

  it("应解析带参数和标志的命令", () => {
    const cmd = parseCommand('/search Java --city 杭州 --salary 20-30K --json');
    expect(cmd.name).toBe("search");
    expect(cmd.args).toEqual(["Java"]);
    expect(cmd.flags.city).toBe("杭州");
    expect(cmd.flags.salary).toBe("20-30K");
    expect(cmd.flags.json).toBe(true);
  });

  it("应解析 /config set 子命令", () => {
    const cmd = parseCommand("/config set llm.provider claude");
    expect(cmd.name).toBe("config");
    expect(cmd.args).toEqual(["set", "llm.provider", "claude"]);
  });
});
```

**Step 2: 实现路由器**

`parseCommand(input: string)` — 拆分 `/command arg1 arg2 --flag1 value1 --flag2`

命令注册表 `COMMANDS` — 命令名 → handler 映射。

**Step 3: 运行测试**

```bash
npx vitest run tests/commands/router.test.ts
```

**Step 4: 提交**

```bash
git add -A && git commit -m "feat: 命令路由器（解析、注册、分发）"
```

---

## Task 10: SharedContext 和输出渲染

**Files:**
- Create: `src/repl/context.ts`
- Create: `src/repl/renderer.ts`
- Test: `tests/repl/context.test.ts`

**Step 1: 写上下文测试**

```typescript
// tests/repl/context.test.ts
import { describe, it, expect } from "vitest";
import { SharedContext } from "../../src/repl/context.js";

describe("SharedContext", () => {
  it("应存储和获取搜索结果", () => {
    const ctx = new SharedContext();
    const jobs = [{ jobName: "Java开发", salaryDesc: "20-30K" }];
    ctx.setCurrentJobs(jobs as any);
    expect(ctx.getCurrentJobs()).toHaveLength(1);
  });

  it("应支持通过编号获取", () => {
    const ctx = new SharedContext();
    ctx.setCurrentJobs([{ jobName: "A" }, { jobName: "B" }] as any);
    expect(ctx.getJobByIndex(1)?.jobName).toBe("A");
    expect(ctx.getJobByIndex(3)).toBeUndefined();
  });
});
```

**Step 2: 实现 SharedContext**

内存存储：currentJobs、analysisResults、userProfile。提供 getCurrentJobs / getJobByIndex / setCurrentJobs。

**Step 3: 实现 Renderer**

- `renderJobTable(jobs)` — cli-table3 渲染职位列表
- `renderAnalysis(analysis)` — 文字 + asciichart
- `renderJson(data)` — JSON envelope `{ok, schema_version, data}`
- `renderMarkdown(text)` — chalk 着色简单 Markdown

**Step 4: 运行测试**

```bash
npx vitest run tests/repl/
```

**Step 5: 提交**

```bash
git add -A && git commit -m "feat: SharedContext 和输出渲染器"
```

---

## Task 11: LLM 多模型工厂

**Files:**
- Create: `src/llm/provider.ts`
- Test: `tests/llm/provider.test.ts`

**Step 1: 写工厂测试**

```typescript
// tests/llm/provider.test.ts
import { describe, it, expect } from "vitest";
import { createChatModel } from "../../src/llm/provider.js";

describe("createChatModel", () => {
  it("应创建 OpenAI 模型", () => {
    const model = createChatModel({ provider: "openai", model: "gpt-4o", apiKey: "test" });
    expect(model).toBeDefined();
  });

  it("应创建 Claude 模型", () => {
    const model = createChatModel({ provider: "claude", model: "claude-sonnet-4-20250514", apiKey: "test" });
    expect(model).toBeDefined();
  });

  it("应创建 Ollama 模型（OpenAI 兼容）", () => {
    const model = createChatModel({ provider: "ollama", model: "qwen2.5", baseUrl: "http://localhost:11434/v1" });
    expect(model).toBeDefined();
  });

  it("不支持的 provider 应抛错", () => {
    expect(() => createChatModel({ provider: "unknown" as any, model: "" })).toThrow();
  });
});
```

**Step 2: 实现 provider.ts**

LangChain ChatOpenAI / ChatAnthropic 工厂函数。

**Step 3: 运行测试**

```bash
npx vitest run tests/llm/provider.test.ts
```

**Step 4: 提交**

```bash
git add -A && git commit -m "feat: LLM 多模型工厂（OpenAI/Claude/Ollama）"
```

---

## Task 12: LangChain Agent

**Files:**
- Create: `src/agent/prompt.ts`
- Create: `src/agent/tools.ts`
- Create: `src/agent/agent.ts`
- Create: `src/agent/memory.ts`

**Step 1: 实现 System Prompt**

`src/agent/prompt.ts` — 求职助手行为规范、输出格式约束。

**Step 2: 定义 LangChain Tools**

`src/agent/tools.ts` — 用 DynamicStructuredTool + zod 定义：
- search_jobs
- get_job_detail
- get_recommendations
- analyze_salary
- analyze_skills
- match_jobs

每个 tool 的 func 调用对应的 Service 方法。

**Step 3: 实现会话记忆**

`src/agent/memory.ts` — ConversationSummaryMemory 包装，支持 SQLite 持久化。

**Step 4: 创建 Agent**

`src/agent/agent.ts` — 组装 LLM + Tools + Memory + Prompt，导出 `createAgent()` 和 `agentCall()` 函数。

**Step 5: 提交**

```bash
git add -A && git commit -m "feat: LangChain Agent（Tools、Prompt、Memory）"
```

---

## Task 13: REPL 主循环

**Files:**
- Create: `src/repl/repl.ts`
- Modify: `src/index.ts`

**Step 1: 实现 REPL 主循环**

`src/repl/repl.ts`:

```typescript
export async function startRepl() {
  // 1. 加载配置
  const config = loadConfig();
  // 2. 初始化数据库
  const db = new Database(config.store.dbPath);
  // 3. 初始化 SharedContext
  const context = new SharedContext();
  // 4. 创建 BossClient（如已认证）
  const credential = getCredential();
  const bossClient = new BossClient(credential, config.antiDetect);
  // 5. 初始化 Services
  const services = createServices(bossClient, context);
  // 6. 创建 Agent（如 LLM 可用）
  const agent = await createAgent(config, services, context);
  // 7. 进入 REPL 循环
  const rl = readline.createInterface({ input, output });
  printBanner();

  while (true) {
    const input = await rl.question("> ");
    if (isExit(input)) break;
    if (input.startsWith("/")) {
      await handleCommand(input, services, context);
    } else {
      await handleNaturalLanguage(input, agent, context);
    }
  }
}
```

**Step 2: 更新入口**

`src/index.ts` → 调用 `startRepl()`。

**Step 3: 手动验证**

```bash
npx tsx src/index.ts
```

Expected: 显示 banner，进入 `>` 提示符，`/help` 显示帮助，`exit` 退出。

**Step 4: 提交**

```bash
git add -A && git commit -m "feat: REPL 主循环（统一入口、命令分发）"
```

---

## Task 14: 集成测试

**Files:**
- Create: `tests/integration/repl.test.ts`

**Step 1: 写集成测试**

模拟完整流程：
1. `/login` → 认证
2. `/search Java --city 杭州` → 搜索
3. `/show 1` → 查看详情
4. "分析下薪资" → Agent 调用分析工具
5. `/export -o test.csv` → 导出

使用 mock HTTP 和 mock LLM。

**Step 2: 运行测试**

```bash
npx vitest run tests/integration/
```

**Step 3: 提交**

```bash
git add -A && git commit -m "test: 集成测试（完整 REPL 流程）"
```

---

## 任务依赖关系

```
Task 1 (脚手架)
  └→ Task 2 (类型+常量)
       └→ Task 3 (配置管理)
       └→ Task 4 (工具函数)
            └→ Task 5 (BossClient) ──→ Task 6 (认证)
            │                              └→ Task 7 (Store)
            │                                   └→ Task 8 (Services)
            │                                        └→ Task 9 (命令路由)
            └→ Task 10 (Context+渲染)
            └→ Task 11 (LLM工厂)
                 └→ Task 12 (Agent)
                      └→ Task 13 (REPL)
                           └→ Task 14 (集成测试)
```

**可并行的任务**：
- Task 3 + Task 4（配置 和 工具函数 互不依赖）
- Task 6 + Task 7（认证 和 Store 互不依赖）
- Task 9 + Task 10 + Task 11（路由、渲染、LLM工厂 互不依赖）

**建议执行顺序**：1 → 2 → (3|4) → 5 → (6|7) → 8 → (9|10|11) → 12 → 13 → 14

---

## 附录：Bun 兼容性指南

### 双运行时策略

项目同时支持 **Node.js 22+** 和 **Bun 1.x**，代码无需任何修改即可在两个运行时运行。

### 关键兼容点

| 模块 | Node.js | Bun | 适配方式 |
|------|---------|-----|---------|
| SQLite | `better-sqlite3` | `bun:sqlite`（内置） | `sqlite-adapter.ts` 条件导入 |
| .env | `dotenv`（需安装） | 原生支持 | 去掉 dotenv，用 `process.env` 统一 |
| TS 执行 | `tsx` | 原生支持 | `dev` 脚本用 tsx，`dev:bun` 用 bun |
| 测试 | `vitest` | `bun test` | 测试文件兼容两者 |
| 构建 | `tsup` | `bun build` | 分别提供 build 和 build:bun |
| 包管理 | `npm` | `bun install` | 生成 `bun.lockb` 和 `package-lock.json` |

### 条件导入模式

```typescript
// 检测运行时
const isBun = "Bun" in globalThis;

// SQLite 适配
if (isBun) {
  const { Database } = require("bun:sqlite");
} else {
  const Database = require("better-sqlite3");
}
```

### 运行命令对照

| 操作 | Node.js | Bun |
|------|---------|-----|
| 开发 | `npm run dev` | `bun run dev:bun` |
| 构建 | `npm run build` | `bun run build:bun` |
| 运行 | `npm run start` | `bun run start:bun` |
| 测试 | `npm test` | `bun run test:bun` |
| 直接运行 | `npx tsx src/index.ts` | `bun src/index.ts` |
| 安装依赖 | `npm install` | `bun install`（更快） |

### 注意事项

1. **不要用 `fs/promises` 的 Bun 特有 API** — 保持用标准 `fs` 模块
2. **`better-sqlite3` 在 Bun 下也可用** — 但 `bun:sqlite` 性能更好，优先使用
3. **测试框架** — vitest 和 bun test 语法几乎一致，写测试时避免用任何一方的专有 API
4. **路径处理** — 统一用 `path.join()`，不用 `import.meta.dir`（Bun 专有）

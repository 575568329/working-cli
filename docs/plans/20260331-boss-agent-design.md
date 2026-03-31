# Boss Agent — 设计文档

> 创建日期：2026-03-31
> 状态：待确认

---

## 一、项目概述

### 1.1 定位

一个基于终端的 Boss 直聘求职助手，通过自然语言对话 + 斜杠命令的方式，帮助个人求职者搜索职位、分析市场数据、智能匹配岗位。

### 1.2 核心价值

- **自然语言交互**：用日常语言描述需求，Agent 自动理解并执行
- **斜杠命令直调**：精确操作时用 `/command` 直接执行，结果共享上下文
- **智能分析**：基于 LLM 的薪资分析、技能匹配、岗位推荐
- **多模型支持**：OpenAI / Claude / Ollama，用户自行配置

### 1.3 使用场景

- 求职者搜索目标城市/岗位的招聘信息
- 分析某个岗位/城市/行业的薪资水平和技能要求
- 根据自身技能和经验匹配最合适的岗位
- 导出搜索结果用于对比分析

---

## 二、交互设计

### 2.1 统一 REPL 交互

一个入口，两种输入方式共享对话上下文：

```
$ boss-agent

Boss Agent v0.1.0 — Boss直聘求职助手
输入自然语言对话，/ 开头执行命令，/help 查看帮助，exit 退出

> 帮我找杭州的Java岗位，薪资20K以上
🔍 正在搜索...
  #  职位名称              公司          薪资      规模
  1  高级Java开发工程师    阿里巴巴      30-50K    10000人+
  2  Java后端开发          网易          25-40K    10000人+
  ...

> 这些岗位薪资怎么样
📊 正在分析...
  平均: 32.5K | 中位数: 28K | 最高: 60K
  技能需求 Top3: Spring Boot(78%) MySQL(65%) Redis(58%)

> /search Python --city 上海 --salary 30-50K --json
{"ok":true,"data":{"jobList":[...],"totalCount":42}}

> 帮我和上面杭州的Java岗位合并对比
📊 杭州Java vs 上海Python 对比：
  ...

> /export --format csv -o jobs.csv
✅ 已导出 77 条记录到 jobs.csv

> /status
✅ 已登录 (用户: 张三)
  模型: gpt-4o | Cookie 有效期: 5天

> exit
```

### 2.2 斜杠命令列表

| 命令 | 说明 | 示例 |
|------|------|------|
| `/search` | 搜索职位 | `/search Java --city 杭州 --salary 20-30K` |
| `/recommend` | 个性化推荐 | `/recommend -p 2` |
| `/detail` | 职位详情 | `/detail <securityId>` |
| `/show` | 按编号查看 | `/show 3` |
| `/analyze` | 分析当前结果 | `/analyze --dimension salary` |
| `/match` | 匹配评分 | `/match --skills "Spring,Redis,MySQL"` |
| `/export` | 导出数据 | `/export -o jobs.csv --format csv` |
| `/history` | 浏览历史 | `/history` |
| `/applied` | 已投递 | `/applied` |
| `/me` | 个人信息 | `/me` |
| `/cities` | 城市列表 | `/cities` |
| `/login` | 登录认证 | `/login --cookie-source chrome` |
| `/logout` | 退出登录 | `/logout` |
| `/status` | 状态检查 | `/status` |
| `/model` | 切换模型 | `/model claude` |
| `/config` | 配置管理 | `/config set default_city 杭州` |
| `/help` | 帮助 | `/help` |
| `/clear` | 清空上下文 | `/clear` |

### 2.3 搜索筛选参数

| 筛选项 | 参数 | 可选值 |
|--------|------|--------|
| 城市 | `--city` | 40+城市，`/cities` 查看全部 |
| 薪资 | `--salary` | 3K以下/3-5K/5-10K/10-15K/15-20K/20-30K/30-50K/50K以上 |
| 经验 | `--exp` | 不限/在校应届/1年以内/1-3年/3-5年/5-10年/10年以上 |
| 学历 | `--degree` | 不限/大专/本科/硕士/博士 |
| 行业 | `--industry` | 互联网/电子商务/游戏/人工智能/金融等 |
| 规模 | `--scale` | 0-20人/20-99人/100-499人/500-999人/1000-9999人/10000人以上 |
| 融资 | `--stage` | 未融资/天使轮/A轮/B轮/C轮/D轮及以上/已上市/不需要融资 |
| 职位类型 | `--job-type` | 全职/兼职/实习 |
| 分页 | `-p` | 页码 |
| 数量 | `-n` | 每页条数 |

---

## 三、系统架构

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                   REPL 交互层                        │
│  ┌───────────────────────────────────────────────┐  │
│  │  readline 输入 → 判断 /command 还是自然语言    │  │
│  │  输出渲染: Rich表格 / JSON / YAML / Markdown  │  │
│  └───────────────────┬───────────────────────────┘  │
│          ┌───────────┴───────────┐                  │
│          ▼                       ▼                  │
│  ┌──────────────┐    ┌─────────────────────────┐   │
│  │ Command      │    │ LangChain Agent         │   │
│  │ Router       │    │ ChatOpenAI/Anthropic    │   │
│  │ 解析/执行    │    │ ConversationMemory      │   │
│  │ 斜杠命令     │    │ DynamicStructuredTool   │   │
│  └──────┬───────┘    └──────────┬──────────────┘   │
│         │                       │                   │
│         └───────────┬───────────┘                   │
│                     ▼                               │
│  ┌──────────────────────────────────────────────┐  │
│  │            SharedContext (共享上下文)          │  │
│  │  存储当前搜索结果、分析数据、用户偏好         │  │
│  └──────────────────────┬───────────────────────┘  │
│                         ▼                           │
│  ┌──────────────────────────────────────────────┐  │
│  │              Services (业务服务层)             │  │
│  │  SearchService / AnalyzeService /             │  │
│  │  MatchService / ExportService                 │  │
│  └──────────────────────┬───────────────────────┘  │
│                         ▼                           │
│  ┌──────────────────────────────────────────────┐  │
│  │         BossClient (API 客户端层)             │  │
│  │  HTTP请求 / 反检测 / 限流 / 重试 / Cookie     │  │
│  └──────────────────────┬───────────────────────┘  │
│                         ▼                           │
│  ┌──────────────────────────────────────────────┐  │
│  │     LLM Provider (多模型适配层)               │  │
│  │  OpenAI / Claude / Ollama (统一接口)          │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │     Store (持久化层)                          │  │
│  │  SQLite: 搜索历史 / 会话记忆 / 用户配置      │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 3.2 核心流程

#### 自然语言处理流程

```
用户输入: "帮我找杭州20K以上的Java岗"
    │
    ▼
LangChain Agent 接收
    │
    ▼
LLM 理解意图 → 决定调用 search_jobs 工具
    │
    ▼
DynamicStructuredTool 执行
    │ → SearchService.search({ keyword: "Java", city: "杭州", salary: "20K以上" })
    │ → BossClient.searchJobs(...)
    │ → 返回职位列表 JSON
    │
    ▼
结果返回 LLM → LLM 生成人类可读的表格/摘要
    │
    ▼
写入 SharedContext → 渲染输出
```

#### 斜杠命令处理流程

```
用户输入: "/search Java --city 杭州 --salary 20-30K"
    │
    ▼
CommandRouter 解析命令名和参数
    │
    ▼
直接调用 SearchService.search(...)
    │ → BossClient.searchJobs(...)
    │
    ▼
结果写入 SharedContext → 渲染输出
```

---

## 四、模块详细设计

### 4.1 REPL 交互层

**职责**：统一入口，分发输入，渲染输出。

```typescript
interface ReplInput {
  raw: string;                              // 原始输入
  type: "command" | "natural_language";     // 输入类型
  command?: ParsedCommand;                  // 解析后的命令
}

interface SharedContext {
  currentJobs: Job[];                       // 当前搜索结果
  analysisResults: AnalysisResult[];        // 分析结果
  userProfile: UserProfile;                 // 用户画像（技能/期望）
  conversationHistory: Message[];           // 对话历史
}
```

**输入判断逻辑**：
- 以 `/` 开头 → CommandRouter 处理
- `exit` / `quit` → 退出
- 其他 → LangChain Agent 处理

**输出渲染策略**：
- 终端交互：Rich 表格 + asciichart 图表 + chalk 着色
- `--json` 参数：结构化 JSON envelope `{ok, schema_version, data}`
- `--yaml` 参数：YAML 格式
- Agent 回复：Markdown 渲染

### 4.2 Command Router

**职责**：解析斜杠命令，路由到对应 Service，支持 `--json`/`--yaml` 切换输出格式。

```typescript
interface ParsedCommand {
  name: string;           // search / export / analyze ...
  args: string[];         // 位置参数
  flags: Record<string, string | boolean>;  // --city 杭州 --json
}

// 命令注册表
const COMMANDS: Record<string, CommandDef> = {
  search:   { handler: searchService.search,   description: "搜索职位" },
  recommend:{ handler: searchService.recommend, description: "个性化推荐" },
  detail:   { handler: searchService.detail,    description: "职位详情" },
  show:     { handler: searchService.show,      description: "按编号查看" },
  analyze:  { handler: analyzeService.analyze,  description: "数据分析" },
  match:    { handler: matchService.match,      description: "智能匹配" },
  export:   { handler: exportService.export,    description: "导出数据" },
  login:    { handler: authService.login,       description: "登录" },
  logout:   { handler: authService.logout,      description: "退出登录" },
  status:   { handler: authService.status,      description: "状态检查" },
  me:       { handler: personalService.me,      description: "个人信息" },
  config:   { handler: configService.manage,    description: "配置管理" },
  model:    { handler: llmProvider.switch,      description: "切换模型" },
  help:     { handler: helpService.show,        description: "帮助" },
};
```

### 4.3 LangChain Agent

**职责**：理解自然语言意图，调用工具，生成回答。

**工具定义**：

| 工具名 | 说明 | 输入 | 输出 |
|--------|------|------|------|
| `search_jobs` | 搜索职位 | keyword, city, salary, exp, degree... | 职位列表 JSON |
| `get_job_detail` | 获取详情 | securityId | 职位详情 JSON |
| `get_recommendations` | 个性化推荐 | page | 推荐职位列表 |
| `analyze_salary` | 薪资分析 | 职位列表 | 统计数据（均值/中位数/分布） |
| `analyze_skills` | 技能需求分析 | 职位列表 | 技能词频排名 |
| `match_jobs` | 岗位匹配 | 用户技能, 职位列表 | 匹配度评分 + 推荐理由 |
| `get_profile` | 获取用户信息 | — | 用户资料 JSON |
| `get_applied` | 已投递列表 | page | 投递记录 |

**System Prompt 设计**：

```
你是 Boss Agent，一个专业的求职助手。你的职责是帮助用户在 Boss 直聘上
搜索职位、分析招聘市场数据、匹配合适的岗位。

核心行为规范：
1. 搜索时默认展示前 15 条结果，用表格展示：职位名称、公司、薪资、规模
2. 当用户说"分析"时，自动基于上下文中的搜索结果进行统计
3. 当用户提到自己的技能/经验时，记录到用户画像中
4. 推荐岗位时给出匹配度评分和理由
5. 不要编造数据，所有分析必须基于实际搜索结果
6. 如果用户未登录，提示执行 /login

输出格式：
- 搜索结果用表格展示
- 数据分析用文字描述 + 简单图表（asciichart）
- 匹配推荐用编号列表 + 匹配度百分比
```

**对话记忆策略**：
- 使用 `ConversationSummaryMemory`，长对话自动摘要
- `SharedContext` 存储结构化数据（搜索结果、用户画像），不走 LLM 摘要
- 会话持久化到 SQLite，下次启动可恢复

### 4.4 BossClient (API 客户端)

**职责**：封装 Boss 直聘 Web API，处理反检测。

**API 端点**（参考 boss-cli 逆向分析）：

| 端点 | 用途 |
|------|------|
| `/wapi/zpgeek/search/joblist.json` | 职位搜索 |
| `/wapi/zpgeek/job/detail.json` | 职位详情 |
| `/wapi/zprelation/interaction/geekGetJob` | 个性化推荐 |
| `/wapi/zpuser/wap/getUserInfo.json` | 用户信息 |
| `/wapi/zpgeek/resume/baseinfo.json` | 简历信息 |
| `/wapi/zpgeek/deliver/list.json` | 已投递 |
| `/wapi/zpgeek/history/browse.json` | 浏览历史 |
| `/wapi/zpgeek/friend/list.json` | 沟通列表 |

**反检测策略**（参考 boss-cli 实现）：

```typescript
class BossClient {
  // 高斯随机延迟
  private gaussianDelay(): number {
    const jitter = Math.max(0, gaussianRandom(0.3, 0.15));
    // 5% 概率长停顿，模拟阅读
    if (Math.random() < 0.05) return jitter + uniformRandom(2.0, 5.0);
    return jitter;
  }

  // 突发惩罚：15s内≥3次请求 → 额外延迟1.2-2.8s
  private burstPenalty(): number;

  // 限流自动退避：code=9 → 10s→20s→40s→60s
  private rateLimitBackoff(count: number): number;

  // 浏览器指纹
  private get headers(): Record<string, string> {
    return {
      "User-Agent": "Mozilla/5.0 ... Chrome/145.0.0.0 ...",
      "sec-ch-ua": '"Chromium";v="145", ...',
      "Referer": "https://www.zhipin.com/web/geek/job",
      // ...
    };
  }
}
```

**认证策略**（三级 fallback）：
1. 本地存储：`~/.boss-agent/credential.json`
2. 浏览器提取：从 Chrome/Edge/Firefox 等提取 Cookie
3. QR 扫码：终端渲染二维码

### 4.5 Services (业务服务层)

**SearchService**：
```typescript
class SearchService {
  async search(params: SearchParams): Promise<SearchResult>;
  async recommend(page: number): Promise<SearchResult>;
  async detail(securityId: string): Promise<JobDetail>;
  async show(index: number): Promise<JobDetail>;  // 从 SharedContext 取
}
```

**AnalyzeService**：
```typescript
class AnalyzeService {
  // 薪资分析：均值、中位数、分位数、分布直方图
  async analyzeSalary(jobs: Job[]): Promise<SalaryAnalysis>;

  // 技能需求：词频统计、关联分析
  async analyzeSkills(jobs: Job[]): Promise<SkillAnalysis>;

  // 城市对比：多城市同岗位对比
  async compareCities(keyword: string, cities: string[]): Promise<ComparisonResult>;

  // 公司分析：规模分布、融资阶段分布
  async analyzeCompanies(jobs: Job[]): Promise<CompanyAnalysis>;
}
```

**MatchService**：
```typescript
class MatchService {
  // 基于技能的匹配度评分
  async matchBySkills(userSkills: string[], jobs: Job[]): Promise<MatchResult[]>;

  // 基于完整用户画像的匹配
  async matchByProfile(profile: UserProfile, jobs: Job[]): Promise<MatchResult[]>;
}
```

**ExportService**：
```typescript
class ExportService {
  async exportCSV(jobs: Job[], filePath: string): Promise<void>;
  async exportJSON(jobs: Job[], filePath: string): Promise<void>;
}
```

### 4.6 LLM Provider

**职责**：统一接口适配多种 LLM 后端。

```typescript
interface LLMConfig {
  provider: "openai" | "claude" | "ollama";
  model: string;
  apiKey?: string;
  baseUrl?: string;   // Ollama: http://localhost:11434/v1
}

// LangChain 多模型工厂
function createChatModel(config: LLMConfig) {
  switch (config.provider) {
    case "openai":
      return new ChatOpenAI({ modelName: config.model, openAIApiKey: config.apiKey });
    case "claude":
      return new ChatAnthropic({ modelName: config.model, anthropicApiKey: config.apiKey });
    case "ollama":
      return new ChatOpenAI({
        modelName: config.model,
        configuration: { baseURL: config.baseUrl || "http://localhost:11434/v1" },
      });
  }
}
```

**模型默认配置**：

| Provider | 默认模型 | 适用场景 |
|----------|---------|---------|
| OpenAI | gpt-4o | 综合能力最强 |
| Claude | claude-sonnet-4-20250514 | 长文本分析 |
| Ollama | qwen2.5 | 隐私优先、离线使用 |

### 4.7 配置管理

**设计原则**：敏感信息与普通配置分离；多层覆盖。

#### 配置层级（优先级从高到低）

```
环境变量 (.env)                          → 敏感信息：API Key
    ↓ 覆盖
用户全局配置 (~/.boss-agent/config.json)  → 个人偏好：模型、默认城市、求职画像
    ↓ 覆盖
项目级配置 (./boss-agent.json)            → 项目定制：API端点、限流参数
    ↓ 覆盖
代码默认值 (src/store/defaults.ts)        → 兜底默认值
```

#### 配置文件

**`~/.boss-agent/config.json`** — 用户全局配置：

```jsonc
{
  // LLM 模型配置（apiKey 从环境变量读取，不写在此文件中）
  "llm": {
    "provider": "openai",
    "model": "gpt-4o"
  },

  // 搜索默认值
  "search": {
    "defaultCity": "杭州",
    "defaultSalary": "20-30K",
    "pageSize": 15
  },

  // 求职画像（用于智能匹配）
  "profile": {
    "skills": ["Spring Boot", "MySQL", "Redis", "TypeScript"],
    "experience": "3-5年",
    "expectedSalary": "25-40K",
    "expectedCities": ["杭州", "上海"],
    "exclude": ["猎头", "外包"]
  },

  // 反检测参数（一般不需要改）
  "antiDetect": {
    "requestDelay": 1.0,
    "enableBurstPenalty": true,
    "maxRetries": 3
  },

  // 存储
  "store": {
    "dbPath": "~/.boss-agent/data.db"
  }
}
```

**`.env`** — 敏感信息：

```bash
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
# Ollama 不需要 Key
```

#### 配置加载逻辑

```typescript
// src/store/config.ts
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

interface AppConfig {
  llm: {
    provider: "openai" | "claude" | "ollama";
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  search: {
    defaultCity: string;
    defaultSalary?: string;
    pageSize: number;
  };
  profile: {
    skills: string[];
    experience?: string;
    expectedSalary?: string;
    expectedCities?: string[];
    exclude?: string[];
  };
  antiDetect: {
    requestDelay: number;
    enableBurstPenalty: boolean;
    maxRetries: number;
  };
  store: {
    dbPath: string;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  llm:         { provider: "openai", model: "gpt-4o" },
  search:      { defaultCity: "全国", pageSize: 15 },
  profile:     { skills: [] },
  antiDetect:  { requestDelay: 1.0, enableBurstPenalty: true, maxRetries: 3 },
  store:       { dbPath: path.join(homedir(), ".boss-agent/data.db") },
};

export function loadConfig(): AppConfig {
  let config = deepClone(DEFAULT_CONFIG);

  // 1. 用户全局配置
  const userConfig = path.join(homedir(), ".boss-agent/config.json");
  if (existsSync(userConfig)) {
    config = deepMerge(config, JSON.parse(readFileSync(userConfig, "utf-8")));
  }

  // 2. 项目级配置
  if (existsSync("boss-agent.json")) {
    config = deepMerge(config, JSON.parse(readFileSync("boss-agent.json", "utf-8")));
  }

  // 3. 环境变量覆盖 API Key（敏感信息不入文件）
  config.llm.apiKey =
    process.env.OPENAI_API_KEY ??
    process.env.ANTHROPIC_API_KEY;

  return config;
}
```

#### REPL 内管理配置

```bash
> /config list                      # 查看当前所有配置
> /config set llm.provider claude   # 切换模型
> /config set search.default_city 上海
> /config set profile.skills "Java,Go,Docker"
> /config reset                     # 恢复默认值
> /config path                      # 显示配置文件路径
```

#### 目录结构

```
~/.boss-agent/
├── config.json        # 用户全局配置
├── credential.json    # Cookie 认证（自动管理，不手改）
├── data.db            # SQLite 数据
└── conversations/     # 会话记录（可选）
```

### 4.8 Store (持久化层)

**SQLite 表结构**：

```sql
-- 搜索历史
CREATE TABLE search_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword      TEXT NOT NULL,
  city         TEXT,
  filters      TEXT,          -- JSON: 筛选条件快照
  result_count INTEGER,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话记忆
CREATE TABLE conversation (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT NOT NULL,   -- user / assistant / tool
  content    TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户画像（运行时覆盖 config.json 中的 profile）
CREATE TABLE user_profile (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL         -- JSON: skills, experience, expected_salary...
);
```

> **注意**：用户配置使用 JSON 文件存储，便于用户直接编辑。
> `/config set` 命令会同时更新内存和 JSON 文件。

---

## 五、技术选型

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 语言 | TypeScript | 5.x | 严格模式 |
| 运行时 | Node.js | 22+ | 原生 fetch、ESM |
| CLI | commander | 12.x | 命令定义和参数解析 |
| Agent | langchain | 0.3.x | Agent + Memory + Tools |
| LLM-OpenAI | @langchain/openai | - | GPT-4o 等 |
| LLM-Claude | @langchain/anthropic | - | Claude 系列 |
| HTTP | undici | 内置 | 高性能 HTTP 客户端 |
| 数据库 | better-sqlite3 | 11.x | 同步 API，轻量 |
| 参数校验 | zod | 3.x | Schema 定义和校验 |
| 环境变量 | dotenv | 16.x | .env 文件加载 |
| 终端渲染 | chalk + cli-table3 + asciichart | - | 表格、图表、着色 |
| 二维码 | qrcode-terminal | - | 终端 QR 渲染 |
| 构建 | tsup | 8.x | 轻量打包 |
| 开发 | tsx | 4.x | 直接运行 TS |

---

## 六、项目结构

```
boss-agent/
├── src/
│   ├── index.ts                  # 入口：启动 REPL
│   ├── repl/
│   │   ├── repl.ts               # REPL 主循环
│   │   ├── renderer.ts           # 输出渲染（表格/图表/JSON）
│   │   └── context.ts            # SharedContext 管理
│   ├── commands/
│   │   ├── router.ts             # 命令路由和解析
│   │   ├── search.ts             # /search /recommend /detail /show
│   │   ├── analyze.ts            # /analyze
│   │   ├── match.ts              # /match
│   │   ├── export.ts             # /export
│   │   ├── auth.ts               # /login /logout /status
│   │   ├── personal.ts           # /me /applied /history
│   │   └── config.ts             # /config /model
│   ├── agent/
│   │   ├── agent.ts              # LangChain Agent 创建和执行
│   │   ├── tools.ts              # DynamicStructuredTool 定义
│   │   ├── prompt.ts             # System Prompt
│   │   └── memory.ts             # 会话记忆管理 + 持久化
│   ├── client/
│   │   ├── boss-client.ts        # Boss直聘 API 客户端
│   │   ├── auth.ts               # 认证（Cookie/QR）
│   │   ├── constants.ts          # URL/Header/城市编码/筛选枚举
│   │   └── types.ts              # API 响应类型定义
│   ├── services/
│   │   ├── search-service.ts     # 搜索逻辑
│   │   ├── analyze-service.ts    # 数据分析
│   │   ├── match-service.ts      # 智能匹配
│   │   └── export-service.ts     # 导出
│   ├── llm/
│   │   └── provider.ts           # 多模型工厂
│   ├── store/
│   │   ├── db.ts                 # SQLite 连接和操作
│   │   ├── config.ts             # 配置加载（多层覆盖 + 环境变量）
│   │   └── defaults.ts           # 默认配置常量
│   └── utils/
│       ├── delay.ts              # 高斯延迟、退避算法
│       └── format.ts             # 数据格式化工具
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .env.example                  # 环境变量模板（API Key）
├── boss-agent.json.example       # 项目级配置模板
└── README.md
```

---

## 七、MVP 范围（第一版）

### P0 — 核心功能

- [ ] REPL 交互框架（自然语言 + 斜杠命令）
- [ ] BossClient API 客户端（搜索 + 详情 + 推荐）
- [ ] 认证系统（浏览器 Cookie 提取 + QR 扫码）
- [ ] `/search` 命令（多维度筛选）
- [ ] `/recommend` 命令
- [ ] `/detail` / `/show` 命令
- [ ] LangChain Agent 基础对话（理解搜索意图）
- [ ] 多模型支持（OpenAI + Claude + Ollama）
- [ ] SharedContext 上下文共享
- [ ] 配置管理（JSON 配置文件 + 环境变量 + `/config` 命令）

### P1 — 增强功能

- [ ] `/analyze` 薪资分布 + 技能需求分析
- [ ] `/match` 基于技能的岗位匹配评分
- [ ] `/export` CSV/JSON 导出
- [ ] 终端图表（asciichart 薪资分布图）
- [ ] 会话记忆持久化（SQLite）
- [ ] 用户画像记录（技能/期望自动提取）

### P2 — 后续优化

- [ ] RAG 语义搜索（向量匹配 JD 描述）
- [ ] 多城市对比分析
- [ ] 薪资趋势追踪（历史数据对比）
- [ ] 打招呼/投递功能
- [ ] 浏览器可视化报告（可选 HTML 导出）

---

## 八、关键风险和应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| Boss直聘 API 变动 | 搜索/详情功能失效 | 版本锁定已知 API；参考 boss-cli 社区及时更新 |
| 反爬升级 | 账号受限 | 限流策略 + Cookie 定期刷新；不做高频批量操作 |
| Cookie 过期 | 无法访问 | 7天自动刷新 + 二维码兜底；状态提示 |
| LLM 幻觉 | 给出错误分析 | System Prompt 约束"不编造数据"；关键数据标注来源 |
| LangChain.js 更新 | API breaking change | 锁版本；核心逻辑不过度依赖框架抽象 |

---

## 九、参考项目

- [boss-cli](https://github.com/jackwener/boss-cli) — API 逆向、反检测策略、Agent SKILL.md 设计
- [jobclaw](https://github.com/slothsheepking/jobclaw) — LLM 匹配引擎、求职画像设计
- [get_jobs](https://github.com/loks666/get_jobs) — 多平台适配、防封策略

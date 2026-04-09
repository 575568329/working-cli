# Claude Code 参考架构索引

> 源码路径: `refer/claude-code-main/src/`
> 用途: Boss CLI 重写的架构参考，提取核心设计模式

---

## 核心循环: 用户输入 → LLM → 工具 → 回路

```
User input
    │
    ▼
QueryEngine.submitMessage()        ── src/QueryEngine.ts
    ├── processUserInput()          ── 处理 slash 命令、附件
    └── query()                     ── src/query.ts（核心循环）
            │
            ▼  每次迭代
        [1] 压缩/裁剪消息（保持上下文窗口）
        [2] callModel() ── 调用 LLM API（流式）
        [3] 收集 assistant 消息 + tool_use 块
        [4] 有 tool_use?
            ├── YES → runTools() → tool.call() → 收集结果 → continue 回 [1]
            └── NO  → stop hooks → return { reason: 'completed' }
```

---

## 关键文件与职责

| 文件 | 行为 | 对 Boss CLI 的价值 |
|------|------|-------------------|
| `src/QueryEngine.ts` | 会话编排器，管理一次完整对话 | Agent 类的参考蓝本 |
| `src/query.ts` | **核心循环**，`while(true)` 异步生成器 | ReAct 循环实现参考 |
| `src/Tool.ts` | Tool 类型定义 + `buildTool()` 工厂 | 工具系统设计参考 |
| `src/tools.ts` | 工具注册表，条件加载 | 工具注册模式参考 |
| `src/commands.ts` | 命令注册表，`COMMANDS()` memoized | 命令派发模式参考 |
| `src/state/store.ts` | 35 行极简状态管理（类 Zustand） | 状态管理参考 |
| `src/bootstrap/state.ts` | 全局可变状态单例 | 会话追踪参考 |
| `src/utils/log.ts` | 错误日志队列 + sink 模式 | **日志系统核心参考** |
| `src/utils/debug.ts` | 调试日志（分级 + 文件输出） | 分级日志参考 |
| `src/utils/startupProfiler.ts` | 启动性能剖析 | 性能追踪参考 |

---

## 五大核心设计模式

### 1. 极简状态管理 (`state/store.ts`)

35 行代码，零依赖的 Zustand 风格 store:

```typescript
type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}
```

- `setState` 接收 `(prev) => next` 函数（不可变更新）
- `Object.is` 比较，无变化则跳过通知
- `onChange` 回调在 listener 之前触发（用于副作用如日志）

### 2. 队列-汇入日志模式 (`services/analytics/index.ts`, `utils/log.ts`)

**核心思想**: 模块初始化时就可以记录日志，后端可以延迟挂载。

```typescript
// 早期调用 → 进入队列
const eventQueue: Event[] = [];
function logEvent(name, data) {
  if (!sink) { eventQueue.push({name, data}); return; }
  sink.logEvent(name, data);
}

// 后端就绪后挂载 → 排空队列
function attachSink(newSink) {
  sink = newSink;
  queueMicrotask(() => { eventQueue.forEach(e => sink.logEvent(e)); });
}
```

### 3. AsyncGenerator 管道 (`query.ts`)

整个查询管道用 `async function*` + `yield` 实现:
- `query()` 是一个 `while(true)` 生成器
- 每次迭代 yield 消息更新
- 调用方通过 `for await (const msg of query())` 消费
- 天然支持流式输出和中途取消（AbortController）

### 4. 工具定义工厂 (`Tool.ts`)

```typescript
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isReadOnly: () => false,
  checkPermissions: (input) => Promise.resolve({ behavior: 'allow' }),
};

function buildTool(def) {
  return { ...TOOL_DEFAULTS, ...def };
}
```

每个工具只需实现 `call()` + `inputSchema`，其余用默认值填充。

### 5. 全局状态单例 (`bootstrap/state.ts`)

一个模块级 `const STATE` 对象持有所有会话级可变状态:
- `sessionId` (UUID) — 会话标识
- `totalCostUSD` — 成本追踪
- `modelUsage` — 模型用量统计
- `lastAPIRequest` — 最后一次 API 请求（用于 bug 报告）
- 通过 getter/setter 访问，不直接修改

---

## 日志/追踪体系

### 分层结构

```
logEvent()           ── 业务事件（分析用）
  └─ sink ── 路由到 Datadog / 1P logging

logError()           ── 错误事件
  └─ sink ── 内存环形缓冲(100条) + 调试文件 + JSONL 持久化

logForDebugging()    ── 调试日志
  └─ stderr 或 ~/.claude/debug/<sessionId>.txt

profileCheckpoint()  ── 启动性能
  └─ perf_hooks 标记 + 文件报告
```

### 日志格式

- **文件日志**: JSONL 格式，每行一条 `{ timestamp, level, event, data, sessionId }`
- **控制台日志**: 彩色分级 `[timestamp] [LEVEL] [module] message`
- **日志级别**: TRACE → DEBUG → INFO → WARN → ERROR

### 关键设计决策
- 错误日志同步排空（不能丢），分析日志异步排空（性能优先）
- 环形缓冲 100 条用于 `/share` bug 报告
- 所有日志携带 `sessionId` 做会话关联

---

## 对 Boss CLI 重写的指导

### 要学的
- **35 行 Store 模式** — 替代复杂的状态管理
- **队列-汇入日志** — 确保每一步可追溯
- **buildTool 工厂** — 工具定义只需 `name + schema + call()`
- **AsyncGenerator 管道** — 天然流式

### 不学的
- React/Ink 终端 UI（过重）
- GrowthBook 特性标志（过复杂）
- MCP 协议（Boss CLI 不需要）
- 插件系统（V1 不需要）
- 多 Agent 协调（V1 不需要）
- OTel 遥测（V1 不需要）

### 做减法后的核心
一个 Agent = `while(true) { callLLM → checkToolCalls → runTools → continue }`
一个 Tool = `{ name, schema, call() }`
一个 Store = `{ getState, setState, subscribe }`
一个 Logger = `queue + sink + file`

# Boss CLI — LangChain.js + LangGraph 进阶实战学习项目

> 创建日期：2026-04-09
> 状态：已确认
> 定位：以 Boss 直聘为载体的 **AI Agent 全栈学习项目**
> 核心原则：先完成核心功能，再挑战陡峭学习曲线

---

## 一、设计原则

1. **做减法** — 每个文件职责单一，核心代码 800 行以内
2. **可追溯** — 每一步都有日志，出错时能完整复现链路
3. **分阶段迭代** — 每个 Phase 聚焦一个核心技术，独立可验证
4. **学习优先** — 代码注释解释 Why，关键步骤标注学到了什么
5. **渐进增强** — 先用简单方式跑通，再升级到更高级的模式
6. **即时验证** — 每个 Phase 有独立 Demo 脚本，学完立刻能跑

---

## 二、技术栈收敛

| 层面 | 选型 | 理由 |
|------|------|------|
| LLM | 智谱 GLM-5.1 | 已配置，不加第二个 Provider |
| 编排 | **LangGraph** 状态机 | 替代 AgentExecutor，2026 行业标准 |
| 工具 | `tool()` + Zod | 官方推荐 API，比 DynamicStructuredTool 简洁 |
| 存储 | JSON 文件 + MemoryVectorStore | 无 native 依赖，跨平台兼容 |
| 持久化 | LangGraph MemorySaver → 自定义 JSON Checkpointer | 先内存后文件，渐进增强 |
| UI | REPL 终端 | 暂不碰 Next.js |

---

## 三、技术学习路径

```
Phase 0  工程基座 + Mock 数据    （日志、配置、模拟数据）
  │
Phase 1  Model I/O               （ChatOpenAI、PromptTemplate、OutputParser、LCEL）
  │
Phase 2  Tools                   （tool() 工厂 + Zod Schema + ToolNode）
  │
Phase 3  LangGraph Agent         （StateGraph、Nodes、Edges、State、Mermaid 可视化）
  │
Phase 4  Memory 持久化           （MemorySaver → JSON Checkpoint、对话恢复）
  │
Phase 5  RAG 精简版              （MemoryVectorStore + 基本检索）
  │
Phase 6  REPL + Human-in-loop    （多模式流式输出 + interrupt() 人类干预）
```

---

## 四、项目结构

```
src/
  index.ts          -- 入口 + REPL 循环（Phase 0+6）
  logger.ts         -- 结构化日志（Phase 0）
  config.ts         -- 配置加载（Phase 0）
  llm.ts            -- Model I/O（Phase 1）
  tools.ts          -- tool() + Zod 工具定义（Phase 2）
  boss-client.ts    -- Boss API + Mock 数据（Phase 2）
  graph.ts          -- LangGraph 状态机（Phase 3）
  memory.ts         -- Checkpoint 持久化（Phase 4）
  rag.ts            -- 向量检索（Phase 5）

demos/
  phase-0-logger.ts       -- 日志系统演示
  phase-1-model-io.ts     -- LLM 调用 + 流式输出演示
  phase-2-tools.ts        -- 工具调用演示
  phase-3-langgraph.ts    -- 状态机 + Mermaid 可视化演示
  phase-4-memory.ts       -- 持久化演示
  phase-5-rag.ts          -- 向量检索演示
```

---

## 五、各 Phase 详细设计

### Phase 0: 工程基座 + Mock 数据

**学习目标**: 项目基础设施、可离线开发

**文件**:
- `src/index.ts` — 入口，~10 行
- `src/logger.ts` — 结构化日志，~80 行
- `src/config.ts` — 配置加载，~40 行

**Logger 设计**（队列-汇入模式，参考 claude-code 架构）:
```typescript
const logger = {
  trace(module: string, msg: string, ...args: any[]): void,
  debug(module: string, msg: string, ...args: any[]): void,
  info(module: string, msg: string, ...args: any[]): void,
  warn(module: string, msg: string, ...args: any[]): void,
  error(module: string, msg: string, ...args: any[]): void,
};

// 控制台: [10:30:45] [INFO] [agent] 开始 ReAct 循环，第 3 次迭代
// 文件:   ~/.boss-agent/logs/2024-04-09.log (JSONL，全部级别)
// 每条日志携带: timestamp, level, module, message, tokenCost(如有)
```

**Config 设计**:
```typescript
interface AppConfig {
  llm: { provider: string; model: string; apiKey?: string; baseUrl?: string };
  boss: { defaultCity: string; pageSize: number; mockMode: boolean };
  log: { level: "trace" | "debug" | "info" | "warn" | "error"; dir: string };
}
// 加载优先级: boss-agent.json → env vars → 默认值
```

**Mock Mode**: `boss-client.ts` 内置本地 JSON 模拟数据，`config.boss.mockMode = true` 时使用。
Boss 站反爬严重时不影响 Agent 逻辑开发。

**验证**: `npx tsx src/index.ts` 输出启动日志 + 日志文件写入成功

---

### Phase 1: LangChain Model I/O

**学习目标**: LangChain 如何抽象 LLM 调用

**核心技术点**:
1. **ChatOpenAI** — LangChain 对 OpenAI 兼容 API 的封装
2. **ChatPromptTemplate** — 参数化 Prompt（含 Few-shot）
3. **Output Parsers** — StringOutputParser + StructuredOutputParser
4. **LCEL 链式调用** — `pipe()` 是 LangChain 的核心编排方式
5. **Streaming** — `.stream()` 逐 token 输出

**文件**: `src/llm.ts`（~120 行）

**代码骨架**:
```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { StructuredOutputParser } from "langchain/output_parsers";

// 1. ChatModel（连接智谱 GLM-5.1）
const model = new ChatOpenAI({
  modelName: "GLM-5.1",
  openAIApiKey: config.llm.apiKey,
  configuration: { baseURL: "https://open.bigmodel.cn/api/paas/v4" },
  temperature: 0.7,
});

// 2. Prompt Template
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是 Boss 直聘求职助手。用中文回答。"],
  ["human", "{input}"],
]);

// 3. LCEL 链式调用（LangChain Expression Language）
const chain = prompt.pipe(model).pipe(new StringOutputParser());

// 4. 普通调用
const result = await chain.invoke({ input: "Java 开发在北京薪资多少？" });

// 5. 流式输出
const stream = await chain.stream({ input: "前端就业趋势？" });
for await (const chunk of stream) {
  process.stdout.write(chunk);
}

// 6. 结构化输出（让 LLM 返回 JSON）
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  salary: "薪资范围，如 15K-25K",
  skills: "核心技能要求，逗号分隔",
  analysis: "简要分析",
});
```

**学习要点**:
- LCEL `pipe()` 链是 LangChain 的核心编排方式，贯穿所有 Phase
- `ChatPromptTemplate.fromMessages` 支持多角色消息模板
- `StructuredOutputParser` 让 LLM 输出变成可解析的 JSON
- `.stream()` vs `.invoke()` 的区别

**验证**: `npx tsx demos/phase-1-model-io.ts` 调用 GLM-5.1，打印回复、流式输出、token 统计

---

### Phase 2: LangChain Tools

**学习目标**: 如何让 LLM 调用外部函数

**核心技术点**:
1. **`tool()` 工厂函数** — 官方推荐的工具定义方式（替代 DynamicStructuredTool）
2. **Zod Schema** — 用 `.describe()` 为 LLM 提供参数说明
3. **ToolNode** — LangGraph 预构建的工具执行节点
4. **工具描述工程** — description 质量直接决定 LLM 调用准确性

**文件**: `src/tools.ts`（~100 行）+ `src/boss-client.ts`（~150 行，含 Mock）

**代码骨架**:
```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 工具 1: 搜索职位（用 tool() 工厂，比 DynamicStructuredTool 更简洁）
const searchJobsTool = tool(
  async ({ keyword, city, salary }) => {
    logger.info("tool", "执行 search_jobs: keyword=%s, city=%s", keyword, city);
    const results = await bossClient.search(keyword, city, salary);
    logger.info("tool", "返回 %d 条结果", results.length);
    return JSON.stringify(results);
  },
  {
    name: "search_jobs",
    description: "在 Boss 直聘搜索职位。当用户想找工作、看岗位时使用。",
    schema: z.object({
      keyword: z.string().describe("搜索关键词，如 Java、前端"),
      city: z.string().optional().describe("城市名，如 北京、上海"),
      salary: z.string().optional().describe("薪资范围，如 10-20"),
    }),
  }
);

// 工具 2: 薪资分析
const analyzeSalaryTool = tool(
  async ({ jobs_json }) => {
    const jobs = JSON.parse(jobs_json);
    // 计算平均值、中位数、分布
    return JSON.stringify({ avg, median, distribution });
  },
  {
    name: "analyze_salary",
    description: "分析职位列表的薪资分布。当用户问薪资水平、待遇对比时使用。",
    schema: z.object({
      jobs_json: z.string().describe("职位的 JSON 数组字符串"),
    }),
  }
);
```

**Mock 数据**: boss-client.ts 在 mockMode=true 时返回内置 JSON，开发不依赖真实 API。

**学习要点**:
- `tool()` 第一个参数是执行函数，第二个是配置（name + description + schema）
- `z.object()` 的 `.describe()` 是给 LLM 看的文档，描述质量决定调用准确性
- 工具返回 `string`，LLM 读取后决定下一步

**验证**: `npx tsx demos/phase-2-tools.ts` — LLM 自主选择工具执行，日志记录工具调用

---

### Phase 3: LangGraph Agent（关键升级）

**学习目标**: 从黑盒 AgentExecutor 转向可控的状态机架构

**为什么要学 LangGraph**:
- AgentExecutor 是黑盒，无法控制决策路径
- LangGraph 用状态机（Nodes + Edges）显式定义流程，精确定位每一步
- 2026 年面试中 LangGraph 已成为 Agent 开发行业标准

**核心技术点**:
1. **StateGraph** — 定义状态机图
2. **Annotation** — 定义共享状态类型与 reducer
3. **Nodes** — 节点（Think 决策节点、Action 执行节点）
4. **Conditional Edges** — 条件边（根据 LLM 输出路由）
5. **ToolNode** — 预构建的工具执行节点（开箱即用）
6. **Mermaid 可视化** — 一键输出状态机流程图

**文件**: `src/graph.ts`（~100 行）

**代码骨架**:
```typescript
import { StateGraph, END, START, Annotation, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { messagesStateReducer } from "@langchain/langgraph";

// 1. 定义 Agent 状态
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
});

// 2. Think 节点 — LLM 决策
async function think(state: typeof AgentState.State) {
  logger.info("agent", "Think 节点：消息数 %d", state.messages.length);
  const response = await model.bindTools(tools).invoke(state.messages);
  logger.info("agent", "LLM 返回: tool_calls=%d", response.tool_calls?.length ?? 0);
  return { messages: [response] };
}

// 3. 路由决策 — 有 tool_calls 走 Action，否则结束
function routeAfterThink(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls?.length) return "action";
  logger.info("agent", "Agent 完成，返回最终回复");
  return END;
}

// 4. 组装状态图
const workflow = new StateGraph(AgentState)
  .addNode("think", think)
  .addNode("action", new ToolNode(tools))   // 预构建节点，自动执行 tool_calls
  .addEdge(START, "think")
  .addConditionalEdges("think", routeAfterThink)
  .addEdge("action", "think");              // Action 完成后回到 Think

// 5. 编译（需要 checkpointer 才能支持 interrupt）
const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// 6. Mermaid 可视化（看见你的状态机）
const mermaid = (await graph.getGraphAsync()).drawMermaid();
console.log(mermaid);  // 输出流程图，可直接粘贴到 Mermaid Live Editor
```

**学习要点**:
- StateGraph 把 "LLM 循环" 变成 "节点图"，每一步可见可控
- `addConditionalEdges` 是决策分叉：有 tool_calls 走 action，否则 END
- `ToolNode` 开箱即用，不需要手写工具执行逻辑
- State 在节点间自动传递，不需要手动管理消息数组
- Mermaid 可视化让你**看见**状态机结构

**验证**: `npx tsx demos/phase-3-langgraph.ts` — Agent 多步骤任务 + 打印 Mermaid 流程图

---

### Phase 4: Memory 持久化

**学习目标**: 让 Agent 跨会话保持记忆

**核心技术点**:
1. **MemorySaver** — LangGraph 内置内存 Checkpoint（开发用）
2. **JSON 文件 Checkpointer** — 自定义实现，跨进程持久化
3. **thread_id** — 用会话 ID 隔离不同对话的状态
4. **getState / setState** — 读取和恢复 Checkpoint

**文件**: `src/memory.ts`（~100 行）

**代码骨架**:
```typescript
import { MemorySaver } from "@langchain/langgraph";
// 渐进增强：先用 MemorySaver（内存），再实现 JSON 文件持久化

// Phase 4a: 内存 Checkpoint（最简单）
const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// thread_id 隔离不同会话
const config = { configurable: { thread_id: "session-1" } };
await graph.invoke({ messages: [new HumanMessage("找 Java 岗位")] }, config);

// 同一会话后续调用，自动恢复上下文
await graph.invoke({ messages: [new HumanMessage("分析薪资")] }, config);

// 读取状态
const snapshot = await graph.getState(config);
logger.info("memory", "当前消息数: %d", snapshot.values.messages.length);

// Phase 4b: JSON 文件持久化（重启后恢复）
// 实现: 退出时 snapshot → writeFileSync → 启动时 readFileSync → restoreState
```

**学习要点**:
- LangGraph Checkpoint = 状态快照，不是 LangChain 的 Memory 接口
- `thread_id` 是会话隔离的关键，不同 thread 互不干扰
- `getState()` 返回完整状态，可以序列化为 JSON
- 生产用 `SqliteSaver`（需要 native binary），学习用 MemorySaver + JSON 文件

**验证**: `npx tsx demos/phase-4-memory.ts` — 多轮对话保持上下文，重启后恢复

---

### Phase 5: RAG 精简版

**学习目标**: 检索增强生成的核心原理

**核心技术点**:
1. **Document** — LangChain 的文档抽象（pageContent + metadata）
2. **MemoryVectorStore** — 零依赖的内存向量存储
3. **Retriever** — 相似度检索接口
4. **Document → Vector → Retrieve → Answer** 完整链路

**文件**: `src/rag.ts`（~120 行）

**代码骨架**:
```typescript
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";

// 1. 将职位搜索结果转为 Document
const docs = jobs.map(job => new Document({
  pageContent: `${job.title} | ${job.company} | ${job.salary} | ${job.skills.join(",")}`,
  metadata: { id: job.id, city: job.city },
}));

// 2. 向量化 + 存储（Embeddings 用 GLM 的接口或简单哈希）
const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
const retriever = vectorStore.asRetriever(5);

// 3. 检索
const results = await retriever.invoke("前端工程化经验要求");
logger.info("rag", "检索到 %d 条相关文档", results.length);

// 4. 检索结果喂给 LLM 生成回答（LCEL 链）
const ragChain = retriever.pipe(docs => {
  const context = docs.map(d => d.pageContent).join("\n");
  return prompt.pipe(model).invoke({ context, question });
});
```

**学习要点**:
- Document = pageContent + metadata，是 LangChain 的数据基本单元
- Embeddings 把文本变成向量，VectorStore 存储和检索
- MemoryVectorStore 零依赖，适合学习（生产用 FAISS/Pinecone）

**验证**: `npx tsx demos/phase-5-rag.ts` — 基于搜索结果回答 "哪个公司薪资最高"

---

### Phase 6: REPL + Human-in-the-loop

**学习目标**: 终端交互 + 人类干预机制（商用 Agent 安全核心）

**核心技术点**:
1. **多模式流式输出** — `streamMode: ["messages", "updates"]` 同时输出 token + 节点进度
2. **Map 命令派发** — 替代 switch-case
3. **`interrupt()` 函数** — 在节点内部暂停图执行（不是 readline 确认）
4. **`Command({ resume })` 恢复** — 用户确认后恢复图执行

**文件**: `src/index.ts`（扩展 REPL 部分，~150 行）

**代码骨架**:
```typescript
import { interrupt, Command } from "@langchain/langgraph";

// === graph.ts 中定义带 interrupt 的节点 ===

async function sendMessageNode(state: typeof AgentState.State) {
  const message = state.draftMessage;
  // 图在此处暂停，控制权回到 REPL
  const approved = interrupt(`确认发送打招呼？\n${message}`);
  if (!approved) return { messages: [new AIMessage("已取消")] };
  return await bossClient.sendMessage(message);
}

// === index.ts 中 REPL 循环 ===

// 命令注册（Map 派发）
const COMMANDS = new Map<string, Command>();
COMMANDS.set("search", { desc: "搜索职位", handler: cmdSearch });
COMMANDS.set("help",   { desc: "显示帮助", handler: cmdHelp });

rl.on("line", async (line) => {
  if (line.startsWith("/")) {
    const [cmd, ...args] = line.slice(1).split(" ");
    await COMMANDS.get(cmd)?.handler(args.join(" "));
  } else {
    // 多模式流式输出
    for await (const [mode, chunk] of await graph.stream(
      { messages: [new HumanMessage(line)] },
      { configurable: { thread_id }, streamMode: ["messages", "updates"] }
    )) {
      if (mode === "messages" && chunk[0].content) {
        process.stdout.write(chunk[0].content);   // 逐字输出 LLM 回复
      } else if (mode === "updates") {
        logger.info("stream", "节点完成: %s", Object.keys(chunk)[0]);
      }
    }
  }
});

// 处理 interrupt：图暂停时，REPL 提示用户确认
const result = await graph.invoke({ messages }, config);
if (result.__interrupt__) {
  const answer = await rl.question(`${result.__interrupt__[0].value} (y/n): `);
  await graph.invoke(new Command({ resume: answer === "y" }), config);
}
```

**Human-in-the-loop 机制详解**:
1. 节点内调用 `interrupt("问题")` → 图暂停，状态保存到 Checkpoint
2. REPL 检测到 `__interrupt__` → 提示用户输入
3. 用户确认 → `graph.invoke(new Command({ resume: true }))` → 图从中断点恢复
4. 这是商用 Agent 的核心安全机制（面试加分项）

**验证**: 完整终端交互，Agent 操作前有确认提示，LLM 回复逐字流式输出

---

## 六、依赖管理

```json
{
  "dependencies": {
    "@langchain/openai": "^0.3",
    "@langchain/core": "^0.3",
    "@langchain/langgraph": "^0.2",
    "langchain": "^0.3",
    "zod": "^3",
    "chalk": "^5"
  },
  "devDependencies": {
    "typescript": "^6",
    "tsx": "^4",
    "vitest": "^4",
    "tsup": "^8"
  }
}
```

**移除**: sql.js, @langchain/anthropic, asciichart, commander, qrcode-terminal

---

## 七、日志贯穿每个 Phase

每个 Phase 在关键节点加入日志：

```
[llm]     → API 调用、token 统计、响应时间、模型名
[tool]    → 工具名、参数、执行时间、结果长度
[agent]   → 节点进入/退出（Think/Action）、路由决策、迭代次数
[memory]  → Checkpoint 保存/加载、thread_id、消息数
[rag]     → 检索 query、匹配文档数、Document 内容
[repl]    → 用户输入、命令派发、interrupt 触发/恢复
```

所有日志携带 Token Cost（prompt_tokens + completion_tokens），文件格式为 JSONL。

---

## 八、验证策略

| Phase | Demo 脚本 | 验证方法 |
|-------|----------|---------|
| 0 | `demos/phase-0-logger.ts` | 启动日志输出 + JSONL 文件写入 |
| 1 | `demos/phase-1-model-io.ts` | 调用 GLM-5.1，打印回复 + 流式输出 + token 统计 |
| 2 | `demos/phase-2-tools.ts` | LLM 自主选择工具执行，日志记录调用 |
| 3 | `demos/phase-3-langgraph.ts` | Agent 多步骤任务 + Mermaid 流程图输出 |
| 4 | `demos/phase-4-memory.ts` | 多轮对话保持上下文，重启后恢复 |
| 5 | `demos/phase-5-rag.ts` | 基于检索结果回答问题 |
| 6 | `src/index.ts` 完整 REPL | 终端交互 + 流式输出 + interrupt 确认 |

---

## 九、远期 Roadmap（核心完成后）

以下内容在 Phase 0-6 全部完成后再评估：

1. **Next.js API Bridge** — 封装 `runAgentStream`，支持 Vercel AI SDK 流式输出
2. **多模型路由** — Gemini 3 / GLM-5.1 动态切换（提取用 Flash，分析用 Pro）
3. **SqliteSaver** — 替代 JSON 文件持久化（注意 Windows native binary 兼容性）
4. **Rerank 重排序** — 用二次 LLM 调用精选检索结果
5. **Metadata Filtering** — SQL WHERE + 向量检索混合过滤

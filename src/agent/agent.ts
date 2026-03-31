import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { SearchService } from "../services/search-service.js";
import type { AnalyzeService } from "../services/analyze-service.js";
import type { MatchService } from "../services/match-service.js";
import type { SharedContext } from "../repl/context.js";
import type { LLMConfig } from "../llm/provider.js";
import type { Database } from "../store/db.js";
import { createChatModel } from "../llm/provider.js";
import { createTools } from "./tools.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { SessionMemory } from "./memory.js";

export interface AgentDependencies {
  llmConfig: LLMConfig;
  searchService: SearchService;
  analyzeService: AnalyzeService;
  matchService: MatchService;
  context: SharedContext;
  db?: Database;
}

export class BossAgent {
  private llm: BaseChatModel;
  private tools: ReturnType<typeof createTools>;
  private memory: SessionMemory;
  private context: SharedContext;
  private systemPrompt: string;

  constructor(deps: AgentDependencies) {
    this.llm = createChatModel(deps.llmConfig);
    this.tools = createTools({
      searchService: deps.searchService,
      analyzeService: deps.analyzeService,
      matchService: deps.matchService,
      context: deps.context,
    });
    this.context = deps.context;
    this.systemPrompt = SYSTEM_PROMPT;
    this.memory = new SessionMemory(
      `session-${Date.now()}`,
      deps.db
    );
  }

  async init(): Promise<void> {
    await this.memory.init();
  }

  /**
   * 调用 Agent — 简单的 ReAct 循环
   * 不使用 LangChain AgentExecutor（减少框架耦合），
   * 直接用 LLM + Tools 实现轻量级 agent loop。
   */
  async call(userInput: string): Promise<string> {
    this.memory.addUserMessage(userInput);

    // 构建 messages
    const messages = [
      { role: "system", content: this.systemPrompt },
      ...this.memory.toLangChainMessages(),
    ];

    try {
      // 绑定 tools 到 LLM
      if (!this.llm.bindTools) {
        throw new Error("当前 LLM 不支持 tool calling，请切换到支持的模型（如 gpt-4o、claude）");
      }
      const llmWithTools = this.llm.bindTools(this.tools);
      const response = await llmWithTools.invoke(messages);

      // 如果 LLM 返回的是 tool call
      const content = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

      this.memory.addAssistantMessage(content);
      return content;
    } catch (err: any) {
      const errorMsg = `Agent 调用失败: ${err.message}`;
      this.memory.addAssistantMessage(errorMsg);
      return errorMsg;
    }
  }

  getMemory(): SessionMemory {
    return this.memory;
  }
}

/**
 * 工厂函数：创建 BossAgent
 */
export async function createBossAgent(deps: AgentDependencies): Promise<BossAgent> {
  const agent = new BossAgent(deps);
  await agent.init();
  return agent;
}

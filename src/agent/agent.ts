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
   * 调用 Agent — ReAct 循环
   * 绑定 tools 到 LLM，当 LLM 返回 tool_calls 时执行工具并回传结果，再循环。
   */
  async call(userInput: string): Promise<string> {
    this.memory.addUserMessage(userInput);

    const messages = [
      { role: "system", content: this.systemPrompt },
      ...this.memory.toLangChainMessages(),
    ];

    try {
      if (!this.llm.bindTools) {
        throw new Error("当前 LLM 不支持 tool calling，请切换到支持的模型（如 gpt-4o、 claude）");
      }
      const llmWithTools = this.llm.bindTools(this.tools);

      const MAX_ITERATIONS = 10;
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await llmWithTools.invoke(messages);

        // LLM 直接返回文本（不需要工具）
        if (typeof response.content === "string" && response.content.length > 0) {
          this.memory.addAssistantMessage(response.content);
          return response.content;
        }

        // 有 tool_calls，执行工具并回传结果
        if (response.tool_calls && response.tool_calls.length > 0) {
          const toolMessages: Array<{ role: string; content: string; name?: string }> = [];
          for (const tc of response.tool_calls) {
            const tool = this.tools.find(t => t.name === tc.name);
            if (!tool) {
              toolMessages.push({
                role: "tool",
                content: JSON.stringify({ error: `未找到工具: ${tc.name}` }),
                name: tc.name,
              });
              continue;
            }
            try {
              const result = await tool.invoke(tc.args as Record<string, unknown>);
              toolMessages.push({
                role: "tool",
                content: typeof result === "string" ? result : JSON.stringify(result),
                name: tc.name,
              });
            } catch (err: any) {
              toolMessages.push({
                role: "tool",
                content: JSON.stringify({ error: err.message }),
                name: tc.name,
              });
            }
          }
          // 将工具结果追加到 messages，进入下一轮
          messages.push({
            role: "assistant",
            content: response.content ?? "",
            tool_calls: response.tool_calls,
          } as any);
          for (const tm of toolMessages) {
            messages.push(tm as any);
          }
          continue; // 继续下一轮循环
        }

        // 既无文本也无 tool_calls，跳出
        const fallback = typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
        this.memory.addAssistantMessage(fallback);
        return fallback;
      }

      // 超出最大循环次数
      const maxMsg = "抱歉，工具调用轮次超过限制，";
      this.memory.addAssistantMessage(maxMsg);
      return maxMsg;
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
 * 工厂函数: 创建 BossAgent
 */
export async function createBossAgent(deps: AgentDependencies): Promise<BossAgent> {
  const agent = new BossAgent(deps);
  await agent.init();
  return agent;
}

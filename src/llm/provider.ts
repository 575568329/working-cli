import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface LLMConfig {
  provider: "openai" | "claude" | "ollama";
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * 多模型工厂 — 根据配置创建对应的 LLM 实例
 */
export function createChatModel(config: LLMConfig): BaseChatModel {
  switch (config.provider) {
    case "openai":
      return new ChatOpenAI({
        model: config.model,
        apiKey: config.apiKey,
        configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
        temperature: 0.7,
      });

    case "claude":
      return new ChatAnthropic({
        model: config.model,
        anthropicApiKey: config.apiKey,
        temperature: 0.7,
      });

    case "ollama":
      return new ChatOpenAI({
        model: config.model,
        apiKey: "ollama", // Ollama 不需要 key，但 ChatOpenAI 要求非空
        configuration: {
          baseURL: config.baseUrl || "http://localhost:11434/v1",
        },
        temperature: 0.7,
      });

    default:
      throw new Error(`不支持的 LLM provider: ${(config as any).provider}`);
  }
}

/**
 * 解析 provider 简写为完整配置
 */
export function resolveProvider(
  provider: string,
  apiKey?: string,
  baseUrl?: string
): LLMConfig {
  switch (provider.toLowerCase()) {
    case "openai":
    case "gpt":
      return { provider: "openai", model: "gpt-4o", apiKey };
    case "claude":
    case "anthropic":
      return { provider: "claude", model: "claude-sonnet-4-20250514", apiKey };
    case "ollama":
      return { provider: "ollama", model: "qwen2.5", baseUrl };
    case "zhipu":
    case "glm":
      return {
        provider: "openai",
        model: "glm-5",
        apiKey,
        baseUrl: baseUrl || "https://open.bigmodel.cn/api/paas/v4",
      };
    default:
      throw new Error(`未知的 provider: ${provider}`);
  }
}

import { describe, it, expect } from "vitest";
import { createChatModel, resolveProvider } from "../../src/llm/provider.js";

describe("createChatModel", () => {
  it("应创建 OpenAI 模型", () => {
    const model = createChatModel({ provider: "openai", model: "gpt-4o", apiKey: "test" });
    expect(model).toBeDefined();
  });

  it("应创建 Claude 模型", () => {
    const model = createChatModel({ provider: "claude", model: "claude-sonnet-4-20250514", apiKey: "test" });
    expect(model).toBeDefined();
  });

  it("应创建 Ollama 模型", () => {
    const model = createChatModel({
      provider: "ollama",
      model: "qwen2.5",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(model).toBeDefined();
  });

  it("不支持的 provider 应抛错", () => {
    expect(() => createChatModel({ provider: "unknown" as any, model: "" })).toThrow(
      "不支持的 LLM provider"
    );
  });
});

describe("resolveProvider", () => {
  it("应解析 openai", () => {
    const config = resolveProvider("openai", "test-key");
    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-4o");
    expect(config.apiKey).toBe("test-key");
  });

  it("应解析 gpt 别名", () => {
    const config = resolveProvider("gpt");
    expect(config.provider).toBe("openai");
  });

  it("应解析 claude", () => {
    const config = resolveProvider("claude", "test-key");
    expect(config.provider).toBe("claude");
    expect(config.model).toBe("claude-sonnet-4-20250514");
  });

  it("应解析 anthropic 别名", () => {
    const config = resolveProvider("anthropic");
    expect(config.provider).toBe("claude");
  });

  it("应解析 ollama", () => {
    const config = resolveProvider("ollama");
    expect(config.provider).toBe("ollama");
    expect(config.model).toBe("qwen2.5");
  });

  it("未知 provider 应抛错", () => {
    expect(() => resolveProvider("unknown")).toThrow("未知的 provider");
  });
});

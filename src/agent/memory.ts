import type { Database } from "../store/db.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * 会话记忆管理 — 基于 SQLite 持久化
 * LangChain 的 ConversationSummaryMemory 在后续集成，
 * 这里先实现基础的会话存储/读取。
 */
export class SessionMemory {
  private sessionId: string;
  private db: Database | null;
  private buffer: ChatMessage[] = [];

  constructor(sessionId: string, db?: Database) {
    this.sessionId = sessionId;
    this.db = db ?? null;
  }

  async init(): Promise<void> {
    if (!this.db) return;
    // 从 DB 加载历史消息
    const records = this.db.getMessages(this.sessionId);
    this.buffer = records.map(r => ({
      role: r.role as ChatMessage["role"],
      content: r.content,
    }));
  }

  addUserMessage(content: string): void {
    this.buffer.push({ role: "user", content });
    this.db?.saveMessage(this.sessionId, "user", content);
  }

  addAssistantMessage(content: string): void {
    this.buffer.push({ role: "assistant", content });
    this.db?.saveMessage(this.sessionId, "assistant", content);
  }

  getMessages(): ChatMessage[] {
    return [...this.buffer];
  }

  /**
   * 获取最近 N 条消息（用于 LLM 上下文）
   */
  getRecentMessages(count = 20): ChatMessage[] {
    return this.buffer.slice(-count);
  }

  /**
   * 转为 LangChain 格式的消息
   */
  /**
   * 转为 LangChain 格式的消息
   * LangChain 需要 "human" / "ai" / "system" / "tool"， role
   */
  toLangChainMessages(): Array<{ role: string; content: string }> {
    return this.getRecentMessages().map(m => {
      const role = m.role === "user"
        ? "human"
        : m.role === "assistant"
          ? "ai"
          : m.role;
      return { role, content: m.content };
    });
  }

  clear(): void {
    this.buffer = [];
    this.db?.clearMessages(this.sessionId);
  }
}

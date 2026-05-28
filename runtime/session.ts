import type { Message, AssistantMessage } from "./messages";
import { appendTranscript, getTranscriptPath } from "../storage/transcript";
import {
  updateSessionInfo,
  touchSession,
  closeSession,
  checkinToTask,
  checkoutFromTask,
} from "../storage/sessionIndex";
import { eventBus } from "../shared/eventBus";
import { emptyUsage, type Usage } from "./usage";
import { addKnowledge, type KnowledgeCategory } from "../storage/knowledge";
import { rebuildMemoryFromKnowledge } from "../storage/memory";

export type SessionConfig = {
  id: string;
  cwd: string;
  autoExtractKnowledge?: boolean;
};

function extractKnowledgeFromMessages(messages: Message[]): Array<{
  category: KnowledgeCategory;
  content: string;
  tags: string[];
}> {
  const insights: Array<{
    category: KnowledgeCategory;
    content: string;
    tags: string[];
  }> = [];

  let errorCount = 0;
  let toolUseCount = 0;
  const toolsUsed: Set<string> = new Set();
  const errorTools: Set<string> = new Set();

  for (const msg of messages) {
    if (msg.type === "assistant") {
      const aMsg = msg as AssistantMessage;
      for (const block of aMsg.content) {
        if (block.type === "tool_use") {
          toolUseCount += 1;
          toolsUsed.add(block.name);
        }
      }
    }

    if (msg.type === "tool_result" && msg.isError) {
      errorCount += 1;
      for (const prevMsg of messages) {
        if (prevMsg.type === "assistant") {
          const aMsg = prevMsg as AssistantMessage;
          for (const block of aMsg.content) {
            if (block.type === "tool_use" && block.id === msg.toolUseId) {
              errorTools.add(block.name);
            }
          }
        }
      }
    }
  }

  if (errorTools.size > 0) {
    for (const tool of errorTools) {
      insights.push({
        category: "anti_pattern",
        content: `Tool "${tool}" produced errors in this session. Consider alternative approaches or verify inputs before using ${tool}.`,
        tags: ["error", tool, "anti-pattern"],
      });
    }
  }

  if (toolUseCount > 15) {
    insights.push({
      category: "pattern",
      content: `High tool usage (${toolUseCount} calls) suggests complex task. Consider using sub-agents or teams for similar tasks to reduce context pollution.`,
      tags: ["efficiency", "tool-usage"],
    });
  }

  const userMessages = messages.filter((m) => m.type === "user");
  if (userMessages.length > 3) {
    const userContents = userMessages.map((m) =>
      m.type === "user" ? m.content : "",
    );
    const hasCorrection = userContents.some((c, i) => {
      if (i === 0) return false;
      const lower = c.toLowerCase();
      return (
        lower.includes("no,") ||
        lower.includes("not like that") ||
        lower.includes("wrong") ||
        lower.includes("try again") ||
        lower.includes("different")
      );
    });
    if (hasCorrection) {
      insights.push({
        category: "anti_pattern",
        content:
          "User had to correct the assistant multiple times. Initial approach may not match user expectations. Ask clarifying questions earlier.",
        tags: ["user-correction", "communication"],
      });
    }
  }

  return insights;
}

export class SessionEngine {
  private messages: Message[] = [];
  private usage: Usage = emptyUsage();

  private knowledgeExtracted = false;

  constructor(private readonly config: SessionConfig) {}

  get sessionId(): string {
    return this.config.id;
  }

  get cwd(): string {
    return this.config.cwd;
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  appendMessage(message: Message): void {
    this.messages.push(message);
  }

  hydrateMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  async recordMessages(messages: Message[]): Promise<void> {
    this.messages.push(...messages);
    await appendTranscript(this.cwd, this.sessionId, messages);
    await updateSessionInfo(this.cwd, this.sessionId, this.messages);

    if (this.config.autoExtractKnowledge && !this.knowledgeExtracted) {
      const hasAssistantText = messages.some(
        (m) => m.type === "assistant" && (m as AssistantMessage).content.some(
          (b) => b.type === "text" && b.text.trim().length > 0,
        ),
      );
      if (hasAssistantText) {
        this.knowledgeExtracted = true;
        this.extractAndPersistKnowledge().catch((err) => {
          console.error("[Session] Auto knowledge extraction failed:", err);
        });
      }
    }
  }

  getTranscriptPath(): string {
    return getTranscriptPath(this.cwd, this.sessionId);
  }

  getUsage(): Usage {
    return { ...this.usage };
  }

  async touch(): Promise<void> {
    await touchSession(this.config.cwd, this.sessionId);
    eventBus.emit("session:heartbeat", {
      sessionId: this.sessionId,
      timestamp: Date.now(),
    });
  }

  async close(): Promise<void> {
    await closeSession(this.config.cwd, this.sessionId);
    eventBus.emit("session:closed", {
      sessionId: this.sessionId,
      timestamp: Date.now(),
    });
  }

  async checkinTask(taskId: string): Promise<void> {
    await checkinToTask(this.config.cwd, this.sessionId, taskId);
  }

  async checkoutTask(taskId: string): Promise<void> {
    await checkoutFromTask(this.config.cwd, this.sessionId, taskId);
  }

  async extractAndPersistKnowledge(): Promise<number> {
    const insights = extractKnowledgeFromMessages(this.messages);
    let added = 0;

    for (const insight of insights) {
      const entry = await addKnowledge(
        this.cwd,
        insight.category,
        insight.content,
        "user_implicit",
        insight.tags,
      );
      if (entry) added += 1;
    }

    if (added > 0) {
      await rebuildMemoryFromKnowledge(this.cwd);
    }

    return added;
  }
}

import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import type { Message } from "../runtime/messages";

export type SessionInfo = {
  id: string;
  title?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
  toolUseCount?: number;
  errorCount?: number;
  firstPrompt?: string;
  lastPrompt?: string;
  provider?: string;
  model?: string;
  status?: "ready" | "needs_attention";
  lastTool?: string;
  lastError?: string;
};

function getSessionsDir(cwd: string): string {
  return join(cwd, ".claude-code-lite", "sessions");
}

function getTranscriptsDir(cwd: string): string {
  return join(cwd, ".claude-code-lite", "transcripts");
}

function getSessionInfoPath(cwd: string, sessionId: string): string {
  return join(getSessionsDir(cwd), `${sessionId}.json`);
}

function getTranscriptPath(cwd: string, sessionId: string): string {
  return join(getTranscriptsDir(cwd), `${sessionId}.jsonl`);
}

export function getSessionInfoFilePath(cwd: string, sessionId: string): string {
  return getSessionInfoPath(cwd, sessionId);
}

function summarizeText(text: string, maxLength = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function extractUserPrompts(messages: Message[]): string[] {
  return messages
    .filter(
      (message): message is Extract<Message, { type: "user" }> =>
        message.type === "user",
    )
    .map((message) => summarizeText(message.content, 120));
}

function deriveSessionTitle(messages: Message[], sessionId: string): string {
  const firstUser = messages.find(
    (message): message is Extract<Message, { type: "user" }> =>
      message.type === "user",
  );
  if (firstUser) {
    return summarizeText(firstUser.content, 72);
  }
  return `session ${sessionId}`;
}

function deriveSessionSummary(
  messages: Message[],
  status: SessionInfo["status"],
  lastTool?: string,
  errorCount?: number,
): string | undefined {
  const prompts = extractUserPrompts(messages);
  const latestPrompt = prompts[prompts.length - 1];
  const errorSuffix =
    errorCount && errorCount > 0
      ? ` · ${errorCount} error${errorCount > 1 ? "s" : ""}`
      : "";
  const prefix =
    status === "needs_attention"
      ? `needs attention${errorSuffix}`
      : `ready${errorSuffix}`;
  if (lastTool && latestPrompt) {
    return summarizeText(`${prefix} · ${lastTool} · ${latestPrompt}`, 120);
  }
  if (lastTool) {
    return summarizeText(`${prefix} · ${lastTool}`, 120);
  }
  if (latestPrompt) {
    return summarizeText(`${prefix} · ${latestPrompt}`, 120);
  }
  return status ? prefix : undefined;
}

function getSessionStatus(
  messages: Message[],
): Pick<
  SessionInfo,
  "status" | "lastTool" | "lastError" | "toolUseCount" | "errorCount"
> {
  let lastTool: string | undefined;
  let lastError: string | undefined;
  let toolUseCount = 0;
  let errorCount = 0;

  for (const message of messages) {
    if (message.type === "assistant") {
      for (const block of message.content) {
        if (block.type === "tool_use") {
          lastTool = block.name;
          toolUseCount += 1;
        }
      }
      continue;
    }

    if (message.type === "tool_result" && message.isError) {
      lastError = summarizeText(message.content, 160);
      errorCount += 1;
    }
  }

  return {
    status: lastError ? "needs_attention" : "ready",
    lastTool,
    lastError,
    toolUseCount,
    errorCount,
  };
}

function getConfiguredProvider(): string | undefined {
  return process.env.CCL_LLM_PROVIDER?.trim() || undefined;
}

function getConfiguredModel(): string | undefined {
  return process.env.CCL_LLM_MODEL?.trim() || undefined;
}

export async function readSessionInfo(
  cwd: string,
  sessionId: string,
): Promise<SessionInfo | null> {
  try {
    const content = await readFile(getSessionInfoPath(cwd, sessionId), "utf8");
    return JSON.parse(content) as SessionInfo;
  } catch {
    return null;
  }
}

export async function updateSessionInfo(
  cwd: string,
  sessionId: string,
  messages: Message[],
): Promise<SessionInfo> {
  const previous = await readSessionInfo(cwd, sessionId);
  const prompts = extractUserPrompts(messages);
  const now = new Date().toISOString();
  const sessionStatus = getSessionStatus(messages);
  const next: SessionInfo = {
    id: sessionId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    messageCount: messages.length,
    title: previous?.title || deriveSessionTitle(messages, sessionId),
    summary:
      deriveSessionSummary(
        messages,
        sessionStatus.status,
        sessionStatus.lastTool,
        sessionStatus.errorCount,
      ) || previous?.summary,
    firstPrompt: prompts[0],
    lastPrompt: prompts[prompts.length - 1],
    provider: getConfiguredProvider() || previous?.provider,
    model: getConfiguredModel() || previous?.model,
    ...sessionStatus,
  };

  await mkdir(getSessionsDir(cwd), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd, sessionId),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
  return next;
}

export async function listSessions(cwd: string): Promise<SessionInfo[]> {
  const infos = new Map<string, SessionInfo>();

  try {
    const entries = await readdir(getSessionsDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      const sessionId = entry.replace(/\.json$/, "");
      const info = await readSessionInfo(cwd, sessionId);
      if (info) {
        infos.set(sessionId, info);
      }
    }
  } catch {
    // ignore missing metadata dir
  }

  try {
    const entries = await readdir(getTranscriptsDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) {
        continue;
      }
      const sessionId = entry.replace(/\.jsonl$/, "");
      if (!infos.has(sessionId)) {
        infos.set(sessionId, { id: sessionId });
      }
      const current = infos.get(sessionId);
      if (current && !current.title && !current.updatedAt) {
        try {
          const content = await readFile(
            getTranscriptPath(cwd, sessionId),
            "utf8",
          );
          const messages = content
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line) as Message);
          const prompts = extractUserPrompts(messages);
          const sessionStatus = getSessionStatus(messages);
          infos.set(sessionId, {
            ...current,
            title: deriveSessionTitle(messages, sessionId),
            summary: deriveSessionSummary(
              messages,
              sessionStatus.status,
              sessionStatus.lastTool,
              sessionStatus.errorCount,
            ),
            firstPrompt: prompts[0],
            lastPrompt: prompts[prompts.length - 1],
            messageCount: messages.length,
            updatedAt:
              (
                await stat(getTranscriptPath(cwd, sessionId)).catch(() => null)
              )?.mtime.toISOString() || current.updatedAt,
            ...sessionStatus,
          });
        } catch {
          // ignore malformed transcript fallback
        }
      }
    }
  } catch {
    // ignore missing transcript dir
  }

  return [...infos.values()].sort((left, right) => {
    const leftRank = left.status === "needs_attention" ? 0 : 1;
    const rightRank = right.status === "needs_attention" ? 0 : 1;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftTime = left.updatedAt || left.createdAt || "";
    const rightTime = right.updatedAt || right.createdAt || "";
    return rightTime.localeCompare(leftTime);
  });
}

export async function deleteSessionInfo(
  cwd: string,
  sessionId: string,
): Promise<void> {
  await rm(getSessionInfoPath(cwd, sessionId), { force: true });
}

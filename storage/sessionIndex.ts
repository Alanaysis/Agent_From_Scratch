import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { join } from "path";
import type { Message } from "../runtime/messages";

export type SessionStatus = "idle" | "active" | "completed" | "error" | "archived";

export type SessionInfo = {
  id: string;
  title?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string;
  messageCount?: number;
  toolUseCount?: number;
  errorCount?: number;
  firstPrompt?: string;
  lastPrompt?: string;
  provider?: string;
  model?: string;
  status?: SessionStatus;
  lastTool?: string;
  lastError?: string;
  parentId?: string;
  taskId?: string;
  checkedInTasks?: string[];
};

function getSessionsDir(cwd: string): string {
  return join(cwd, ".irg", "sessions");
}

function getTranscriptsDir(cwd: string): string {
  return join(cwd, ".irg", "transcripts");
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
    .map((message) => {
      const text = typeof message.content === 'string' ? message.content : message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      return summarizeText(text, 120);
    });
}

function deriveSessionTitle(messages: Message[], sessionId: string): string {
  const firstUser = messages.find(
    (message): message is Extract<Message, { type: "user" }> =>
      message.type === "user",
  );
  if (firstUser) {
    const text = typeof firstUser.content === 'string' ? firstUser.content : firstUser.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return summarizeText(text, 72);
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
    status === "error"
      ? `needs attention${errorSuffix}`
      : status === "completed"
        ? `done${errorSuffix}`
        : status === "active"
          ? `active${errorSuffix}`
          : `idle${errorSuffix}`;
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

function getSessionMetadata(
  messages: Message[],
): Pick<
  SessionInfo,
  "lastTool" | "lastError" | "toolUseCount" | "errorCount"
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

  return { lastTool, lastError, toolUseCount, errorCount };
}

/** Determine session status from current state */
function deriveSessionStatus(
  previous: SessionInfo | null,
  metadata: { errorCount?: number },
  isActive: boolean,
  currentMessageCount = 0,
): SessionStatus {
  // If already archived, stay archived
  if (previous?.status === "archived") return "archived";
  // If currently being used, mark active
  if (isActive) return "active";
  // If has errors, mark error
  if ((metadata.errorCount ?? 0) > 0) return "error";
  // If has messages (completed conversation), mark completed
  if (currentMessageCount > 0 || (previous?.messageCount ?? 0) > 0) return "completed";
  // Default: idle
  return "idle";
}

function getConfiguredProvider(): string | undefined {
  return process.env.IRG_LLM_PROVIDER?.trim() || undefined;
}

function getConfiguredModel(): string | undefined {
  return process.env.IRG_LLM_MODEL?.trim() || undefined;
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

export async function createSession(
  cwd: string,
  sessionId: string,
  meta: {
    parentId?: string;
    taskId?: string;
    title?: string;
  },
): Promise<SessionInfo> {
  const now = new Date().toISOString();
  const next: SessionInfo = {
    id: sessionId,
    createdAt: now,
    updatedAt: now,
    title: meta.title || `session ${sessionId}`,
    parentId: meta.parentId,
    taskId: meta.taskId,
  };

  await mkdir(getSessionsDir(cwd), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd, sessionId),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
  return next;
}

export async function updateSessionInfo(
  cwd: string,
  sessionId: string,
  messages: Message[],
  isActive = false,
): Promise<SessionInfo> {
  const previous = await readSessionInfo(cwd, sessionId);
  const prompts = extractUserPrompts(messages);
  const now = new Date().toISOString();
  const metadata = getSessionMetadata(messages);
  const status = deriveSessionStatus(previous, metadata, isActive, messages.length);
  const next: SessionInfo = {
    id: sessionId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastActiveAt: isActive ? now : previous?.lastActiveAt,
    messageCount: messages.length,
    title: previous?.title || deriveSessionTitle(messages, sessionId),
    summary:
      deriveSessionSummary(
        messages,
        status,
        metadata.lastTool,
        metadata.errorCount,
      ) || previous?.summary,
    firstPrompt: prompts[0],
    lastPrompt: prompts[prompts.length - 1],
    provider: getConfiguredProvider() || previous?.provider,
    model: getConfiguredModel() || previous?.model,
    parentId: previous?.parentId,
    taskId: previous?.taskId,
    checkedInTasks: previous?.checkedInTasks,
    status,
    ...metadata,
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
          const metadata = getSessionMetadata(messages);
          const fallbackStatus = (metadata.errorCount ?? 0) > 0 ? "error" as SessionStatus : "completed" as SessionStatus;
          infos.set(sessionId, {
            ...current,
            title: deriveSessionTitle(messages, sessionId),
            summary: deriveSessionSummary(
              messages,
              fallbackStatus,
              metadata.lastTool,
              metadata.errorCount,
            ),
            firstPrompt: prompts[0],
            lastPrompt: prompts[prompts.length - 1],
            messageCount: messages.length,
            updatedAt:
              (
                await stat(getTranscriptPath(cwd, sessionId)).catch(() => null)
              )?.mtime.toISOString() || current.updatedAt,
            status: fallbackStatus,
            ...metadata,
          });
        } catch {
          // ignore malformed transcript fallback
        }
      }
    }
  } catch {
    // ignore missing transcript dir
  }

  // Mark stale active sessions as idle
  for (const [id, info] of infos) {
    if (isSessionStale(info)) {
      infos.set(id, { ...info, status: "idle" });
    }
  }

  // Sort: error first, then active, then by time
  const statusOrder: Record<string, number> = {
    error: 0,
    active: 1,
    completed: 2,
    idle: 3,
    archived: 4,
  };
  return [...infos.values()].sort((left, right) => {
    const leftRank = statusOrder[left.status ?? "idle"] ?? 3;
    const rightRank = statusOrder[right.status ?? "idle"] ?? 3;
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

export async function touchSession(
  cwd: string,
  sessionId: string,
): Promise<void> {
  const previous = await readSessionInfo(cwd, sessionId);
  if (!previous) return;
  const now = new Date().toISOString();
  const next = {
    ...previous,
    lastActiveAt: now,
    status: (previous.status === "archived" ? "archived" : "active") as SessionStatus,
  };
  await mkdir(getSessionsDir(cwd), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd, sessionId),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
}

export async function closeSession(
  cwd: string,
  sessionId: string,
): Promise<void> {
  const previous = await readSessionInfo(cwd, sessionId);
  if (!previous) return;
  const finalStatus: SessionStatus = (previous.errorCount ?? 0) > 0 ? "error" : "completed";
  const next = {
    ...previous,
    status: finalStatus,
    checkedInTasks: [],
  };
  await mkdir(getSessionsDir(cwd), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd, sessionId),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
}

export async function checkinToTask(
  cwd: string,
  sessionId: string,
  taskId: string,
): Promise<void> {
  const previous = await readSessionInfo(cwd, sessionId);
  if (!previous) return;
  const tasks = new Set(previous.checkedInTasks || []);
  tasks.add(taskId);
  const now = new Date().toISOString();
  const next = {
    ...previous,
    lastActiveAt: now,
    checkedInTasks: [...tasks],
    status: "active" as SessionStatus,
  };
  await mkdir(getSessionsDir(cwd), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd, sessionId),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
}

export async function checkoutFromTask(
  cwd: string,
  sessionId: string,
  taskId: string,
): Promise<void> {
  const previous = await readSessionInfo(cwd, sessionId);
  if (!previous) return;
  const tasks = (previous.checkedInTasks || []).filter((t) => t !== taskId);
  const next = {
    ...previous,
    checkedInTasks: tasks,
  };
  await mkdir(getSessionsDir(cwd), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd, sessionId),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
}

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export function isSessionStale(info: SessionInfo, thresholdMs = STALE_THRESHOLD_MS): boolean {
  if (info.status !== "active") return false;
  if (!info.lastActiveAt) return true;
  return Date.now() - new Date(info.lastActiveAt).getTime() > thresholdMs;
}

/** Add an `archiveSession` function for the new archived status */
export async function archiveSession(
  cwd: string,
  sessionId: string,
): Promise<void> {
  const previous = await readSessionInfo(cwd, sessionId);
  if (!previous) return;
  const next = {
    ...previous,
    status: "archived" as SessionStatus,
    checkedInTasks: [],
  };
  await mkdir(getSessionsDir(cwd), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd, sessionId),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
}

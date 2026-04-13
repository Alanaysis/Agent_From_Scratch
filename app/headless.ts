import { writeFile } from "fs/promises";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { createInitialAppState, type AppState } from "../runtime/state";
import type { AssistantMessage } from "../runtime/messages";
import { SessionEngine } from "../runtime/session";
import { canUseTool, rememberPermissionRule } from "../permissions/engine";
import { getTools } from "../tools/registry";
import { findToolByName, type Tool, type ToolUseContext } from "../tools/Tool";
import { createId } from "../shared/ids";
import type { SessionInfo } from "../storage/sessionIndex";
import {
  deleteSessionInfo,
  getSessionInfoFilePath,
  listSessions,
  readSessionInfo,
} from "../storage/sessionIndex";
import {
  deleteTranscript,
  getTranscriptPath,
  readTranscriptMessages,
} from "../storage/transcript";
import { readTextFile } from "../shared/fs";
import { query } from "../runtime/query";
import type { Message } from "../runtime/messages";

export type HeadlessOptions = {
  cwd: string;
  args: string[];
  autoApprove?: boolean;
  streamOutput?: boolean;
};

type MetaExecutionResult = {
  kind: "meta";
  output: string;
};

type UtilityExecutionResult = {
  kind: "utility";
  utilityName:
    | "sessions"
    | "transcript"
    | "inspect"
    | "export-session"
    | "rm-session"
    | "cleanup-sessions"
    | "chat";
  output: unknown;
};

type ExecutionHooks = {
  onAssistantTextDelta?: (text: string) => void;
  onMessage?: (message: Message) => void;
  abortController?: AbortController;
};

type CliExecutionResult = {
  kind: "tool";
  tool: string;
  input: unknown;
  output: unknown;
  transcriptPath: string;
};

type ParsedCommand =
  | {
      kind: "meta";
      output: string;
    }
  | {
      kind: "utility";
      utilityName:
        | "sessions"
        | "transcript"
        | "inspect"
        | "export-session"
        | "rm-session"
        | "cleanup-sessions"
        | "chat";
      args: string[];
    }
  | {
      kind: "tool";
      toolName: string;
      toolInput: unknown;
    };

type ChatCommandOptions = {
  prompt: string;
  sessionId?: string;
};

type ExportCommandOptions = {
  sessionId: string;
  format: "markdown" | "json";
  outputPath?: string;
};

type CleanupCommandOptions = {
  keep?: number;
  olderThanDays?: number;
  dryRun?: boolean;
  status?: SessionInfo["status"];
};

type SessionsCommandOptions = {
  limit?: number;
  status?: SessionInfo["status"];
};

export function parseTranscript(text: string): unknown[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return line;
      }
    });
}

export function formatSessionList(
  sessions: SessionInfo[],
  options?: SessionsCommandOptions,
): string {
  if (sessions.length === 0) {
    return "No sessions found.";
  }

  const lines = sessions
    .map((session) => {
      const marker = session.status === "needs_attention" ? "!" : "-";
      const updated = session.updatedAt || session.createdAt || "-";
      const title = session.title || session.id;
      const model =
        session.provider || session.model
          ? ` · ${session.provider || "?"}/${session.model || "?"}`
          : "";
      const count =
        session.messageCount !== undefined
          ? ` · ${session.messageCount} msg`
          : "";
      const stats =
        session.toolUseCount !== undefined || session.errorCount !== undefined
          ? ` · tools:${session.toolUseCount ?? 0} · errors:${session.errorCount ?? 0}`
          : "";
      const status = session.status ? ` · ${session.status}` : "";
      const lastTool = session.lastTool
        ? `\n    last tool: ${session.lastTool}`
        : "";
      const lastError = session.lastError
        ? `\n    last error: ${session.lastError}`
        : "";
      const summary = session.summary
        ? `\n    summary: ${session.summary}`
        : "";
      const prompt = session.lastPrompt ? `\n    ${session.lastPrompt}` : "";
      return `${marker} ${session.id} · ${updated}${count}${stats}${model}${status}\n    ${title}${summary}${prompt}${lastTool}${lastError}`;
    })
    .join("\n");

  const filters = [
    options?.status ? `status=${options.status}` : "",
    options?.limit !== undefined ? `limit=${options.limit}` : "",
  ].filter(Boolean);
  return filters.length > 0 ? `[${filters.join(", ")}]\n${lines}` : lines;
}

export function formatSessionMetadata(session: SessionInfo): string {
  return [
    `session: ${session.id}`,
    `title: ${session.title || session.id}`,
    `summary: ${session.summary || "-"}`,
    `created: ${session.createdAt || "-"}`,
    `updated: ${session.updatedAt || "-"}`,
    `messages: ${session.messageCount ?? "-"}`,
    `tools/errors: ${session.toolUseCount ?? 0} / ${session.errorCount ?? 0}`,
    `provider/model: ${session.provider || "-"} / ${session.model || "-"}`,
    `status: ${session.status || "-"}`,
    `first prompt: ${session.firstPrompt || "-"}`,
    `last prompt: ${session.lastPrompt || "-"}`,
    `last tool: ${session.lastTool || "-"}`,
    `last error: ${session.lastError || "-"}`,
  ].join("\n");
}

export function clipText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function formatExportMessageEntry(message: Message): string {
  if (message.type === "user") {
    return `user: ${clipText(message.content, 240)}`;
  }

  if (message.type === "tool_result") {
    const status = message.isError ? "tool_error" : "tool_result";
    return `${status}(${message.toolUseId}): ${summarizeUnknown(message.content, 400)}`;
  }

  return message.content
    .map((block) =>
      block.type === "text"
        ? `assistant: ${clipText(block.text, 400)}`
        : `tool_use(${block.id}): ${block.name} ${summarizeToolInput(block.input)}`,
    )
    .join(" | ");
}

export function formatInspectView(
  cwd: string,
  session: SessionInfo,
  messages: Message[],
  recentCount = 8,
): string {
  const recentMessages = messages.slice(-recentCount);
  const errors = messages.filter(
    (message): message is Extract<Message, { type: "tool_result" }> =>
      message.type === "tool_result" && Boolean(message.isError),
  );
  const recentErrors = errors.slice(-3);

  return [
    "Session Inspect",
    "===============",
    formatSessionMetadata(session),
    "",
    "recent messages:",
    recentMessages.length > 0
      ? formatTranscriptMessages(recentMessages, true)
      : "(none)",
    "",
    "recent errors:",
    recentErrors.length > 0
      ? recentErrors
          .map(
            (message, index) =>
              `${index + 1}. ${summarizeUnknown(message.content, 200)}`,
          )
          .join("\n")
      : "(none)",
    "",
    `metadata file: ${getSessionInfoFilePath(cwd, session.id)}`,
    `transcript file: ${getTranscriptPath(cwd, session.id)}`,
  ].join("\n");
}

export function formatCleanupSummary(
  removed: SessionInfo[],
  skippedCount: number,
  dryRun = false,
): string {
  if (removed.length === 0) {
    return skippedCount > 0
      ? `No sessions removed. ${skippedCount} session(s) kept.`
      : "No sessions removed.";
  }

  return [
    `${dryRun ? "Would remove" : "Removed"} ${removed.length} session(s):`,
    ...removed.map((session) => {
      const updated = session.updatedAt || session.createdAt || "-";
      return `- ${session.id} · ${updated} · ${session.title || session.id}`;
    }),
    skippedCount > 0 ? `Kept ${skippedCount} session(s).` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatMarkdownExport(
  session: SessionInfo,
  messages: Message[],
): string {
  return [
    `# Session ${session.id}`,
    "",
    "## Metadata",
    "",
    `- Title: ${session.title || session.id}`,
    `- Summary: ${session.summary || "-"}`,
    `- Created: ${session.createdAt || "-"}`,
    `- Updated: ${session.updatedAt || "-"}`,
    `- Messages: ${session.messageCount ?? messages.length}`,
    `- Tools/Errors: ${session.toolUseCount ?? 0} / ${session.errorCount ?? 0}`,
    `- Provider/Model: ${session.provider || "-"} / ${session.model || "-"}`,
    `- Status: ${session.status || "-"}`,
    `- First Prompt: ${session.firstPrompt || "-"}`,
    `- Last Prompt: ${session.lastPrompt || "-"}`,
    `- Last Tool: ${session.lastTool || "-"}`,
    `- Last Error: ${session.lastError || "-"}`,
    "",
    "## Transcript",
    "",
    ...messages.map(
      (message, index) => `${index + 1}. ${formatExportMessageEntry(message)}`,
    ),
    "",
  ].join("\n");
}

export function formatJsonExport(session: SessionInfo, messages: Message[]): string {
  return JSON.stringify(
    {
      session,
      messages: messages.map((message) => ({
        ...message,
        ...(message.type === "user"
          ? { content: clipText(message.content, 240) }
          : message.type === "tool_result"
            ? { content: summarizeUnknown(message.content, 400) }
            : {
                content: message.content.map((block) =>
                  block.type === "text"
                    ? {
                        ...block,
                        text: clipText(block.text, 400),
                      }
                    : block,
                ),
              }),
      })),
    },
    null,
    2,
  );
}

export function formatTranscriptEntry(message: Message): string {
  if (message.type === "user") {
    return `user: ${message.content}`;
  }

  if (message.type === "tool_result") {
    const status = message.isError ? "tool_error" : "tool_result";
    return `${status}(${message.toolUseId}): ${summarizeUnknown(message.content, 240)}`;
  }

  return message.content
    .map((block) =>
      block.type === "text"
        ? `assistant: ${block.text}`
        : `tool_use(${block.id}): ${block.name} ${summarizeToolInput(block.input)}`,
    )
    .join("\n");
}

export function formatTranscriptMessages(
  messages: Message[],
  compact = false,
): string {
  if (messages.length === 0) {
    return "Transcript is empty.";
  }

  if (compact) {
    return messages
      .map((message, index) => {
        if (message.type === "user") {
          return `${index + 1}. user: ${summarizeUnknown(message.content, 120)}`;
        }
        if (message.type === "tool_result") {
          const status = message.isError ? "tool_error" : "tool_result";
          return `${index + 1}. ${status}: ${summarizeUnknown(message.content, 120)}`;
        }
        const summary = message.content
          .map((block) =>
            block.type === "text"
              ? summarizeUnknown(block.text, 120)
              : `${block.name} ${summarizeToolInput(block.input)}`,
          )
          .join(" | ");
        return `${index + 1}. assistant: ${summary}`;
      })
      .join("\n");
  }

  return messages
    .map((message, index) => `${index + 1}. ${formatTranscriptEntry(message)}`)
    .join("\n\n");
}

export function parseCommand(argv: string[]): ParsedCommand {
  const [command, ...rest] = argv;
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      return {
        kind: "meta",
        output: formatHelp(),
      };
    case "--version":
    case "-v":
      return {
        kind: "meta",
        output: "claude-code-lite 0.1.0",
      };
    case "tools":
      return {
        kind: "meta",
        output: `Available tools: ${getTools()
          .map((tool) => tool.name)
          .join(", ")}`,
      };
    case "sessions":
      return {
        kind: "utility",
        utilityName: "sessions",
        args: rest,
      };
    case "transcript":
      return {
        kind: "utility",
        utilityName: "transcript",
        args: rest,
      };
    case "inspect":
      return {
        kind: "utility",
        utilityName: "inspect",
        args: rest,
      };
    case "export-session":
      return {
        kind: "utility",
        utilityName: "export-session",
        args: rest,
      };
    case "rm-session":
      return {
        kind: "utility",
        utilityName: "rm-session",
        args: rest,
      };
    case "cleanup-sessions":
      return {
        kind: "utility",
        utilityName: "cleanup-sessions",
        args: rest,
      };
    case "chat":
      return {
        kind: "utility",
        utilityName: "chat",
        args: rest,
      };
    case "read":
      return {
        kind: "tool",
        toolName: "Read",
        toolInput: { path: rest[0] ?? "" },
      };
    case "write":
      return {
        kind: "tool",
        toolName: "Write",
        toolInput: {
          path: rest[0] ?? "",
          content: rest.slice(1).join(" "),
        },
      };
    case "edit":
      return {
        kind: "tool",
        toolName: "Edit",
        toolInput: {
          path: rest[0] ?? "",
          oldString: rest[1] ?? "",
          newString: rest.slice(2).join(" "),
        },
      };
    case "shell":
      return {
        kind: "tool",
        toolName: "Shell",
        toolInput: { command: rest.join(" ") },
      };
    case "fetch":
      return {
        kind: "tool",
        toolName: "WebFetch",
        toolInput: {
          url: rest[0] ?? "",
          prompt: rest.slice(1).join(" "),
        },
      };
    case "agent":
      return {
        kind: "tool",
        toolName: "Agent",
        toolInput: {
          description: rest[0] ?? "",
          prompt: rest[1] ?? "",
          subagentType: rest[2],
        },
      };
    case "tool":
      return {
        kind: "tool",
        toolName: rest[0] ?? "",
        toolInput: JSON.parse(rest.slice(1).join(" ") || "{}"),
      };
    default:
      throw new Error(`Unknown command "${command}".\n\n${formatHelp()}`);
  }
}



export function formatHelp(): string {
  return [
    "Claude Code-lite CLI",
    "",
    "Commands:",
    "  help",
    "  --help, -h",
    "  --version, -v",
    "  tools",
    "  sessions [--limit N] [--status ready|needs_attention]",
    "  transcript <sessionId> [--compact]",
    "  inspect <sessionId>",
    "  export-session <sessionId> [--format markdown|json] [--output path]",
    "  rm-session <sessionId>",
    "  cleanup-sessions [--keep N] [--older-than DAYS] [--status ready|needs_attention] [--dry-run]",
    "  chat [--resume latest|<sessionId>|failed] <prompt...>",
    "  read <path>",
    "  write <path> <content>",
    "  edit <path> <oldString> <newString>",
    "  shell <command...>",
    "  fetch <url> [prompt]",
    "  agent <description> <prompt> [subagentType]",
    "  tool <ToolName> <json>",
    "",
    "Options:",
    "  --yes   Auto-approve mutating tools in default mode",
    "  --stream   Stream chat output to stdout",
    "  --no-stream   Disable streaming chat output",
    "",
    "LLM env:",
    "  CCL_LLM_PROVIDER   openai | anthropic, defaults to openai",
    "  CCL_LLM_API_KEY",
    "  CCL_LLM_MODEL",
    "  CCL_LLM_BASE_URL   Optional, defaults to https://api.openai.com/v1",
    "  CCL_LLM_SYSTEM_PROMPT   Optional extra system prompt",
    "  CCL_ANTHROPIC_VERSION   Optional, defaults to 2023-06-01",
  ].join("\n");
}

export function summarizeUnknown(value: unknown, maxLength = 120): string {
  const text =
    typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "");
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function summarizeToolInput(input: unknown): string {
  if (typeof input !== "object" || input === null) {
    return summarizeUnknown(input, 60);
  }

  if ("path" in input && typeof input.path === "string") {
    return input.path;
  }

  if ("command" in input && typeof input.command === "string") {
    return summarizeUnknown(input.command, 60);
  }

  if ("url" in input && typeof input.url === "string") {
    return input.url;
  }

  if ("description" in input && typeof input.description === "string") {
    return summarizeUnknown(input.description, 60);
  }

  return summarizeUnknown(input, 60);
}

export function summarizeToolResult(message: Message): string {
  if (message.type !== "tool_result") {
    return "";
  }
  return summarizeUnknown(message.content, 80);
}

export async function resolveSessionIdArg(
  cwd: string,
  rawSession: string | undefined,
): Promise<string | undefined> {
  if (!rawSession) {
    return undefined;
  }
  if (rawSession === "latest") {
    const sessions = await listSessions(cwd);
    return sessions[0]?.id;
  }
  if (rawSession === "failed") {
    const sessions = await listSessions(cwd);
    return sessions.find((session) => session.status === "needs_attention")?.id;
  }
  return rawSession;
}

export async function resolveSessionIdForChat(
  cwd: string,
  rawSession: string | undefined,
): Promise<string | undefined> {
  return resolveSessionIdArg(cwd, rawSession);
}

export async function parseChatCommandOptions(
  cwd: string,
  args: string[],
): Promise<ChatCommandOptions> {
  let sessionRef: string | undefined;
  const promptParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--resume" || arg === "--session") {
      sessionRef = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--resume-failed") {
      sessionRef = "failed";
      continue;
    }
    promptParts.push(arg);
  }

  const prompt = promptParts.join(" ").trim();
  if (!prompt) {
    throw new Error("chat requires a prompt");
  }

  const sessionId = await resolveSessionIdForChat(cwd, sessionRef);
  if (sessionRef && !sessionId) {
    throw new Error("No resumable session found");
  }

  return {
    prompt,
    sessionId,
  };
}

export async function parseExportCommandOptions(
  cwd: string,
  args: string[],
): Promise<ExportCommandOptions> {
  const rawSession = args[0];
  if (!rawSession) {
    throw new Error("export-session requires a sessionId");
  }
  let format: "markdown" | "json" = "markdown";
  let outputPath: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--format") {
      const value = args[index + 1];
      if (value !== "markdown" && value !== "json") {
        throw new Error(
          'export-session --format requires "markdown" or "json"',
        );
      }
      format = value;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      outputPath = args[index + 1];
      if (!outputPath) {
        throw new Error("export-session --output requires a path");
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown export-session option "${arg}"`);
  }

  const sessionId = await resolveSessionIdArg(cwd, rawSession);
  if (!sessionId) {
    throw new Error("No exportable session found");
  }

  return { sessionId, format, outputPath };
}

export function buildSyntheticAssistant(
  toolName: string,
  toolInput: unknown,
): AssistantMessage {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: [
      {
        type: "tool_use",
        id: createId("tool-use"),
        name: toolName,
        input: toolInput,
      },
    ],
  };
}

export async function confirmOrThrow(
  message: string,
  autoApprove: boolean,
): Promise<void> {
  if (autoApprove) return;
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`${message}. Re-run with --yes to auto-approve.`);
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) {
      throw new Error("Operation cancelled by user");
    }
  } finally {
    rl.close();
  }
}

export function parseCleanupCommandOptions(args: string[]): CleanupCommandOptions {
  let keep: number | undefined;
  let olderThanDays: number | undefined;
  let dryRun = false;
  let status: SessionInfo["status"] | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--keep") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(
          "cleanup-sessions --keep requires a non-negative number",
        );
      }
      keep = value;
      index += 1;
      continue;
    }
    if (arg === "--older-than") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(
          "cleanup-sessions --older-than requires a non-negative number",
        );
      }
      olderThanDays = value;
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const value = args[index + 1];
      if (value !== "ready" && value !== "needs_attention") {
        throw new Error(
          'cleanup-sessions --status requires "ready" or "needs_attention"',
        );
      }
      status = value;
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown cleanup-sessions option "${arg}"`);
  }

  if (keep === undefined && olderThanDays === undefined) {
    throw new Error("cleanup-sessions requires --keep N or --older-than DAYS");
  }

  return { keep, olderThanDays, dryRun, status };
}

export function parseSessionsCommandOptions(args: string[]): SessionsCommandOptions {
  let limit: number | undefined;
  let status: SessionInfo["status"] | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("sessions --limit requires a non-negative number");
      }
      limit = value;
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const value = args[index + 1];
      if (value !== "ready" && value !== "needs_attention") {
        throw new Error(
          'sessions --status requires "ready" or "needs_attention"',
        );
      }
      status = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown sessions option "${arg}"`);
  }

  return { limit, status };
}

export async function deleteSessionArtifacts(
  cwd: string,
  sessionId: string,
): Promise<void> {
  await Promise.all([
    deleteSessionInfo(cwd, sessionId),
    deleteTranscript(cwd, sessionId),
  ]);
}

export async function confirmWithSessionRule<Input>(
  message: string,
  autoApprove: boolean,
  tool: Tool<Input, unknown>,
  inputValue: Input,
  context: ToolUseContext,
): Promise<void> {
  if (autoApprove) return;
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`${message}. Re-run with --yes to auto-approve.`);
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `${message} [y] once / [a] session / [N] `,
    );
    const normalized = answer.trim().toLowerCase();
    if (normalized === "a" || normalized === "always") {
      rememberPermissionRule(context, tool, inputValue);
      return;
    }
    if (normalized === "y" || normalized === "yes") {
      return;
    }
    throw new Error("Operation cancelled by user");
  } finally {
    rl.close();
  }
}

export function createToolContext(
  cwd: string,
  appStateRef: { current: AppState },
  session: SessionEngine,
  abortController?: AbortController,
): ToolUseContext {
  return {
    cwd,
    abortController: abortController ?? new AbortController(),
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    },
  };
}

export async function executeCliCommand(
  cwd: string,
  argv: string[],
  autoApprove = false,
  hooks?: ExecutionHooks,
): Promise<CliExecutionResult | MetaExecutionResult | UtilityExecutionResult> {
  const parsed = parseCommand(argv);
  if (parsed.kind === "meta") {
    return parsed;
  }
  if (parsed.kind === "utility") {
    if (parsed.utilityName === "sessions") {
      const options = parseSessionsCommandOptions(parsed.args);
      let sessions = await listSessions(cwd);
      if (options.status) {
        sessions = sessions.filter(
          (session) => session.status === options.status,
        );
      }
      if (options.limit !== undefined) {
        sessions = sessions.slice(0, options.limit);
      }
      return {
        kind: "utility",
        utilityName: "sessions",
        output: formatSessionList(sessions, options),
      };
    }

    if (parsed.utilityName === "transcript") {
      const sessionId = parsed.args[0];
      if (!sessionId) {
        throw new Error("transcript requires a sessionId");
      }
      const compact = parsed.args.includes("--compact");

      return {
        kind: "utility",
        utilityName: "transcript",
        output: formatTranscriptMessages(
          parseTranscript(
            await readTextFile(getTranscriptPath(cwd, sessionId)),
          ) as Message[],
          compact,
        ),
      };
    }

    if (parsed.utilityName === "inspect") {
      const sessionId = await resolveSessionIdArg(cwd, parsed.args[0]);
      if (!sessionId) {
        throw new Error("inspect requires a sessionId");
      }
      const messages = await readTranscriptMessages(cwd, sessionId).catch(
        () => [] as Message[],
      );
      const info =
        (await readSessionInfo(cwd, sessionId)) ||
        (await listSessions(cwd)).find((session) => session.id === sessionId);
      if (!info) {
        throw new Error(`Session "${sessionId}" not found`);
      }
      return {
        kind: "utility",
        utilityName: "inspect",
        output: formatInspectView(cwd, info, messages),
      };
    }

    if (parsed.utilityName === "export-session") {
      const options = await parseExportCommandOptions(cwd, parsed.args);
      const messages = await readTranscriptMessages(
        cwd,
        options.sessionId,
      ).catch(() => [] as Message[]);
      const info =
        (await readSessionInfo(cwd, options.sessionId)) ||
        (await listSessions(cwd)).find(
          (session) => session.id === options.sessionId,
        );
      if (!info) {
        throw new Error(`Session "${options.sessionId}" not found`);
      }
      const content =
        options.format === "json"
          ? formatJsonExport(info, messages)
          : formatMarkdownExport(info, messages);

      if (options.outputPath) {
        await writeFile(options.outputPath, `${content}\n`, "utf8");
      }

      return {
        kind: "utility",
        utilityName: "export-session",
        output: options.outputPath
          ? `Exported ${options.sessionId} to ${options.outputPath}`
          : content,
      };
    }

    if (parsed.utilityName === "rm-session") {
      const sessionId = await resolveSessionIdArg(cwd, parsed.args[0]);
      if (!sessionId) {
        throw new Error("rm-session requires a sessionId");
      }
      await confirmOrThrow(
        `Delete session ${sessionId} and its transcript`,
        autoApprove,
      );
      const info =
        (await readSessionInfo(cwd, sessionId)) ||
        (await listSessions(cwd)).find((session) => session.id === sessionId) ||
        ({ id: sessionId } satisfies SessionInfo);
      await deleteSessionArtifacts(cwd, sessionId);
      return {
        kind: "utility",
        utilityName: "rm-session",
        output: `Removed session ${sessionId}${info.title ? ` · ${info.title}` : ""}`,
      };
    }

    if (parsed.utilityName === "cleanup-sessions") {
      const options = parseCleanupCommandOptions(parsed.args);
      const sessions = await listSessions(cwd);
      const now = Date.now();
      const candidates = sessions.filter((session, index) => {
        if (options.status && session.status !== options.status) {
          return false;
        }
        const byKeep =
          options.keep !== undefined ? index >= options.keep : false;
        const timestamp = session.updatedAt || session.createdAt;
        const ageMs = timestamp ? now - Date.parse(timestamp) : 0;
        const byAge =
          options.olderThanDays !== undefined
            ? ageMs >= options.olderThanDays * 24 * 60 * 60 * 1000
            : false;
        return byKeep || byAge;
      });

      if (candidates.length === 0) {
        return {
          kind: "utility",
          utilityName: "cleanup-sessions",
          output: formatCleanupSummary([], sessions.length, options.dryRun),
        };
      }

      if (!options.dryRun) {
        await confirmOrThrow(
          `Remove ${candidates.length} session(s) matching cleanup rule`,
          autoApprove,
        );
        for (const candidate of candidates) {
          await deleteSessionArtifacts(cwd, candidate.id);
        }
      }
      return {
        kind: "utility",
        utilityName: "cleanup-sessions",
        output: formatCleanupSummary(
          candidates,
          Math.max(sessions.length - candidates.length, 0),
          options.dryRun,
        ),
      };
    }

    const chat = await parseChatCommandOptions(cwd, parsed.args);
    const session = new SessionEngine({
      id: chat.sessionId ?? createId("session"),
      cwd,
    });
    if (chat.sessionId) {
      session.hydrateMessages(
        await readTranscriptMessages(cwd, chat.sessionId),
      );
    }
    const appStateRef = { current: createInitialAppState() };
    const context = createToolContext(
      cwd,
      appStateRef,
      session,
      hooks?.abortController,
    );
    const userMessage: Message = {
      id: createId("user"),
      type: "user",
      content: chat.prompt,
    };
    await session.recordMessages([userMessage]);

    const producedMessages: Message[] = [];
    for await (const message of query({
      prompt: chat.prompt,
      messages: session.getMessages(),
      systemPrompt: [],
      toolUseContext: context,
      canUseTool,
      onAssistantTextDelta: hooks?.onAssistantTextDelta,
      onPermissionRequest: async (request) => {
        if (autoApprove) {
          return true;
        }
        const tool = findToolByName(getTools(), request.toolName);
        if (!tool) {
          throw new Error(`Unknown tool "${request.toolName}"`);
        }
        await confirmWithSessionRule(
          request.message,
          autoApprove,
          tool as never,
          request.input as never,
          context,
        );
        return true;
      },
    })) {
      producedMessages.push(message);
      hooks?.onMessage?.(message);
    }
    if (producedMessages.length > 0) {
      await session.recordMessages(producedMessages);
    }

    return {
      kind: "utility",
      utilityName: "chat",
      output: {
        messages: producedMessages,
        transcriptPath: session.getTranscriptPath(),
      },
    };
  }

  const { toolName, toolInput } = parsed;
  const tool = findToolByName(getTools(), toolName);
  if (!tool) {
    throw new Error(`Unknown tool "${toolName}"`);
  }

  const session = new SessionEngine({
    id: createId("session"),
    cwd,
  });
  const appStateRef = { current: createInitialAppState() };
  const context = createToolContext(
    cwd,
    appStateRef,
    session,
    hooks?.abortController,
  );
  const assistantMessage = buildSyntheticAssistant(toolName, toolInput);
  const toolUseId = (assistantMessage.content[0] as { id: string }).id;

  await session.recordMessages([assistantMessage]);
  const permissionDecision = await canUseTool(
    tool as never,
    toolInput as never,
    context,
    assistantMessage,
    toolUseId,
  );

  if (permissionDecision.behavior === "deny") {
    throw new Error(permissionDecision.message);
  }

  if (permissionDecision.behavior === "ask") {
    await confirmWithSessionRule(
      permissionDecision.message,
      autoApprove,
      tool as never,
      toolInput as never,
      context,
    );
  }

  const effectiveInput =
    permissionDecision.behavior === "allow" && permissionDecision.updatedInput
      ? permissionDecision.updatedInput
      : toolInput;

  const result = await tool.call(
    effectiveInput as never,
    context,
    canUseTool,
    assistantMessage,
  );

  await session.recordMessages([
    {
      id: createId("tool-result"),
      type: "tool_result",
      toolUseId,
      content: JSON.stringify(result.data, null, 2),
    },
    ...(result.extraMessages ?? []),
  ]);

  return {
    kind: "tool",
    tool: tool.name,
    input: effectiveInput,
    output: result.data,
    transcriptPath: session.getTranscriptPath(),
  };
}

export async function runHeadless(options: HeadlessOptions): Promise<void> {
  const shouldStream =
    options.streamOutput ?? (options.args[0] === "chat" && output.isTTY);
  let lastAssistantText = "";
  const toolSummaries = new Map<string, string>();
  const abortController = new AbortController();
  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
    abortController.abort(new Error("User interrupted current turn"));
  };
  process.on("SIGINT", onSigint);
  try {
    const result = await executeCliCommand(
      options.cwd,
      options.args,
      options.autoApprove ?? false,
      shouldStream
        ? {
            abortController,
            onAssistantTextDelta: (text) => {
              const delta = text.slice(lastAssistantText.length);
              if (delta) {
                output.write(delta);
                lastAssistantText = text;
              }
            },
            onMessage: (message) => {
              if (message.type === "assistant") {
                const toolUses = message.content.filter(
                  (block) => block.type === "tool_use",
                );
                if (toolUses.length > 0) {
                  if (lastAssistantText) {
                    output.write("\n");
                  }
                  for (const toolUse of toolUses) {
                    const summary =
                      `${toolUse.name} ${summarizeToolInput(toolUse.input)}`.trim();
                    toolSummaries.set(toolUse.id, summary);
                    output.write(`[tool:start] ${summary}\n`);
                  }
                  lastAssistantText = "";
                }
                return;
              }

              if (message.type === "tool_result" && message.isError) {
                const summary =
                  toolSummaries.get(message.toolUseId) || message.toolUseId;
                output.write(
                  `[tool:error] ${summary} · ${summarizeToolResult(message)}\n`,
                );
                toolSummaries.delete(message.toolUseId);
                return;
              }

              if (message.type === "tool_result") {
                const summary =
                  toolSummaries.get(message.toolUseId) || message.toolUseId;
                output.write(
                  `[tool:done] ${summary} · ${summarizeToolResult(message)}\n`,
                );
                toolSummaries.delete(message.toolUseId);
                return;
              }
            },
          }
        : { abortController },
    );

    if (result.kind === "meta") {
      output.write(`${result.output}\n`);
      return;
    }
    if (result.kind === "utility") {
      if (shouldStream && result.utilityName === "chat") {
        const transcriptPath =
          typeof result.output === "object" &&
          result.output !== null &&
          "transcriptPath" in result.output &&
          typeof result.output.transcriptPath === "string"
            ? result.output.transcriptPath
            : undefined;
        if (lastAssistantText) {
          output.write("\n");
        }
        if (interrupted) {
          output.write("[interrupt] current turn aborted\n");
        }
        if (transcriptPath) {
          output.write(`[transcript] ${transcriptPath}\n`);
        }
        return;
      }
      if (typeof result.output === "string") {
        output.write(`${result.output}\n`);
      } else {
        output.write(`${JSON.stringify(result.output, null, 2)}\n`);
      }
      return;
    }
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    if (abortController.signal.aborted) {
      if (lastAssistantText) {
        output.write("\n");
      }
      output.write("[interrupt] current turn aborted\n");
      return;
    }
    throw error;
  } finally {
    process.off("SIGINT", onSigint);
  }
}

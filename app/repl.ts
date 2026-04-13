import readline from "readline/promises";

// Export for testing purposes - allows dependency injection
export const processStdin = process.stdin;
export const processStdout = process.stdout;
import { createInitialAppState, type AppState } from "../runtime/state";
import { SessionEngine } from "../runtime/session";
import { canUseTool, rememberPermissionRule } from "../permissions/engine";
import { query } from "../runtime/query";
import { createId } from "../shared/ids";
import type { Message } from "../runtime/messages";
import { getTools } from "../tools/registry";
import { findToolByName, type ToolUseContext } from "../tools/Tool";
import { formatHelp, executeCliCommand } from "./headless";
import { listSessions } from "../storage/sessionIndex";
import { readTranscriptMessages } from "../storage/transcript";

export type ReplOptions = {
  cwd: string;
  autoApprove?: boolean;
};

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

export function createContext(
  cwd: string,
  session: SessionEngine,
  appStateRef: { current: AppState },
  abortController: AbortController,
): ToolUseContext {
  return {
    cwd,
    abortController,
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    },
  };
}

export async function resolveResumeTarget(
  cwd: string,
  raw: string | undefined,
): Promise<string | undefined> {
  if (!raw) {
    return undefined;
  }
  if (raw === "latest") {
    const sessions = await listSessions(cwd);
    return sessions[0]?.id;
  }
  return raw;
}

export async function startRepl(
  options: ReplOptions,
  { stdin = processStdin, stdout = processStdout }: { stdin?: any; stdout?: any } = {},
): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const appStateRef = { current: createInitialAppState() };
  let session = new SessionEngine({
    id: createId("session"),
    cwd: options.cwd,
  });
  let activeAbortController: AbortController | null = null;
  let interrupted = false;

  stdout.write(`${formatHelp()}\n\n`);
  stdout.write(
    [
      "REPL commands:",
      "  /help",
      "  /new",
      "  /sessions [--limit N] [--status ready|needs_attention]",
      "  /inspect <sessionId>",
      "  /export-session <sessionId> [--format markdown|json] [--output path]",
      "  /rm-session <sessionId>",
      "  /cleanup-sessions --keep N | --older-than DAYS [--status ...] [--dry-run]",
      "  /resume latest",
      "  /resume failed",
      "  /resume <sessionId>",
      "  /quit",
      "",
    ].join("\n"),
  );

  const onSigint = () => {
    if (activeAbortController) {
      interrupted = true;
      activeAbortController.abort(new Error("User interrupted current turn"));
      stdout.write("\n[interrupt] abort requested\n");
      return;
    }
    rl.close();
  };
  process.on("SIGINT", onSigint);

  try {
    for (;;) {
      const line = await rl.question(`cc-lite:${session.sessionId}> `);
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "exit" || trimmed === "quit" || trimmed === "/quit") {
        break;
      }

      if (trimmed === "/help") {
        stdout.write(
          [
            "REPL commands:",
            "  /help",
            "  /new",
            "  /sessions [--limit N] [--status ready|needs_attention]",
            "  /inspect <sessionId>",
            "  /export-session <sessionId> [--format markdown|json] [--output path]",
            "  /rm-session <sessionId>",
            "  /cleanup-sessions --keep N | --older-than DAYS [--status ...] [--dry-run]",
            "  /resume latest",
            "  /resume failed",
            "  /resume <sessionId>",
            "  /quit",
            "",
          ].join("\n"),
        );
        continue;
      }

      if (trimmed === "/new") {
        appStateRef.current = createInitialAppState();
        session = new SessionEngine({
          id: createId("session"),
          cwd: options.cwd,
        });
        stdout.write(`started ${session.sessionId}\n`);
        continue;
      }

      if (trimmed === "/sessions") {
        const result = await executeCliCommand(
          options.cwd,
          ["sessions"],
          options.autoApprove ?? false,
        );
        stdout.write(
          `${typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)}\n`,
        );
        continue;
      }

      if (trimmed.startsWith("/resume")) {
        const [, rawTarget] = trimmed.split(/\s+/, 2);
        const target = await resolveResumeTarget(options.cwd, rawTarget);
        if (!target) {
          stdout.write("no resumable session found\n");
          continue;
        }
        appStateRef.current = createInitialAppState();
        session = new SessionEngine({
          id: target,
          cwd: options.cwd,
        });
        session.hydrateMessages(
          await readTranscriptMessages(options.cwd, target),
        );
        stdout.write(`resumed ${target}\n`);
        continue;
      }

      try {
        if (trimmed.startsWith("/")) {
          const result = await executeCliCommand(
            options.cwd,
            trimmed.slice(1).trim().split(/\s+/),
            options.autoApprove ?? false,
          );
          stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          continue;
        }

        const userMessage: Message = {
          id: createId("user"),
          type: "user",
          content: trimmed,
        };
        await session.recordMessages([userMessage]);

        let lastAssistantText = "";
        const toolSummaries = new Map<string, string>();
        activeAbortController = new AbortController();
        interrupted = false;
        for await (const message of query({
          prompt: trimmed,
          messages: session.getMessages(),
          systemPrompt: [],
          toolUseContext: createContext(
            options.cwd,
            session,
            appStateRef,
            activeAbortController,
          ),
          canUseTool,
          onAssistantTextDelta: (text) => {
            const delta = text.slice(lastAssistantText.length);
            if (delta) {
              stdout.write(delta);
              lastAssistantText = text;
            }
          },
          onPermissionRequest: async (request) => {
            if (options.autoApprove) {
              return true;
            }
            const tool = findToolByName(getTools(), request.toolName);
            if (!tool) {
              return false;
            }
            const answer = await rl.question(
              `${request.message} [y] once / [a] session / [N] `,
            );
            const normalized = answer.trim().toLowerCase();
            if (normalized === "a" || normalized === "always") {
              rememberPermissionRule(
                createContext(
                  options.cwd,
                  session,
                  appStateRef,
                  activeAbortController ?? new AbortController(),
                ),
                tool as never,
                request.input as never,
              );
              return true;
            }
            return normalized === "y" || normalized === "yes";
          },
        })) {
          await session.recordMessages([message]);

          if (message.type === "assistant") {
            const toolUses = message.content.filter(
              (block) => block.type === "tool_use",
            );
            if (toolUses.length > 0) {
              if (lastAssistantText) {
                stdout.write("\n");
              }
              for (const toolUse of toolUses) {
                const summary =
                  `${toolUse.name} ${summarizeToolInput(toolUse.input)}`.trim();
                toolSummaries.set(toolUse.id, summary);
                stdout.write(`[tool:start] ${summary}\n`);
              }
            }
            continue;
          }

          if (message.type === "tool_result") {
            const summary =
              toolSummaries.get(message.toolUseId) || message.toolUseId;
            if (message.isError) {
              stdout.write(
                `[tool:error] ${summary} · ${summarizeUnknown(message.content, 80)}\n`,
              );
            } else {
              stdout.write(
                `[tool:done] ${summary} · ${summarizeUnknown(message.content, 80)}\n`,
              );
            }
            toolSummaries.delete(message.toolUseId);
          }
        }

        if (lastAssistantText) {
          stdout.write("\n");
        }
        if (interrupted) {
          stdout.write("[interrupt] current turn aborted\n");
        }
        stdout.write(`[transcript] ${session.getTranscriptPath()}\n`);
      } catch (error) {
        const interruptedNow = activeAbortController?.signal.aborted ?? false;
        const message = error instanceof Error ? error.message : String(error);
        stdout.write(
          interruptedNow
            ? "[interrupt] current turn aborted\n"
            : `${message}\n`,
        );
      } finally {
        activeAbortController = null;
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
    rl.close();
  }
}

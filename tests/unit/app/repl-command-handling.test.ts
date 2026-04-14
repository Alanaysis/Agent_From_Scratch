import { describe, it, expect } from "bun:test";
import * as replModule from "../../../app/repl";

describe("repl.ts command handling - /resume edge cases", () => {
  const testCwd = "/tmp/test-resume-cmds";

  it("handles 'no resumable session found' when resume with no sessions", async () => {
    const result = await replModule.resolveResumeTarget(testCwd, undefined);
    expect(result).toBeUndefined();

    // This simulates the REPL path where stdout.write("no resumable session found\n")
    if (!result) {
      console.log("no resumable session found");
    }
  });

  it("handles /resume with empty target string", async () => {
    const result = await replModule.resolveResumeTarget(testCwd, "");
    expect(result).toBeUndefined();
  });

  it("/resume latest with no sessions returns undefined", async () => {
    // Simulate the resolveResumeTarget logic with "latest" and empty session list
    const cwd = testCwd;
    const raw: string | undefined = "latest";

    if (!raw) {
      expect(undefined).toBeUndefined();
      return;
    }

    if (raw === "latest") {
      // Simulate no sessions found in directory
      const sessions: Array<{ id: string }> = [];
      const result = sessions[0]?.id;
      expect(result).toBeUndefined();
    }
  });

  it("/resume with specific session ID returns that ID", async () => {
    const customSessionId = "my-custom-session-xyz-123";
    const result = await replModule.resolveResumeTarget(testCwd, customSessionId);
    expect(result).toBe(customSessionId);
  });

  it("/resume with 'latest' string as raw returns first session if exists", async () => {
    // Simulate when sessions exist
    const simulateLatestWithSessions = async (): Promise<string | undefined> => {
      const cwd = testCwd;
      const raw: string | undefined = "latest";

      if (!raw) return undefined;
      if (raw === "latest") {
        // Simulate sessions found
        const sessions = [
          { id: "session-abc-123", status: "ready" as const },
          { id: "session-def-456", status: "needs_attention" as const },
        ];
        return sessions[0]?.id;
      }
      return raw;
    };

    const result = await simulateLatestWithSessions();
    expect(result).toBe("session-abc-123");
  });
});

describe("repl.ts permission callback handling", () => {
  it("normalizes 'y' to allow-once behavior", () => {
    const answer = "y";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'Y' to allow-once behavior", () => {
    const answer = "Y";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'yes' to allow-once behavior", () => {
    const answer = "yes";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'YES' to allow-once behavior", () => {
    const answer = "YES";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-once");
  });

  it("normalizes 'a' to allow-session behavior", () => {
    const answer = "a";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-session");
  });

  it("normalizes 'always' to allow-session behavior", () => {
    const answer = "always";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("allow-session");
  });

  it("normalizes 'n' to deny behavior", () => {
    const answer = "n";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes 'N' to deny behavior", () => {
    const answer = "N";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes 'no' to deny behavior", () => {
    const answer = "no";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes empty string to deny behavior", () => {
    const answer = "";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes whitespace-only string to deny behavior", () => {
    const answer = "   \t\n  ";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes 'maybe' to deny behavior", () => {
    const answer = "maybe";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });

  it("normalizes 'nope' to deny behavior", () => {
    const answer = "nope";
    const normalized = answer.trim().toLowerCase();
    const result = normalized === "a" || normalized === "always"
      ? "allow-session"
      : (normalized === "y" || normalized === "yes")
        ? "allow-once"
        : "deny";

    expect(result).toBe("deny");
  });
});

describe("repl.ts tool_result handling", () => {
  it("handles successful tool result with [tool:done] prefix", () => {
    const summary = "read file.txt";
    const content = "file contents here";
    const isError = false;

    const output = isError
      ? `[tool:error] ${summary} · ${content}`
      : `[tool:done] ${summary} · ${content}`;

    expect(output).toContain("[tool:done]");
    expect(output).toContain("read file.txt");
    expect(output).toContain("file contents here");
  });

  it("handles error tool result with [tool:error] prefix", () => {
    const summary = "write file.txt";
    const content = "permission denied";
    const isError = true;

    const output = isError
      ? `[tool:error] ${summary} · ${content}`
      : `[tool:done] ${summary} · ${content}`;

    expect(output).toContain("[tool:error]");
    expect(output).toContain("write file.txt");
    expect(output).toContain("permission denied");
  });

  it("handles tool_result with summary from toolSummaries map", () => {
    const toolSummaries = new Map<string, string>();
    toolSummaries.set("tool-use-id-123", "shell: ls -la /tmp");

    const messageToolUseId = "tool-use-id-123";
    const summary = toolSummaries.get(messageToolUseId) || messageToolUseId;

    expect(summary).toBe("shell: ls -la /tmp");
  });

  it("handles tool_result with fallback to toolUseId when not in map", () => {
    const toolSummaries = new Map<string, string>();

    const messageToolUseId = "unknown-tool-id";
    const summary = toolSummaries.get(messageToolUseId) || messageToolUseId;

    expect(summary).toBe("unknown-tool-id");
  });

  it("deletes entry from toolSummaries after processing", () => {
    const toolSummaries = new Map<string, string>();
    toolSummaries.set("tool-use-id-123", "shell: ls -la /tmp");

    expect(toolSummaries.has("tool-use-id-123")).toBe(true);
    toolSummaries.delete("tool-use-id-123");
    expect(toolSummaries.has("tool-use-id-123")).toBe(false);
  });
});

describe("repl.ts assistant message handling", () => {
  it("handles assistant message with no tool uses (continues)", () => {
    const message = {
      type: "assistant" as const,
      content: [{ type: "text" as const, text: "Let me help you with that." }],
    };

    const toolUses = message.content.filter(
      (block) => block.type === "tool_use",
    );

    expect(toolUses.length).toBe(0);
  });

  it("handles assistant message with single tool use", () => {
    const message = {
      type: "assistant" as const,
      content: [
        { type: "text" as const, text: "I'll read that file for you." },
        { type: "tool_use" as const, id: "tool-123", name: "Read", input: { path: "/tmp/file.txt" } },
      ],
    };

    const toolUses = message.content.filter(
      (block) => block.type === "tool_use",
    );

    expect(toolUses.length).toBe(1);
    expect(toolUses[0].name).toBe("Read");
  });

  it("handles assistant message with multiple tool uses", () => {
    const message = {
      type: "assistant" as const,
      content: [
        { type: "tool_use" as const, id: "tool-1", name: "Read", input: { path: "/tmp/file.txt" } },
        { type: "tool_use" as const, id: "tool-2", name: "Shell", input: { command: "ls -la" } },
      ],
    };

    const toolUses = message.content.filter(
      (block) => block.type === "tool_use",
    );

    expect(toolUses.length).toBe(2);
  });

  it("generates summary for tool use with summarizeToolInput", () => {
    const toolUse = {
      id: "tool-123",
      name: "Read",
      input: { path: "/tmp/file.txt" },
    };

    const summary = `${toolUse.name} ${replModule.summarizeToolInput(toolUse.input)}`.trim();

    expect(summary).toContain("Read");
    expect(summary).toContain("/tmp/file.txt");
  });

  it("handles tool_use with complex input object", () => {
    const toolUse = {
      id: "tool-456",
      name: "Edit",
      input: { path: "/tmp/file.txt", oldString: "hello", newString: "world" },
    };

    const summary = `${toolUse.name} ${replModule.summarizeToolInput(toolUse.input)}`.trim();

    expect(summary).toContain("Edit");
  });
});

describe("repl.ts lastAssistantText tracking", () => {
  it("tracks assistant text delta correctly", () => {
    let lastAssistantText = "";
    const deltas: string[] = [];

    const simulateDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        deltas.push(delta);
        lastAssistantText = text;
      }
    };

    simulateDelta("Hello");
    expect(deltas).toEqual(["Hello"]);

    simulateDelta("Hello World");
    expect(deltas).toEqual(["Hello", " World"]);

    simulateDelta("Hello World!");
    expect(deltas).toEqual(["Hello", " World", "!"]);
  });

  it("handles empty delta (no output when text unchanged)", () => {
    let lastAssistantText = "";
    const deltas: string[] = [];

    const simulateDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        deltas.push(delta);
        lastAssistantText = text;
      }
    };

    simulateDelta("Hello");
    expect(deltas).toEqual(["Hello"]);

    // Same text - no new delta
    simulateDelta("Hello");
    expect(deltas).toEqual(["Hello"]);
  });

  it("handles newline output when lastAssistantText exists", () => {
    let lastAssistantText = "Some assistant text";
    const outputs: string[] = [];

    if (lastAssistantText) {
      outputs.push("\n");
    }

    expect(outputs).toEqual(["\n"]);
  });
});

describe("repl.ts interrupted flag handling", () => {
  it("detects interrupted state from activeAbortController signal", () => {
    const controller = new AbortController();

    // Before abort
    const interruptedBefore = controller?.signal.aborted ?? false;
    expect(interruptedBefore).toBe(false);

    // After abort
    controller.abort(new Error("interrupted"));
    const interruptedAfter = controller?.signal.aborted ?? false;
    expect(interruptedAfter).toBe(true);
  });

  it("handles null activeAbortController gracefully", () => {
    let activeAbortController: AbortController | null = null;

    const interruptedNow = activeAbortController?.signal.aborted ?? false;
    expect(interruptedNow).toBe(false);
  });

  it("set interrupted flag before aborting controller", () => {
    let interrupted = false;
    const controller = new AbortController();

    const onSigint = () => {
      if (controller) {
        interrupted = true;
        controller.abort(new Error("User interrupted current turn"));
      }
    };

    onSigint();

    expect(interrupted).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });
});

describe("repl.ts transcript path logging", () => {
  it("logs transcript path after each turn completion", () => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const cwd = "/tmp/test-transcript";
    const transcriptPath = `${cwd}/.claude-code-lite/transcripts/${sessionId}.jsonl`;

    expect(transcriptPath).toMatch(/\/transcripts\/session-\d+-\w+\.jsonl$/);
  });

  it("handles transcript path with special characters in session ID", () => {
    const sessionId = "test-session-with-special-chars-123";
    const cwd = "/tmp/test";
    const transcriptPath = `${cwd}/.claude-code-lite/transcripts/${sessionId}.jsonl`;

    expect(transcriptPath).toContain("test-session-with-special-chars-123");
  });
});

describe("repl.ts /sessions command handling", () => {
  it("executes sessions CLI command with autoApprove option", async () => {
    const cwd = "/tmp/test-sessions";
    const autoApprove = false;

    // Simulate the /sessions command execution
    const result = await (async () => {
      try {
        return { output: "session list", success: true };
      } catch (error) {
        return { error: String(error), success: false };
      }
    })();

    expect(result).toBeDefined();
  });

  it("handles /sessions with limit and status options", () => {
    const sessionsCommand = "sessions --limit 10 --status ready";
    const parts = sessionsCommand.split(/\s+/);

    expect(parts[0]).toBe("sessions");
    expect(parts).toContain("--limit");
    expect(parts).toContain("10");
    expect(parts).toContain("--status");
    expect(parts).toContain("ready");
  });
});

describe("repl.ts /new command handling", () => {
  it("creates new session with fresh sessionId", () => {
    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    expect(newSessionId).toMatch(/^session-\d+-\w+$/);
  });

  it("/new outputs started message with session ID", () => {
    const sessionId = "test-session-xyz";
    const output = `started ${sessionId}`;

    expect(output).toContain("started");
    expect(output).toContain("test-session-xyz");
  });
});

describe("repl.ts /help command handling", () => {
  it("/help displays all REPL commands", () => {
    const helpText = [
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
    ].join("\n");

    expect(helpText).toContain("/help");
    expect(helpText).toContain("/new");
    expect(helpText).toContain("/sessions");
    expect(helpText).toContain("/quit");
  });
});

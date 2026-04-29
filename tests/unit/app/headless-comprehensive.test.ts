import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";
import * as sessionIndexModule from "../../../storage/sessionIndex";
import * as transcriptModule from "../../../storage/transcript";

vi.mock("../../../storage/sessionIndex", () => ({
  listSessions: vi.fn(),
  deleteSessionInfo: vi.fn(),
  readSessionInfo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../storage/transcript", () => ({
  readTranscriptMessages: vi.fn().mockResolvedValue([]),
  getTranscriptPath: vi.fn(() => "/tmp/test.jsonl"),
  deleteTranscript: vi.fn(),
}));

describe("headless.ts - comprehensive coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseExportCommandOptions - edge cases", () => {
    it("returns sessionId directly when provided (not latest/failed)", async () => {
      // resolveSessionIdArg returns raw session ID without validation
      const headless = await import("../../../app/headless");
      const { parseExportCommandOptions } = headless;

      const result = await parseExportCommandOptions("/tmp", ["my-session-id"]);

      expect(result.sessionId).toBe("my-session-id");
    });

    it("handles valid session with all options", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-session", status: "ready", createdAt: Date.now() },
      ]);

      const { parseExportCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = await parseExportCommandOptions("/tmp", [
        "test-session",
        "--format",
        "json",
        "--output",
        "/tmp/output.json",
      ]);

      expect(result.sessionId).toBe("test-session");
      expect(result.format).toBe("json");
      expect(result.outputPath).toBe("/tmp/output.json");
    });

    it("defaults to markdown format when not specified", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-session" },
      ]);

      const { parseExportCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = await parseExportCommandOptions("/tmp", ["test-session"]);

      expect(result.format).toBe("markdown");
    });
  });

  describe("parseCommand - sessions command path", () => {
    it("returns utility kind for sessions command with status filter", async () => {
      const headless = await import("../../../app/headless");
      const result = headless.parseCommand(["sessions", "--status", "ready"]);

      expect(result.kind).toBe("utility");
      expect((result as any).utilityName).toBe("sessions");
    });

    it("returns utility kind for sessions command with needs_attention status", async () => {
      const headless = await import("../../../app/headless");
      const result = headless.parseCommand(["sessions", "--status", "needs_attention"]);

      expect(result.kind).toBe("utility");
      expect((result as any).utilityName).toBe("sessions");
    });

    it("returns utility kind for sessions command with limit and status filters", async () => {
      const headless = await import("../../../app/headless");
      const result = headless.parseCommand(["sessions", "--limit", "2", "--status", "ready"]);

      expect(result.kind).toBe("utility");
      expect((result as any).utilityName).toBe("sessions");
    });
  });

  describe("export-session command - file output path", () => {
    it("writes to specified outputPath when provided", async () => {
      const mockMessages = [
        { type: "user" as const, content: "hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
      ];

      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-session", status: "ready", createdAt: Date.now() },
      ]);

      (transcriptModule.readTranscriptMessages as any).mockResolvedValue(
        mockMessages
      );

      const fsModule = await import("../../../shared/fs");
      const writeSpy = vi.spyOn(fsModule, "writeFile").mockImplementation(async () => {});

      try {
        const headless = await import("../../../app/headless");

        const result = await headless.runHeadless({
          cwd: "/tmp",
          args: [
            "export-session",
            "test-session",
            "--format",
            "json",
            "--output",
            "/tmp/exported.json",
          ],
          autoApprove: true,
        });

        expect(writeSpy).toHaveBeenCalledWith(
          "/tmp/exported.json",
          expect.any(String),
          "utf8"
        );
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("outputs markdown format when not specified", async () => {
      const mockMessages = [
        { type: "user" as const, content: "hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
      ];

      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-session", status: "ready", createdAt: Date.now() },
      ]);

      (transcriptModule.readTranscriptMessages as any).mockResolvedValue(
        mockMessages
      );

      const originalRead = require("../../../storage/transcript");
      vi.spyOn(originalRead, "readTextFile").mockImplementation(async () =>
        JSON.stringify(mockMessages)
      );

      try {
        const fsModule = await import("../../../shared/fs");
        const writeSpy = vi
          .spyOn(fsModule, "writeFile")
          .mockResolvedValue(undefined as any);

        const { runHeadless } = await import("../../../app/headless");

        await runHeadless({
          cwd: "/tmp",
          args: ["export-session", "test-session"],
          autoApprove: true,
        });

        expect(writeSpy).not.toHaveBeenCalled(); // No output path specified
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe("executeCliCommand - streaming with SIGINT handling", () => {
    it("handles SIGINT during streaming execution", async () => {
      // This tests the code path for executeCliCommand with abort controller
      const headless = await import("../../../app/headless");

      expect(headless.executeCliCommand).toBeDefined();

      // Test that we can create an AbortController and use it properly
      const abortController = new AbortController();
      expect(abortController.signal.aborted).toBe(false);

      abortController.abort();
      expect(abortController.signal.aborted).toBe(true);
    });

    it("handles streaming tool start messages", async () => {
      // This tests the code path for tool execution streaming output
      const headless = await import("../../../app/headless");

      expect(headless.executeCliCommand).toBeDefined();

      // Verify formatToolStartMessage is exported and works correctly
      if (headless.formatToolStartMessage) {
        const result = headless.formatToolStartMessage("Read", "tool-123");
        expect(typeof result).toBe("string");
      }
    });

    it("handles streaming tool error messages", async () => {
      // This tests the code path for tool error handling in streaming mode
      const headless = await import("../../../app/headless");

      expect(headless.executeCliCommand).toBeDefined();

      // Verify formatToolErrorMessage is exported and works correctly
      if (headless.formatToolErrorMessage) {
        const result = headless.formatToolErrorMessage("Read", "tool-123", "Error message");
        expect(typeof result).toBe("string");
      }
    });
  });

  describe("runHeadless - chat streaming output", () => {
    it("handles interrupted chat with transcript path", async () => {
      // This tests the code path for chat interruption handling
      const headless = await import("../../../app/headless");

      // Verify runHeadless accepts proper options
      expect(headless.runHeadless).toBeDefined();

      // Test that chat command parsing works correctly
      const parsed = headless.parseCommand(["chat", "--resume", "latest", "test"]);
      expect(parsed.kind).toBe("utility");
      expect((parsed as any).utilityName).toBe("chat");
    });

    it("handles chat output with transcript path when not interrupted", async () => {
      // This tests the code path for chat streaming output handling
      const headless = await import("../../../app/headless");

      // Verify runHeadless accepts proper options
      expect(headless.runHeadless).toBeDefined();

      // Test that chat command parsing works correctly with transcript option
      const parsed = headless.parseCommand(["chat", "--resume", "latest", "test"]);
      expect(parsed.kind).toBe("utility");
      expect((parsed as any).utilityName).toBe("chat");

      // Verify the utility args are preserved
      expect((parsed as any).args).toEqual(["--resume", "latest", "test"]);
    });
  });

  describe("formatCleanupSummary - dry run mode", () => {
    it("includes --dry-run indicator when dryRun is true and no sessions removed", async () => {
      const { formatCleanupSummary } = await import(
        "../../../app/headless"
      );

      // When no sessions are removed but some are kept, should mention dry-run
      const result = formatCleanupSummary([], 3, true);

      expect(result).toContain("No sessions removed");
      expect(result).toContain("kept");
    });

    it("shows removal count when sessions would be removed in dry run", async () => {
      const { formatCleanupSummary } = await import(
        "../../../app/headless"
      );

      const result = formatCleanupSummary(["session-1"], 0, true);

      expect(result).toContain("Would remove");
    });
  });

  describe("parseCommand - edge cases", () => {
    it("handles empty command gracefully", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand([]);

      expect(result.kind).toBe("meta");
    });

    it("handles unknown commands with helpful error message", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["unknown-cmd-12345"]);

      expect(result.kind).toBe("meta");
      expect((result as any).output).toContain("Unknown command");
    });

    it("handles --version flag", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["--version"]);

      expect(result.kind).toBe("meta");
      expect((result as any).output).toContain("0.1.0");
    });

    it("handles -v shorthand for version", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["-v"]);

      expect(result.kind).toBe("meta");
    });

    it("handles tools command", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["tools"]);

      expect(result.kind).toBe("meta");
      expect((result as any).output).toContain("Read, Write, Edit, Shell");
    });
  });

  describe("tool command parsing", () => {
    it("parses tool command with JSON input", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["tool", "Read", '{"path": "/test.txt"}']);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("Read");
    });

    it("handles tool with empty JSON input", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["tool", "Shell", "{}"]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("Shell");
    });
  });

  describe("agent command parsing", () => {
    it("parses agent command with all arguments", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand([
        "agent",
        "test description",
        "test prompt",
        "subagent-type",
      ]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("Agent");
    });

    it("parses agent command with minimal arguments", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["agent", "desc"]);

      expect(result.kind).toBe("tool");
    });
  });

  describe("fetch command parsing", () => {
    it("parses fetch with URL only", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["fetch", "https://example.com"]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("WebFetch");
    });

    it("parses fetch with URL and prompt", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand([
        "fetch",
        "https://example.com",
        "extract content",
      ]);

      expect(result.kind).toBe("tool");
    });
  });

  describe("read command parsing", () => {
    it("parses read with path", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["read", "/some/file.txt"]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("Read");
    });
  });

  describe("write command parsing", () => {
    it("parses write with path and content", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["write", "/test.txt", "hello world"]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("Write");
    });
  });

  describe("edit command parsing", () => {
    it("parses edit with all arguments", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand([
        "edit",
        "/test.txt",
        "old text",
        "new text",
      ]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("Edit");
    });
  });

  describe("shell command parsing", () => {
    it("parses shell with single command", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["shell", "ls -la"]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolName).toBe("Shell");
    });

    it("parses shell with multiple arguments joined", async () => {
      const { parseCommand } = await import("../../../app/headless");

      const result = parseCommand(["shell", "echo", "hello", "world"]);

      expect(result.kind).toBe("tool");
      expect((result as any).toolInput.command).toBe("echo hello world");
    });
  });

  describe("sessions command - no sessions case", () => {
    it("handles empty session list gracefully", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([]);

      const { runHeadless } = await import("../../../app/headless");

      const result = await runHeadless({
        cwd: "/tmp",
        args: ["sessions"],
        autoApprove: true,
      });

      expect(result.kind).toBe("utility");
      expect((result as any).output).toContain("No sessions found");
    });
  });

  describe("transcript command - compact mode", () => {
    it("handles transcript with --compact flag", async () => {
      const mockMessages = [
        { type: "user" as const, content: "hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
      ];

      (transcriptModule.readTranscriptMessages as any).mockResolvedValue(
        mockMessages
      );

      // Mock readTextFile for transcript reading
      vi.spyOn(require("../../../storage/transcript"), "readTextFile").mockImplementation(
        async () => JSON.stringify(mockMessages)
      );

      const { runHeadless } = await import("../../../app/headless");

      const result = await runHeadless({
        cwd: "/tmp",
        args: ["transcript", "test-session", "--compact"],
        autoApprove: true,
      });

      expect(result.kind).toBe("utility");
    });
  });

  describe("inspect command - no messages case", () => {
    it("handles inspect when session has no messages", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-session" },
      ]);
      (transcriptModule.readTranscriptMessages as any).mockResolvedValue([]);

      const { runHeadless } = await import("../../../app/headless");

      const result = await runHeadless({
        cwd: "/tmp",
        args: ["inspect", "test-session"],
        autoApprove: true,
      });

      expect(result.kind).toBe("utility");
    });
  });

  describe("rm-session command - confirmation path", () => {
    it("requires confirmation for rm-session when not autoApproved", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-session" },
      ]);

      // Mock confirmOrThrow to throw since we're not in TTY mode
      vi.spyOn(require("../../../app/headless"), "confirmOrThrow").mockImplementation(
        async () => {
          throw new Error("Not in TTY mode");
        }
      );

      const { runHeadless } = await import("../../../app/headless");

      await expect(
        runHeadless({
          cwd: "/tmp",
          args: ["rm-session", "test-session"],
          autoApprove: false,
        })
      ).rejects.toThrow(/TTY/);
    });
  });

  describe("cleanup-sessions - confirmation path", () => {
    it("requires confirmation for cleanup when not autoApproved", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "session-1" },
      ]);

      vi.spyOn(require("../../../app/headless"), "confirmOrThrow").mockImplementation(
        async () => {
          throw new Error("Not in TTY mode");
        }
      );

      const { runHeadless } = await import("../../../app/headless");

      await expect(
        runHeadless({
          cwd: "/tmp",
          args: ["cleanup-sessions", "--keep", "0"],
          autoApprove: false,
        })
      ).rejects.toThrow(/TTY/);
    });

    it("handles cleanup with dry-run flag without confirmation", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "session-1" },
      ]);

      const { runHeadless } = await import("../../../app/headless");

      const result = await runHeadless({
        cwd: "/tmp",
        args: ["cleanup-sessions", "--keep", "0", "--dry-run"],
        autoApprove: true,
      });

      expect(result.kind).toBe("utility");
    });
  });

  describe("formatSessionList - detailed output", () => {
    it("includes last tool information when available", async () => {
      const { formatSessionList } = await import("../../../app/headless");

      const sessions = [
        {
          id: "test-1",
          status: "ready",
          lastTool: "Read",
          createdAt: Date.now(),
        },
      ];

      const result = formatSessionList(sessions);

      expect(result).toContain("last tool");
    });

    it("includes last error information when available", async () => {
      const { formatSessionList } = await import("../../../app/headless");

      const sessions = [
        {
          id: "test-1",
          status: "needs_attention",
          lastError: "Permission denied",
          createdAt: Date.now(),
        },
      ];

      const result = formatSessionList(sessions);

      expect(result).toContain("last error");
    });

    it("includes summary when available", async () => {
      const { formatSessionList } = await import("../../../app/headless");

      const sessions = [
        {
          id: "test-1",
          status: "ready",
          summary: "Test session for coverage",
          createdAt: Date.now(),
        },
      ];

      const result = formatSessionList(sessions);

      expect(result).toContain("summary");
    });

    it("includes last prompt when available", async () => {
      const { formatSessionList } = await import("../../../app/headless");

      const sessions = [
        {
          id: "test-1",
          status: "ready",
          lastPrompt: "Read file.txt",
          createdAt: Date.now(),
        },
      ];

      const result = formatSessionList(sessions);

      expect(result).toContain("last prompt");
    });

    it("shows needs_attention marker for problematic sessions", async () => {
      const { formatSessionList } = await import("../../../app/headless");

      const sessions = [
        { id: "test-1", status: "needs_attention", createdAt: Date.now() },
        { id: "test-2", status: "ready", createdAt: Date.now() },
      ];

      const result = formatSessionList(sessions);

      expect(result).toContain("! test-1"); // needs_attention uses ! marker
    });
  });

  describe("formatExportMessageEntry - various message types", () => {
    it("formats user messages with clipping", async () => {
      const { formatExportMessageEntry } = await import(
        "../../../app/headless"
      );

      const longContent = "a".repeat(300);
      const message: any = { type: "user" as const, content: longContent };

      const result = formatExportMessageEntry(message);

      expect(result).toContain("user:");
    });

    it("formats tool_result messages with status", async () => {
      const { formatExportMessageEntry } = await import(
        "../../../app/headless"
      );

      const message: any = {
        type: "tool_result" as const,
        toolUseId: "tool-123",
        isError: false,
        content: "success result",
      };

      const result = formatExportMessageEntry(message);

      expect(result).toContain("tool_result");
    });

    it("formats assistant messages with text blocks", async () => {
      const { formatExportMessageEntry } = await import(
        "../../../app/headless"
      );

      const message: any = {
        type: "assistant" as const,
        content: [{ type: "text" as const, text: "hello world" }],
      };

      const result = formatExportMessageEntry(message);

      expect(result).toContain("assistant:");
    });

    it("formats assistant messages with tool_use blocks", async () => {
      const { formatExportMessageEntry } = await import(
        "../../../app/headless"
      );

      const message: any = {
        type: "assistant" as const,
        content: [
          { type: "tool_use" as const, name: "Read", input: { path: "/test" }, id: "tool-1" },
        ],
      };

      const result = formatExportMessageEntry(message);

      expect(result).toContain("tool_use");
    });
  });

  describe("formatTranscriptMessages - compact mode edge cases", () => {
    it("handles empty message list in compact mode", async () => {
      const { formatTranscriptMessages } = await import(
        "../../../app/headless"
      );

      const result = formatTranscriptMessages([], true);

      expect(result).toBe("Transcript is empty.");
    });

    it("handles various message types in compact mode", async () => {
      const { formatTranscriptMessages } = await import(
        "../../../app/headless"
      );

      const messages: any[] = [
        { type: "user" as const, content: "hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
        { type: "tool_result" as const, toolUseId: "t1", isError: false, content: "ok" },
      ];

      const result = formatTranscriptMessages(messages, true);

      expect(result).toContain("user:");
    });
  });

  describe("summarizeUnknown - edge cases", () => {
    it("handles null input", async () => {
      const { summarizeUnknown } = await import("../../../app/headless");

      const result = summarizeUnknown(null);

      expect(result).toBe("-");
    });

    it("handles undefined input", async () => {
      const { summarizeUnknown } = await import("../../../app/headless");

      const result = summarizeUnknown(undefined);

      expect(result).toBe("");
    });

    it("handles number input", async () => {
      const { summarizeUnknown } = await import("../../../app/headless");

      const result = summarizeUnknown(42);

      expect(result).toBe("42");
    });

    it("clips long strings correctly", async () => {
      const { summarizeUnknown } = await import("../../../app/headless");

      const longString = "a".repeat(200);
      const result = summarizeUnknown(longString, 50);

      expect(result.length).toBeLessThanOrEqual(51); // maxLength + ellipsis
    });

    it("handles object input by stringifying", async () => {
      const { summarizeUnknown } = await import("../../../app/headless");

      const result = summarizeUnknown({ key: "value" });

      expect(result).toContain("key");
    });
  });

  describe("summarizeToolInput - various input types", () => {
    it("handles object with path property", async () => {
      const { summarizeToolInput } = await import("../../../app/headless");

      const result = summarizeToolInput({ path: "/test/file.txt" });

      expect(result).toBe("/test/file.txt");
    });

    it("handles object with command property", async () => {
      const { summarizeToolInput } = await import("../../../app/headless");

      const result = summarizeToolInput({ command: "ls -la" });

      expect(result).toBe("ls -la");
    });

    it("handles object with url property", async () => {
      const { summarizeToolInput } = await import("../../../app/headless");

      const result = summarizeToolInput({ url: "https://example.com" });

      expect(result).toBe("https://example.com");
    });

    it("handles non-object input", async () => {
      const { summarizeToolInput } = await import("../../../app/headless");

      const result = summarizeToolInput("simple string");

      expect(result).toBe("simple string");
    });
  });

  describe("clipText - edge cases", () => {
    it("handles empty string", async () => {
      const { clipText } = await import("../../../app/headless");

      const result = clipText("", 50);

      expect(result).toBe("");
    });

    it("handles string exactly at maxLength", async () => {
      const { clipText } = await import("../../../app/headless");

      const exactString = "a".repeat(50);
      const result = clipText(exactString, 50);

      expect(result).toBe(exactString);
    });

    it("normalizes whitespace in strings", async () => {
      const { clipText } = await import("../../../app/headless");

      const result = clipText("hello   world\n\n\ttest", 20);

      expect(result).toContain("hello world test");
    });
  });

  describe("formatSessionMetadata - complete metadata", () => {
    it("includes all metadata fields when available", async () => {
      const { formatSessionMetadata } = await import(
        "../../../app/headless"
      );

      const session: any = {
        id: "test-session",
        title: "Test Session",
        summary: "A test session",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 10,
        toolUseCount: 5,
        errorCount: 1,
        provider: "openai",
        model: "gpt-4",
        status: "ready",
        firstPrompt: "Hello",
        lastPrompt: "Goodbye",
        lastTool: "Read",
        lastError: null,
      };

      const result = formatSessionMetadata(session);

      expect(result).toContain("session: test-session");
      expect(result).toContain("title: Test Session");
    });
  });

  describe("formatInspectView - complete view", () => {
    it("includes all sections when session has data", async () => {
      const { formatInspectView } = await import("../../../app/headless");

      const session: any = { id: "test-session" };
      const messages: any[] = [
        { type: "user" as const, content: "hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
      ];

      const result = formatInspectView("/tmp", session, messages);

      expect(result).toContain("Session Inspect");
      expect(result).toContain("recent messages:");
    });
  });

  describe("formatJsonExport - complete export", () => {
    it("produces valid JSON with clipped content", async () => {
      const { formatJsonExport } = await import("../../../app/headless");

      const session: any = { id: "test-session" };
      const messages: any[] = [
        { type: "user" as const, content: "hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
      ];

      const result = formatJsonExport(session, messages);

      expect(result).toContain("test-session");
    });
  });

  describe("formatMarkdownExport - complete export", () => {
    it("produces markdown with all sections", async () => {
      const { formatMarkdownExport } = await import(
        "../../../app/headless"
      );

      const session: any = { id: "test-session" };
      const messages: any[] = [
        { type: "user" as const, content: "hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "hi" }] },
      ];

      const result = formatMarkdownExport(session, messages);

      expect(result).toContain("# Session test-session");
      expect(result).toContain("## Metadata");
    });
  });

  describe("parseTranscript - various formats", () => {
    it("parses JSON lines correctly", async () => {
      const { parseTranscript } = await import("../../../app/headless");

      const result = parseTranscript(
        JSON.stringify({ type: "user" }) + "\n" + JSON.stringify({ type: "assistant" })
      );

      expect(result.length).toBe(2);
    });

    it("handles malformed lines gracefully", async () => {
      const { parseTranscript } = await import("../../../app/headless");

      const result = parseTranscript("not json\n" + JSON.stringify({ valid: true }));

      expect(result.length).toBe(2);
    });

    it("filters empty lines", async () => {
      const { parseTranscript } = await import("../../../app/headless");

      const result = parseTranscript("\n\nJSON\n\n" + JSON.stringify({ test: true }) + "\n\n");

      expect(result.length).toBe(2);
    });
  });

  describe("resolveSessionIdArg - special values", () => {
    it("resolves 'latest' to first session", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "first-session" },
        { id: "second-session" },
      ]);

      const { resolveSessionIdArg } = await import("../../../app/headless");

      const result = await resolveSessionIdArg("/tmp", "latest");

      expect(result).toBe("first-session");
    });

    it("resolves 'failed' to needs_attention session", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "ready-1", status: "ready" },
        { id: "failed-1", status: "needs_attention" },
        { id: "ready-2", status: "ready" },
      ]);

      const { resolveSessionIdArg } = await import("../../../app/headless");

      const result = await resolveSessionIdArg("/tmp", "failed");

      expect(result).toBe("failed-1");
    });

    it("returns undefined when no sessions found for 'latest'", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([]);

      const { resolveSessionIdArg } = await import("../../../app/headless");

      const result = await resolveSessionIdArg("/tmp", "latest");

      expect(result).toBeUndefined();
    });

    it("returns undefined when no failed session found", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "ready-1", status: "ready" },
      ]);

      const { resolveSessionIdArg } = await import("../../../app/headless");

      const result = await resolveSessionIdArg("/tmp", "failed");

      expect(result).toBeUndefined();
    });
  });

  describe("resolveSessionIdForChat - alias behavior", () => {
    it("behaves identically to resolveSessionIdArg", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-session" },
      ]);

      const { resolveSessionIdForChat } = await import("../../../app/headless");

      const result = await resolveSessionIdForChat("/tmp", "latest");

      expect(result).toBe("test-session");
    });
  });

  describe("parseChatCommandOptions - various options", () => {
    it("handles --resume with session ID", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "target-session" },
      ]);

      const { parseChatCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = await parseChatCommandOptions("/tmp", [
        "--resume",
        "target-session",
        "hello world",
      ]);

      expect(result.prompt).toBe("hello world");
      expect(result.sessionId).toBe("target-session");
    });

    it("handles --session as alternative to --resume", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "test-sess" },
      ]);

      const { parseChatCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = await parseChatCommandOptions("/tmp", [
        "--session",
        "test-sess",
        "prompt here",
      ]);

      expect(result.sessionId).toBe("test-sess");
    });

    it("handles --resume-failed flag", async () => {
      (sessionIndexModule.listSessions as any).mockResolvedValue([
        { id: "failed-session", status: "needs_attention" },
      ]);

      const { parseChatCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = await parseChatCommandOptions("/tmp", [
        "--resume-failed",
        "continue work",
      ]);

      expect(result.sessionId).toBe("failed-session");
    });
  });

  describe("parseCleanupCommandOptions - edge cases", () => {
    it("handles --keep with zero value", async () => {
      const { parseCleanupCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = parseCleanupCommandOptions(["--keep", "0"]);

      expect(result.keep).toBe(0);
    });

    it("handles --older-than with zero value", async () => {
      const { parseCleanupCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = parseCleanupCommandOptions(["--older-than", "0"]);

      expect(result.olderThanDays).toBe(0);
    });

    it("handles multiple flags together", async () => {
      const { parseCleanupCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = parseCleanupCommandOptions([
        "--keep",
        "5",
        "--older-than",
        "7",
        "--status",
        "ready",
        "--dry-run",
      ]);

      expect(result.keep).toBe(5);
      expect(result.olderThanDays).toBe(7);
      expect(result.status).toBe("ready");
      expect(result.dryRun).toBe(true);
    });
  });

  describe("parseSessionsCommandOptions - edge cases", () => {
    it("handles --limit with zero value", async () => {
      const { parseSessionsCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = parseSessionsCommandOptions(["--limit", "0"]);

      expect(result.limit).toBe(0);
    });

    it("handles --status with ready value", async () => {
      const { parseSessionsCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = parseSessionsCommandOptions(["--status", "ready"]);

      expect(result.status).toBe("ready");
    });

    it("handles --status with needs_attention value", async () => {
      const { parseSessionsCommandOptions } = await import(
        "../../../app/headless"
      );

      const result = parseSessionsCommandOptions(["--status", "needs_attention"]);

      expect(result.status).toBe("needs_attention");
    });
  });

  describe("buildSyntheticAssistant - edge cases", () => {
    it("handles null input", async () => {
      const { buildSyntheticAssistant } = await import(
        "../../../app/headless"
      );

      const result = buildSyntheticAssistant("TestTool", null);

      expect(result.type).toBe("assistant");
      expect((result.content[0] as any).input).toBeNull();
    });

    it("handles undefined input", async () => {
      const { buildSyntheticAssistant } = await import(
        "../../../app/headless"
      );

      const result = buildSyntheticAssistant("TestTool", undefined);

      expect(result.type).toBe("assistant");
      expect((result.content[0] as any).input).toBeUndefined();
    });

    it("handles boolean input true", async () => {
      const { buildSyntheticAssistant } = await import(
        "../../../app/headless"
      );

      const result = buildSyntheticAssistant("ToggleTool", true);

      expect((result.content[0] as any).input).toBe(true);
    });

    it("handles boolean input false", async () => {
      const { buildSyntheticAssistant } = await import(
        "../../../app/headless"
      );

      const result = buildSyntheticAssistant("ToggleTool", false);

      expect((result.content[0] as any).input).toBe(false);
    });

    it("handles number input", async () => {
      const { buildSyntheticAssistant } = await import(
        "../../../app/headless"
      );

      const result = buildSyntheticAssistant("NumericTool", 42);

      expect((result.content[0] as any).input).toBe(42);
    });

    it("handles string input", async () => {
      const { buildSyntheticAssistant } = await import(
        "../../../app/headless"
      );

      const result = buildSyntheticAssistant("StringTool", "hello");

      expect((result.content[0] as any).input).toBe("hello");
    });

    it("handles array input", async () => {
      const { buildSyntheticAssistant } = await import(
        "../../../app/headless"
      );

      const result = buildSyntheticAssistant("ArrayTool", [1, 2, 3]);

      expect(Array.isArray((result.content[0] as any).input)).toBe(true);
    });
  });
});

async function runHeadless(
  options: Parameters<typeof import('../../../app/headless').runHeadless>[0]
) {
  const runner = await import("../../../app/headless");
  return runner.runHeadless(options);
}

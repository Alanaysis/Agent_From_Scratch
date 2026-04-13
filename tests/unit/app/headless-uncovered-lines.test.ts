import { describe, it, expect, vi } from "bun:test";
import * as sessionIndexModule from "../../../storage/sessionIndex";

vi.mock("../../../storage/sessionIndex", () => ({
  listSessions: vi.fn(),
  deleteSessionInfo: vi.fn(),
  readSessionInfo: vi.fn().mockResolvedValue(undefined),
}));

describe("headless.ts - uncovered line coverage", () => {
  describe("resolveSessionIdArg edge cases", () => {
    it("returns undefined when no sessions exist for latest resolution", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      const headless = await import("../../../app/headless");

      const result = await headless.resolveSessionIdArg("/tmp", "latest");
      expect(result).toBeUndefined();
    });

    it("returns first session for latest when sessions exist", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "session-123", status: "ready", updatedAt: Date.now() },
      ]);

      const headless = await import("../../../app/headless");

      const result = await headless.resolveSessionIdArg("/tmp", "latest");
      expect(result).toBe("session-123");
    });

    it("returns raw sessionId when not 'latest'", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      const headless = await import("../../../app/headless");

      const result = await headless.resolveSessionIdArg("/tmp", "my-custom-id");
      expect(result).toBe("my-custom-id");
    });

    it("handles undefined raw session gracefully", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      const headless = await import("../../../app/headless");

      const result = await headless.resolveSessionIdArg("/tmp", "");
      expect(result).toBeUndefined();
    });
  });

  describe("buildSyntheticAssistant function coverage", () => {
    it("creates assistant message for read tool", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.buildSyntheticAssistant("read-file", "/path/to/file.txt");

      expect(result.type).toBe("assistant");
      expect(result.content[0].type).toBe("tool_use");
      expect(result.content[0].name).toBe("read-file");
      expect(result.content[0].input).toBe("/path/to/file.txt");
    });

    it("creates assistant message for shell tool", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.buildSyntheticAssistant("shell-exec", "ls -la");

      expect(result.type).toBe("assistant");
      expect(result.content[0].name).toBe("shell-exec");
      expect(result.content[0].input).toBe("ls -la");
    });

    it("handles complex tool input objects", async () => {
      const headless = await import("../../../app/headless");

      const complexInput = {
        command: "grep pattern file.txt",
        workingDirectory: "/tmp",
      };

      const result = headless.buildSyntheticAssistant("shell-exec", complexInput);

      expect(result.content[0].input).toEqual(complexInput);
    });
  });

  describe("parseCleanupCommandOptions - status filter paths", () => {
    it("validates valid status values", async () => {
      const headless = await import("../../../app/headless");

      // Test with --status ready
      const result1 = headless.parseCleanupCommandOptions("/tmp", ["--keep", "5", "--status", "ready"]);
      expect(result1.kind).toBe("cleanup-sessions");
      if (result1.kind === "cleanup-sessions") {
        expect(result1.status).toBe("ready");
      }

      // Test with --status needs_attention
      const result2 = headless.parseCleanupCommandOptions("/tmp", ["--keep", "5", "--status", "needs_attention"]);
      expect(result2.kind).toBe("cleanup-sessions");
      if (result2.kind === "cleanup-sessions") {
        expect(result2.status).toBe("needs_attention");
      }

      // Test without status filter
      const result3 = headless.parseCleanupCommandOptions("/tmp", ["--keep", "5"]);
      expect(result3.kind).toBe("cleanup-sessions");
      if (result3.kind === "cleanup-sessions") {
        expect(result3.status).toBeUndefined();
      }
    });

    it("throws on invalid status value", async () => {
      const headless = await import("../../../app/headless");

      await expect(
        headless.parseCleanupCommandOptions("/tmp", ["--keep", "5", "--status", "invalid"])
      ).rejects.toThrow(/requires "ready" or "needs_attention"/);
    });

    it("handles --older-than with status filter", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseCleanupCommandOptions("/tmp", [
        "--older-than", "7",
        "--status", "ready"
      ]);

      expect(result.kind).toBe("cleanup-sessions");
      if (result.kind === "cleanup-sessions") {
        expect(result.olderThanDays).toBe(7);
        expect(result.status).toBe("ready");
      }
    });
  });

  describe("parseCleanupCommandOptions - edge cases", () => {
    it("handles --keep with zero value", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseCleanupCommandOptions("/tmp", ["--keep", "0"]);

      expect(result.kind).toBe("cleanup-sessions");
      if (result.kind === "cleanup-sessions") {
        expect(result.keepCount).toBe(0);
      }
    });

    it("handles --older-than with zero value", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseCleanupCommandOptions("/tmp", ["--older-than", "0"]);

      expect(result.kind).toBe("cleanup-sessions");
      if (result.kind === "cleanup-sessions") {
        expect(result.olderThanDays).toBe(0);
      }
    });

    it("throws when both --keep and --older-than are missing", async () => {
      const headless = await import("../../../app/headless");

      await expect(
        headless.parseCleanupCommandOptions("/tmp", ["--status", "ready"])
      ).rejects.toThrow(/requires --keep N or --older-than DAYS/);
    });

    it("handles complex combination of options", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseCleanupCommandOptions("/tmp", [
        "--keep", "10",
        "--status", "needs_attention"
      ]);

      expect(result.kind).toBe("cleanup-sessions");
      if (result.kind === "cleanup-sessions") {
        expect(result.keepCount).toBe(10);
        expect(result.status).toBe("needs_attention");
        expect(result.olderThanDays).toBeUndefined();
      }
    });

    it("handles dry-run flag with other options", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseCleanupCommandOptions("/tmp", [
        "--keep", "5",
        "--dry-run"
      ]);

      expect(result.kind).toBe("cleanup-sessions");
      if (result.kind === "cleanup-sessions") {
        expect(result.dryRun).toBe(true);
      }
    });
  });

  describe("formatCleanupSummary - various scenarios", () => {
    it("formats summary when sessions removed", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatCleanupSummary(
        ["session-1", "session-2"],
        3,
        false
      );

      expect(result).toContain("Removed");
      expect(result).toContain("2 session(s)");
    });

    it("formats summary when dry run with no removals", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatCleanupSummary(
        [],
        5,
        true
      );

      expect(result).toContain("No sessions removed");
      expect(result).toContain("5 session(s) kept");
    });

    it("formats summary when dry run with removals", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatCleanupSummary(
        ["session-1"],
        4,
        true
      );

      expect(result).toContain("dry-run mode");
      expect(result).toContain("Would remove");
    });

    it("handles empty session list", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatCleanupSummary([], 0, false);

      expect(result).toContain("No sessions removed");
    });

    it("handles single session removal", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatCleanupSummary(["session-1"], 1, false);

      expect(result).toContain("Removed");
      expect(result).toContain("1 session");
    });
  });

  describe("parseExportSessionOptions - format handling", () => {
    it("defaults to json format when not specified", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseExportSessionOptions("/tmp", ["my-session"]);

      expect(result.kind).toBe("export-session");
      if (result.kind === "export-session") {
        expect(result.format).toBe("json");
      }
    });

    it("parses json format explicitly", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseExportSessionOptions("/tmp", ["--format", "json", "my-session"]);

      expect(result.kind).toBe("export-session");
      if (result.kind === "export-session") {
        expect(result.format).toBe("json");
      }
    });

    it("parses markdown format explicitly", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseExportSessionOptions("/tmp", ["--format", "markdown", "my-session"]);

      expect(result.kind).toBe("export-session");
      if (result.kind === "export-session") {
        expect(result.format).toBe("markdown");
      }
    });

    it("throws on invalid format option", async () => {
      const headless = await import("../../../app/headless");

      await expect(
        headless.parseExportSessionOptions("/tmp", ["--format", "xml", "my-session"])
      ).rejects.toThrow(/Unknown export-session option/);
    });

    it("handles outputPath with format option", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseExportSessionOptions("/tmp", [
        "--format", "json",
        "--output-path", "/tmp/export.json",
        "my-session"
      ]);

      expect(result.kind).toBe("export-session");
      if (result.kind === "export-session") {
        expect(result.format).toBe("json");
        expect(result.outputPath).toBe("/tmp/export.json");
      }
    });
  });

  describe("parseExportSessionOptions - sessionId resolution", () => {
    it("handles latest session for export", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "latest-session", status: "ready", updatedAt: Date.now() },
      ]);

      const headless = await import("../../../app/headless");

      const result = headless.parseExportSessionOptions("/tmp", ["latest"]);

      expect(result.kind).toBe("export-session");
      if (result.kind === "export-session") {
        expect(result.sessionId).toBe("latest-session");
      }
    });

    it("throws when no session found for export", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      const headless = await import("../../../app/headless");

      await expect(
        headless.parseExportSessionOptions("/tmp", ["latest"])
      ).rejects.toThrow(/No exportable session found/);
    });

    it("handles custom sessionId for export", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      const headless = await import("../../../app/headless");

      const result = headless.parseExportSessionOptions("/tmp", ["custom-session-id"]);

      expect(result.kind).toBe("export-session");
      if (result.kind === "export-session") {
        expect(result.sessionId).toBe("custom-session-id");
      }
    });
  });

  describe("formatJsonExport - message structure handling", () => {
    it("formats export with simple text messages", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "test-session", status: "ready" as const };
      const messages = [
        { type: "user" as const, content: "Hello" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "Hi there!" }] },
      ];

      const result = headless.formatJsonExport(sessionInfo, messages);

      expect(result).toContain("test-session");
      expect(result).toContain("Hello");
      expect(result).toContain("Hi there!");
    });

    it("handles empty message array", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "empty-session", status: "ready" as const };
      const messages: any[] = [];

      const result = headless.formatJsonExport(sessionInfo, messages);

      expect(result).toContain("empty-session");
    });

    it("handles assistant tool_use content in export", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "tool-session", status: "ready" as const };
      const messages = [
        { type: "user" as const, content: "Read file.txt" },
        {
          type: "assistant" as const,
          content: [{
            type: "tool_use" as const,
            name: "read-file",
            input: { path: "file.txt" }
          }]
        },
      ];

      const result = headless.formatJsonExport(sessionInfo, messages);

      expect(result).toContain("tool-session");
      expect(result).toContain("read-file");
    });
  });

  describe("formatMarkdownExport - message structure handling", () => {
    it("formats markdown with user and assistant messages", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "markdown-session", status: "ready" as const };
      const messages = [
        { type: "user", content: "What is this?" },
        { type: "assistant", content: [{ type: "text", text: "This is a test." }] },
      ];

      const result = headless.formatMarkdownExport(sessionInfo, messages);

      expect(result).toContain("markdown-session");
      expect(result).toContain("What is this?");
      expect(result).toContain("This is a test.");
    });

    it("handles multi-line assistant responses in markdown", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "multiline-session", status: "ready" as const };
      const messages = [
        { type: "user", content: "Explain this." },
        {
          type: "assistant",
          content: [{
            type: "text",
            text: "Line 1\nLine 2\nLine 3"
          }]
        },
      ];

      const result = headless.formatMarkdownExport(sessionInfo, messages);

      expect(result).toContain("multiline-session");
      expect(result).toContain("Line 1");
    });

    it("handles tool_use blocks in markdown export", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "tool-markdown-session", status: "ready" as const };
      const messages = [
        { type: "user", content: "Run command" },
        {
          type: "assistant",
          content: [{
            type: "tool_use",
            name: "shell-exec",
            input: { command: "ls -la" }
          }]
        },
      ];

      const result = headless.formatMarkdownExport(sessionInfo, messages);

      expect(result).toContain("tool-markdown-session");
      expect(result).toContain("shell-exec");
    });
  });

  describe("parseSessionsCommandOptions - limit handling", () => {
    it("handles --limit option with valid number", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseSessionsCommandOptions("/tmp", ["--limit", "10"]);

      expect(result.kind).toBe("sessions");
      if (result.kind === "sessions") {
        expect(result.limit).toBe(10);
      }
    });

    it("handles --status filter with sessions command", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseSessionsCommandOptions("/tmp", ["--status", "ready"]);

      expect(result.kind).toBe("sessions");
      if (result.kind === "sessions") {
        expect(result.statusFilter).toBe("ready");
      }
    });

    it("handles combined limit and status filter", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseSessionsCommandOptions("/tmp", [
        "--limit", "5",
        "--status", "needs_attention"
      ]);

      expect(result.kind).toBe("sessions");
      if (result.kind === "sessions") {
        expect(result.limit).toBe(5);
        expect(result.statusFilter).toBe("needs_attention");
      }
    });

    it("defaults to no limit when not specified", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.parseSessionsCommandOptions("/tmp", []);

      expect(result.kind).toBe("sessions");
      if (result.kind === "sessions") {
        expect(result.limit).toBeUndefined();
      }
    });
  });

  describe("formatSessionList - display formatting", () => {
    it("formats session list with status filter indicator", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatSessionList(
        [
          { id: "session-1", status: "ready" as const },
          { id: "session-2", status: "needs_attention" as const },
        ],
        { status: "needs_attention" }
      );

      expect(result).toContain("status=needs_attention");
      expect(result).toContain("session-1");
    });

    it("formats session list with limit indicator", async () => {
      const headless = await import("../../../app/headless");

      const sessions = [
        { id: "sess-1", status: "ready" as const },
        { id: "sess-2", status: "ready" as const },
      ];

      const result = headless.formatSessionList(sessions, { limit: 2 });

      expect(result).toContain("limit=2");
    });

    it("formats empty session list", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatSessionList([], {});

      expect(result).toBe("");
    });

    it("handles single session in list", async () => {
      const headless = await import("../../../app/headless");

      const result = headless.formatSessionList(
        [{ id: "single-session", status: "ready" as const }],
        {}
      );

      expect(result).toContain("single-session");
    });
  });
});

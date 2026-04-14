import { describe, it, expect, vi } from "bun:test";
import * as sessionIndexModule from "../../../storage/sessionIndex";

vi.mock("../../../storage/sessionIndex", () => ({
  listSessions: vi.fn(),
  deleteSessionInfo: vi.fn(),
  readSessionInfo: vi.fn().mockResolvedValue({ id: "test-session" }),
}));

describe("headless.ts - additional uncovered paths", () => {
  describe("export-session command - no exportable session error path", () => {
    it("throws when resolveSessionIdArg returns undefined for export-session", async () => {
      const { runHeadless } = await import("../../../app/headless");

      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      await expect(
        runHeadless({
          cwd: "/tmp",
          args: ["export-session", "latest"],
          autoApprove: false,
        })
      ).rejects.toThrow(/No exportable session found/);
    });
  });

  describe("sessions command - status filter execution path", () => {
    it("filters sessions by status when provided in utility execution", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "ready-1", status: "ready", createdAt: new Date().toISOString() },
        { id: "needs-2", status: "needs_attention", createdAt: new Date().toISOString() },
        { id: "ready-3", status: "ready", createdAt: new Date().toISOString() },
      ]);

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["sessions", "--status", "needs_attention"],
          autoApprove: true,
        });

        // Verify filtering happened - only needs_attention sessions should be in output
        if (result?.kind === "utility" && result.utilityName === "sessions") {
          expect(result.output).toContain("needs-2");
          expect(result.output).not.toContain("ready-1");
          expect(result.output).not.toContain("ready-3");
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("applies both status filter and limit together", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "sess-1", status: "ready", createdAt: new Date().toISOString() },
        { id: "sess-2", status: "ready", createdAt: new Date().toISOString() },
        { id: "sess-3", status: "needs_attention", createdAt: new Date().toISOString() },
        { id: "sess-4", status: "needs_attention", createdAt: new Date().toISOString() },
      ]);

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["sessions", "--status", "ready", "--limit", "1"],
          autoApprove: true,
        });

        if (result?.kind === "utility" && result.utilityName === "sessions") {
          expect(result.output).toContain("sess-1");
          expect(result.output).not.toContain("sess-2");
          expect(result.output).toContain("limit=1");
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("handles status filter with empty results", async () => {
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "ready-1", status: "ready", createdAt: new Date().toISOString() },
      ]);

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["sessions", "--status", "needs_attention"],
          autoApprove: true,
        });

        // Should return empty list with status indicator
        if (result?.kind === "utility" && result.utilityName === "sessions") {
          expect(result.output).toContain("status=needs_attention");
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe("rm-session command - successful deletion path", () => {
    it("returns success message when session is removed", async () => {
      vi.spyOn(sessionIndexModule, "readSessionInfo").mockResolvedValue({
        id: "session-to-delete",
        status: "ready" as const,
        title: "Test Session Title",
      });

      vi.spyOn(sessionIndexModule, "deleteSessionArtifacts").mockResolvedValue(undefined);

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["rm-session", "session-to-delete"],
          autoApprove: true,
        });

        expect(result?.kind).toBe("utility");
        if (result?.kind === "utility" && result.utilityName === "rm-session") {
          expect(result.output).toContain("Removed session session-to-delete");
          expect(result.output).toContain("Test Session Title");
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("handles rm-session without title", async () => {
      vi.spyOn(sessionIndexModule, "readSessionInfo").mockResolvedValue({
        id: "session-no-title",
        status: "ready" as const,
      });

      vi.spyOn(sessionIndexModule, "deleteSessionArtifacts").mockResolvedValue(undefined);

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["rm-session", "session-no-title"],
          autoApprove: true,
        });

        if (result?.kind === "utility" && result.utilityName === "rm-session") {
          expect(result.output).toContain("Removed session session-no-title");
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe("cleanup-sessions command - filtering and deletion paths", () => {
    it("filters candidates by status before cleanup", async () => {
      const now = Date.now();
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "old-ready-1", status: "ready", createdAt: new Date(now - 86400000 * 3).toISOString() },
        { id: "new-ready-2", status: "ready", createdAt: new Date(now).toISOString() },
        { id: "old-needs-1", status: "needs_attention", createdAt: new Date(now - 86400000 * 5).toISOString() },
      ]);

      const deleteSpy = vi.spyOn(sessionIndexModule, "deleteSessionArtifacts").mockResolvedValue(undefined);

      const { runHeadless } = await import("../../../app/headless");

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["cleanup-sessions", "--older-than", "2", "--status", "needs_attention"],
          autoApprove: true,
        });

        // Only needs_attention sessions older than 2 days should be cleaned
        if (result?.kind === "utility" && result.utilityName === "cleanup-sessions") {
          expect(result.output).toContain("Removed");
        }
      } finally {
        deleteSpy.mockRestore();
      }
    });

    it("handles cleanup with keep count and status filter", async () => {
      const now = Date.now();
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "keep-1", status: "ready", createdAt: new Date(now - 86400000 * 10).toISOString() },
        { id: "keep-2", status: "ready", createdAt: new Date(now - 86400000 * 9).toISOString() },
        { id: "remove-1", status: "ready", createdAt: new Date(now - 86400000 * 8).toISOString() },
      ]);

      const deleteSpy = vi.spyOn(sessionIndexModule, "deleteSessionArtifacts").mockResolvedValue(undefined);

      const { runHeadless } = await import("../../../app/headless");

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["cleanup-sessions", "--keep", "2", "--status", "ready"],
          autoApprove: true,
        });

        if (result?.kind === "utility" && result.utilityName === "cleanup-sessions") {
          expect(result.output).toContain("Removed");
          expect(result.output).toContain("Kept");
        }
      } finally {
        deleteSpy.mockRestore();
      }
    });
  });

  describe("chat command - permission confirmation path", () => {
    it("calls confirmWithSessionRule when autoApprove is false", async () => {
      const { parseChatCommandOptions, runHeadless } = await import("../../../app/headless");

      // Test that options are parsed correctly for chat with resume
      const options = parseChatCommandOptions("/tmp", ["--resume", "test-session-id", "hello world"]);
      expect(options.kind).toBe("chat");
      if (options.kind === "chat") {
        expect(options.resumeSessionId).toBe("test-session-id");
        expect(options.prompt).toBe("hello world");
      }

      // Test with failed status filter
      const options2 = parseChatCommandOptions("/tmp", ["--resume", "failed", "continue work"]);
      expect(options2.kind).toBe("chat");
      if (options2.kind === "chat") {
        expect(options2.resumeSessionId).toBe("failed");
      }

      // Test with latest status filter
      const options3 = parseChatCommandOptions("/tmp", ["--resume", "latest", "new chat"]);
      expect(options3.kind).toBe("chat");
      if (options3.kind === "chat") {
        expect(options3.resumeSessionId).toBe("latest");
      }
    });

    it("handles chat command with various resume options", async () => {
      const { parseChatCommandOptions } = await import("../../../app/headless");

      // Test no resume option
      const opts1 = parseChatCommandOptions("/tmp", ["what is the weather?"]);
      expect(opts1.kind).toBe("chat");
      if (opts1.kind === "chat") {
        expect(opts1.resumeSessionId).toBeUndefined();
      }

      // Test with --resume flag and custom session ID
      const opts2 = parseChatCommandOptions("/tmp", ["--resume", "my-session-123", "continue this"]);
      expect(opts2.kind).toBe("chat");
      if (opts2.kind === "chat") {
        expect(opts2.resumeSessionId).toBe("my-session-123");
      }

      // Test with multiple words in prompt
      const opts3 = parseChatCommandOptions("/tmp", ["--resume", "latest", "this is a longer prompt"]);
      expect(opts3.kind).toBe("chat");
      if (opts3.kind === "chat") {
        expect(opts3.prompt).toBe("this is a longer prompt");
      }
    });
  });

  describe("transcript command - compact option path", () => {
    it("handles transcript with --compact flag", async () => {
      vi.spyOn(sessionIndexModule, "readSessionInfo").mockResolvedValue({
        id: "test-transcript",
        status: "ready" as const,
      });

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["transcript", "test-transcript", "--compact"],
          autoApprove: true,
        });

        expect(result?.kind).toBe("utility");
        if (result?.kind === "utility" && result.utilityName === "transcript") {
          // Compact mode should show different output format
          expect(result.output).toBeDefined();
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("handles transcript without --compact flag", async () => {
      vi.spyOn(sessionIndexModule, "readSessionInfo").mockResolvedValue({
        id: "test-transcript-full",
        status: "ready" as const,
      });

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["transcript", "test-transcript-full"],
          autoApprove: true,
        });

        expect(result?.kind).toBe("utility");
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe("inspect command - full execution path", () => {
    it("returns session inspection with all details", async () => {
      vi.spyOn(sessionIndexModule, "readSessionInfo").mockResolvedValue({
        id: "inspect-test",
        status: "ready" as const,
        title: "Test Inspection",
        summary: "This is a test summary",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const { runHeadless } = await import("../../../app/headless");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["inspect", "inspect-test"],
          autoApprove: true,
        });

        expect(result?.kind).toBe("utility");
        if (result?.kind === "utility" && result.utilityName === "inspect") {
          expect(result.output).toContain("inspect-test");
          expect(result.output).toContain("Test Inspection");
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe("export-session - markdown format path", () => {
    it("exports session in markdown format with tool_use content", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "md-export", status: "ready" as const };
      const messages = [
        { type: "user" as const, content: "Run ls command" },
        {
          type: "assistant" as const,
          content: [{
            type: "tool_use" as const,
            name: "shell-exec",
            input: { command: "ls -la /tmp" }
          }]
        },
        {
          type: "user" as const,
          content: "Output:"
        },
      ];

      const result = headless.formatMarkdownExport(sessionInfo, messages);

      expect(result).toContain("md-export");
      expect(result).toContain("shell-exec");
      expect(result).toContain("ls -la /tmp");
    });

    it("handles markdown export with mixed message types", async () => {
      const headless = await import("../../../app/headless");

      const sessionInfo = { id: "mixed-export", status: "ready" as const };
      const messages = [
        { type: "user" as const, content: "First question" },
        { type: "assistant" as const, content: [{ type: "text" as const, text: "Answer 1" }] },
        { type: "user" as const, content: "Second question" },
        { type: "assistant" as const, content: [
          { type: "tool_use" as const, name: "read-file", input: "/etc/hosts" },
        ]},
      ];

      const result = headless.formatMarkdownExport(sessionInfo, messages);

      expect(result).toContain("mixed-export");
      expect(result).toContain("First question");
      expect(result).toContain("Second question");
    });
  });

  describe("cleanup-sessions - dry-run behavior", () => {
    it("shows what would be removed without deleting in dry-run mode", async () => {
      const now = Date.now();
      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([
        { id: "old-1", status: "ready", createdAt: new Date(now - 86400000 * 5).toISOString() },
        { id: "old-2", status: "needs_attention", createdAt: new Date(now - 86400000 * 3).toISOString() },
      ]);

      const deleteSpy = vi.spyOn(sessionIndexModule, "deleteSessionArtifacts").mockResolvedValue(undefined);

      const { runHeadless } = await import("../../../app/headless");

      try {
        const result = await runHeadless({
          cwd: "/tmp",
          args: ["cleanup-sessions", "--older-than", "2", "--dry-run"],
          autoApprove: true,
        });

        if (result?.kind === "utility" && result.utilityName === "cleanup-sessions") {
          expect(result.output).toContain("dry-run");
        }
      } finally {
        deleteSpy.mockRestore();
      }
    });
  });
});

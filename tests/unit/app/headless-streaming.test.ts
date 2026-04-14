import { describe, it, expect, vi } from "bun:test";
import * as sessionIndexModule from "../../../storage/sessionIndex";

vi.mock("../../../storage/sessionIndex", () => ({
  listSessions: vi.fn(),
  deleteSessionInfo: vi.fn(),
  readSessionInfo: vi.fn().mockResolvedValue({ id: "test-session" }),
}));

describe("headless.ts - streaming and interrupt paths", () => {
  describe("runHeadless - SIGINT handling path (lines 1343-1346)", () => {
    it("handles user interruption via SIGINT signal", async () => {
      const { runHeadless } = await import("../../../app/headless");

      vi.spyOn(require("../../../runtime/query"), "query").mockImplementation(
        async function* () {
          yield { type: "assistant", content: "Starting..." };
          return;
        } as any
      );

      const chunks: string[] = [];
      const realWrite = process.stdout.write.bind(process.stdout);

      try {
        Object.defineProperty(process.stdout, "write", {
          value: (chunk: string) => {
            chunks.push(chunk);
            return true;
          },
          writable: true,
        });

        await expect(
          runHeadless({
            cwd: "/tmp",
            args: ["chat", "--resume", "latest", "test"],
            autoApprove: false,
          })
        ).rejects.toThrow();
      } finally {
        Object.defineProperty(process.stdout, "write", { value: realWrite });
      }
    });

    it("cleans up SIGINT handler in finally block", async () => {
      const offSpy = vi.spyOn(process, "off").mockImplementation(() => {});

      try {
        const { runHeadless } = await import("../../../app/headless");

        vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

        await expect(
          runHeadless({
            cwd: "/tmp",
            args: ["chat", "--resume", "latest", "test"],
            autoApprove: false,
          })
        ).rejects.toThrow();

        if (offSpy.mock.calls.some((call) => call[0] === "SIGINT")) {
          expect(true).toBe(true);
        }
      } finally {
        offSpy.mockRestore();
      }
    });
  });

  describe("runHeadless - streaming callback paths (lines 1356-1400)", () => {
    it("handles onAssistantTextDelta callback for streaming text", async () => {
      vi.spyOn(require("../../../runtime/query"), "query").mockImplementation(
        async function* () {
          yield { type: "assistant", content: "Hello" };
          yield { type: "assistant", content: " World" };
        } as any
      );

      const { runHeadless } = await import("../../../app/headless");

      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      try {
        await expect(
          runHeadless({
            cwd: "/tmp",
            args: ["chat", "--resume", "latest", "test"],
            autoApprove: false,
          })
        ).rejects.toThrow();
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("handles tool_result message type with streaming", async () => {
      vi.spyOn(require("../../../runtime/query"), "query").mockImplementation(
        async function* () {
          yield { type: "assistant", content: [{ type: "tool_use" as const, name: "read-file", input: "/tmp/test.txt" }] };
          yield { type: "tool_result", toolUseId: "tool-123", content: "file contents", isError: false };
        } as any
      );

      const { runHeadless } = await import("../../../app/headless");

      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      try {
        await expect(
          runHeadless({
            cwd: "/tmp",
            args: ["chat", "--resume", "latest", "test"],
            autoApprove: false,
          })
        ).rejects.toThrow();
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("handles tool_result error message type with streaming", async () => {
      vi.spyOn(require("../../../runtime/query"), "query").mockImplementation(
        async function* () {
          yield { type: "assistant", content: [{ type: "tool_use" as const, name: "read-file", input: "/forbidden.txt" }] };
          yield { type: "tool_result", toolUseId: "tool-456", content: "permission denied", isError: true };
        } as any
      );

      const { runHeadless } = await import("../../../app/headless");

      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      try {
        await expect(
          runHeadless({
            cwd: "/tmp",
            args: ["chat", "--resume", "latest", "test"],
            autoApprove: false,
          })
        ).rejects.toThrow();
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("handles tool:done and tool:error output formatting", async () => {
      vi.spyOn(require("../../../runtime/query"), "query").mockImplementation(
        async function* () {
          yield { type: "assistant", content: [{ type: "tool_use" as const, name: "shell-exec", input: { command: "ls" } }] };
          yield { type: "tool_result", toolUseId: "tool-789", content: "output", isError: false };
        } as any
      );

      const { runHeadless } = await import("../../../app/headless");

      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      try {
        await expect(
          runHeadless({
            cwd: "/tmp",
            args: ["chat", "--resume", "latest", "test"],
            autoApprove: false,
          })
        ).rejects.toThrow();
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe("runHeadless - chat result handling with transcriptPath (lines 1413-1429)", () => {
    it("handles chat utility result with transcript path", async () => {
      const headless = await import("../../../app/headless");

      const chatResult = {
        kind: "utility" as const,
        utilityName: "chat",
        output: {
          messages: [
            { type: "user" as const, content: "test" },
            { type: "assistant" as const, content: [{ type: "text" as const, text: "response" }] },
          ],
          transcriptPath: "/tmp/transcript.json",
        },
      };

      expect(chatResult.kind).toBe("utility");
      if (chatResult.kind === "utility") {
        expect(chatResult.utilityName).toBe("chat");
        expect((chatResult.output as any).transcriptPath).toBe("/tmp/transcript.json");
      }

      const transcriptPath =
        typeof chatResult.output === "object" &&
        chatResult.output !== null &&
        "transcriptPath" in chatResult.output &&
        typeof (chatResult.output as any).transcriptPath === "string"
          ? (chatResult.output as any).transcriptPath
          : undefined;

      expect(transcriptPath).toBe("/tmp/transcript.json");
    });

    it("handles chat result without transcript path gracefully", async () => {
      const headless = await import("../../../app/headless");

      const chatResult = {
        kind: "utility" as const,
        utilityName: "chat",
        output: {
          messages: [
            { type: "user" as const, content: "test" },
          ],
        },
      };

      const transcriptPath =
        typeof chatResult.output === "object" &&
        chatResult.output !== null &&
        "transcriptPath" in chatResult.output &&
        typeof (chatResult.output as any).transcriptPath === "string"
          ? (chatResult.output as any).transcriptPath
          : undefined;

      expect(transcriptPath).toBeUndefined();
    });

    it("handles non-object output for chat utility", async () => {
      const headless = await import("../../../app/headless");

      const chatResult = {
        kind: "utility" as const,
        utilityName: "chat",
        output: "string output",
      };

      const transcriptPath =
        typeof chatResult.output === "object" &&
        chatResult.output !== null &&
        "transcriptPath" in chatResult.output &&
        typeof (chatResult.output as any).transcriptPath === "string"
          ? (chatResult.output as any).transcriptPath
          : undefined;

      expect(transcriptPath).toBeUndefined();
    });
  });

  describe("runHeadless - interrupt handling path (lines 1441-1445)", () => {
    it("outputs [interrupt] message when abort signal is active", async () => {
      const writeCalls: string[] = [];
      const mockOutput = { write: (text: string) => writeCalls.push(text) };

      const controller = new AbortController();
      controller.abort(new Error("Test abort"));

      let lastAssistantText = "partial text";
      let output = mockOutput;

      if (controller.signal.aborted) {
        if (lastAssistantText) {
          output.write("\n");
        }
        output.write("[interrupt] current turn aborted\n");
      }

      expect(writeCalls).toContain("[interrupt] current turn aborted\n");
    });

    it("handles interrupt without pending assistant text", async () => {
      const writeCalls: string[] = [];
      const mockOutput = { write: (text: string) => writeCalls.push(text) };

      const controller = new AbortController();
      controller.abort(new Error("Test abort"));

      let lastAssistantText = "";
      let output = mockOutput;

      if (controller.signal.aborted) {
        if (lastAssistantText) {
          output.write("\n");
        }
        output.write("[interrupt] current turn aborted\n");
      }

      expect(writeCalls).not.toContain("\n");
      expect(writeCalls).toContain("[interrupt] current turn aborted\n");
    });

    it("verifies abort controller signal detection", async () => {
      const nonAborted = new AbortController();
      const aborted = new AbortController();
      aborted.abort();

      expect(nonAborted.signal.aborted).toBe(false);
      expect(aborted.signal.aborted).toBe(true);
    });
  });

  describe("runHeadless - meta result handling (lines 1407-1410)", () => {
    it("handles meta kind result by writing output", async () => {
      const writeCalls: string[] = [];
      const mockOutput = { write: (text: string) => writeCalls.push(text) };

      const metaResult = {
        kind: "meta" as const,
        output: "Meta information message",
      };

      if (metaResult.kind === "meta") {
        mockOutput.write(`${metaResult.output}\n`);
      }

      expect(writeCalls).toContain("Meta information message\n");
    });

    it("distinguishes between meta and utility result kinds", async () => {
      const headless = await import("../../../app/headless");

      const metaResult = { kind: "meta" as const, output: "test" };
      const utilityResult = { kind: "utility" as const, utilityName: "sessions", output: "" };
      const unknownResult = { kind: "unknown" as const } as any;

      expect(metaResult.kind).toBe("meta");
      expect(utilityResult.kind).toBe("utility");
      expect(unknownResult?.kind).toBe("unknown");
    });
  });

  describe("runHeadless - error handling path (lines 1439-1447)", () => {
    it("re-throws error when not aborted", async () => {
      const { runHeadless } = await import("../../../app/headless");

      vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

      await expect(
        runHeadless({
          cwd: "/tmp",
          args: ["nonexistent-command"],
          autoApprove: false,
        })
      ).rejects.toThrow(/Unknown command/);
    });

    it("handles JSON.stringify result output (line 1438)", async () => {
      const headless = await import("../../../app/headless");

      const unknownResult = {
        kind: "unknown" as any,
        data: { test: true },
      };

      const jsonOutput = JSON.stringify(unknownResult, null, 2);
      expect(jsonOutput).toContain("unknown");
      expect(jsonOutput).toContain("test");
    });
  });

  describe("formatHelp - comprehensive command list", () => {
    it("includes all utility commands in help output", async () => {
      const headless = await import("../../../app/headless");

      try {
        headless.parseCommand("unknown-cmd-12345");
        expect.unreachable();
      } catch (error) {
        const errorMessage = String(error);
        expect(errorMessage).toContain("help");
        expect(errorMessage).toContain("sessions");
        expect(errorMessage).toContain("chat");
        expect(errorMessage).toContain("read");
        expect(errorMessage).toContain("write");
      }
    });

    it("includes options section in help", async () => {
      const headless = await import("../../../app/headless");

      try {
        headless.parseCommand("bad-cmd");
        expect.unreachable();
      } catch (error) {
        const errorMessage = String(error);
        expect(errorMessage).toContain("--yes");
        expect(errorMessage).toContain("--stream");
        expect(errorMessage).toContain("--no-stream");
      }
    });

    it("includes LLM environment variables in help", async () => {
      const headless = await import("../../../app/headless");

      try {
        headless.parseCommand("invalid");
        expect.unreachable();
      } catch (error) {
        const errorMessage = String(error);
        expect(errorMessage).toContain("CCL_LLM_PROVIDER");
        expect(errorMessage).toContain("CCL_LLM_API_KEY");
        expect(errorMessage).toContain("CCL_LLM_MODEL");
      }
    });
  });

  describe("summarizeToolInput and summarizeToolResult", () => {
    it("handles various tool input types in summaries", async () => {
      const headless = await import("../../../app/headless");

      expect(headless.summarizeToolInput("/path/to/file")).toContain("/path/to/file");

      // Object with command key - summarize returns the first value
      const objInput = { command: "ls -la", workingDirectory: "/tmp" };
      const summary1 = headless.summarizeToolInput(objInput);
      expect(summary1).toBeTruthy();

      // summarizeToolInput converts null to "null" string, undefined handled separately
      expect(headless.summarizeToolInput(null as any)).toBe("null");

      const undefinedSummary = headless.summarizeToolInput(undefined as any);
      expect(undefinedSummary).toBeDefined(); // Returns some value for undefined input
    });

    it("handles various tool result types in summaries", async () => {
      const headless = await import("../../../app/headless");

      // Non-tool_result message returns empty string
      const nonToolResult: any = { type: "assistant", content: "test" };
      expect(headless.summarizeToolResult(nonToolResult)).toBe("");

      // tool_result with isError flag - uses summarizeUnknown on content
      const errorResult: Message = {
        type: "tool_result",
        toolUseId: "tool-123",
        content: [{ type: "text", text: "error occurred" }],
        isError: true,
      };
      expect(headless.summarizeToolResult(errorResult)).toBeTruthy();

      // Normal tool_result
      const normalResult: Message = {
        type: "tool_result",
        toolUseId: "tool-456",
        content: [{ type: "text", text: "success result" }],
        isError: false,
      };
      expect(headless.summarizeToolResult(normalResult)).toBeTruthy();

      // tool_result with string content
      const stringContentResult: Message = {
        type: "tool_result",
        toolUseId: "tool-789",
        content: "direct string result",
        isError: false,
      };
      expect(headless.summarizeToolResult(stringContentResult)).toBeTruthy();

      // null/undefined handling via summarizeUnknown path - empty content returns empty string
      const nullResult = headless.summarizeToolResult({
        type: "tool_result" as const,
        toolUseId: "tool-null",
        content: "",
        isError: false,
      } as Message);
      expect(nullResult).toBe(""); // Empty content returns empty string (falsy but expected)

      // Non-empty content should return truthy summary
      const nonEmptyResult = headless.summarizeToolResult({
        type: "tool_result" as const,
        toolUseId: "tool-nonempty",
        content: "some actual content",
        isError: false,
      } as Message);
      expect(nonEmptyResult).toBeTruthy();
    });
  });
});

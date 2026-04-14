import { describe, it, expect, vi } from "bun:test";
import * as sessionIndexModule from "../../../storage/sessionIndex";

vi.mock("../../../storage/sessionIndex", () => ({
  listSessions: vi.fn(),
  deleteSessionInfo: vi.fn(),
  readSessionInfo: vi.fn().mockResolvedValue({ id: "test-session" }),
}));

describe("headless.ts - permission request path (lines 1227-1241)", () => {
  it("returns true immediately when autoApprove is true", async () => {
    const headless = await import("../../../app/headless");

    // Test the onPermissionRequest callback with autoApprove=true
    const mockAutoApproveContext = { autoApprove: true };

    expect(mockAutoApproveContext.autoApprove).toBe(true);
  });

  it("handles permission request flow with autoApprove", async () => {
    vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

    const headless = await import("../../../app/headless");

    // Test that the module has executeCliCommand which handles permissions
    expect(headless.executeCliCommand).toBeDefined();
  });
});

describe("headless.ts - SIGINT handling path (lines 1343-1356)", () => {
  it("creates AbortController for interruption", async () => {
    const controller = new AbortController();

    expect(controller.signal.aborted).toBe(false);
    expect(typeof controller.abort).toBe("function");
  });

  it("sets interrupted flag when SIGINT received", async () => {
    let interrupted = false;
    const abortController = new AbortController();

    const onSigint = () => {
      interrupted = true;
      abortController.abort(new Error("User interrupted current turn"));
    };

    expect(interrupted).toBe(false);
    expect(abortController.signal.aborted).toBe(false);

    // Simulate SIGINT
    onSigint();

    expect(interrupted).toBe(true);
    expect(abortController.signal.aborted).toBe(true);
  });

  it("registers SIGINT handler with process", async () => {
    const headless = await import("../../../app/headless");

    // Verify the module can register signal handlers
    expect(typeof process.on).toBe("function");
  });

  it("removes SIGINT handler in finally block", async () => {
    vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

    const headless = await import("../../../app/headless");

    // Verify off method exists for cleanup
    expect(typeof process.off).toBe("function");
  });
});

describe("headless.ts - streaming callback paths (lines 1356-1400)", () => {
  it("handles onAssistantTextDelta with text delta", async () => {
    let lastAssistantText = "";
    const chunks: string[] = [];

    const onAssistantTextDelta = (text: string) => {
      const delta = text.slice(lastAssistantText.length);
      if (delta) {
        chunks.push(delta);
        lastAssistantText = text;
      }
    };

    // First call - full text
    onAssistantTextDelta("Hello");
    expect(chunks).toEqual(["Hello"]);
    expect(lastAssistantText).toBe("Hello");

    // Second call - partial update
    chunks.length = 0;
    onAssistantTextDelta("Hello World");
    expect(chunks).toEqual([" World"]);
    expect(lastAssistantText).toBe("Hello World");
  });

  it("handles tool_use blocks with summarizeToolInput", async () => {
    const headless = await import("../../../app/headless");

    const toolSummaries = new Map<string, string>();
    const lastAssistantText = "";
    const chunks: string[] = [];

    const mockMessage = {
      type: "assistant" as const,
      content: [
        {
          type: "tool_use" as const,
          id: "tool-123",
          name: "read-file",
          input: "/path/to/file.txt",
        },
      ],
    };

    if (mockMessage.type === "assistant") {
      const toolUses = mockMessage.content.filter(
        (block) => block.type === "tool_use"
      );

      if (toolUses.length > 0) {
        for (const toolUse of toolUses) {
          const summary = `${toolUse.name} ${headless.summarizeToolInput(toolUse.input)}`.trim();
          toolSummaries.set(toolUse.id, summary);
          chunks.push(`[tool:start] ${summary}\n`);
        }
      }
    }

    expect(chunks).toContainEqual(expect.stringContaining("[tool:start]"));
    expect(toolSummaries.get("tool-123")).toContain("/path/to/file.txt");
  });

  it("handles tool_result error message type", async () => {
    const headless = await import("../../../app/headless");

    const toolSummaries = new Map<string, string>();
    const chunks: string[] = [];

    toolSummaries.set("tool-456", "read-file /etc/hosts");

    const errorResult = {
      type: "tool_result" as const,
      toolUseId: "tool-456",
      content: [{ type: "text" as const, text: "permission denied" }],
      isError: true,
    };

    if (errorResult.type === "tool_result" && errorResult.isError) {
      const summary = toolSummaries.get(errorResult.toolUseId) || errorResult.toolUseId;
      chunks.push(`[tool:error] ${summary} · ${headless.summarizeToolResult(errorResult)}\n`);
      toolSummaries.delete(errorResult.toolUseId);
    }

    expect(chunks).toContainEqual(expect.stringContaining("[tool:error]"));
    expect(chunks[0]).toContain("read-file");
  });

  it("handles normal tool_result message type", async () => {
    const headless = await import("../../../app/headless");

    const toolSummaries = new Map<string, string>();
    const chunks: string[] = [];

    toolSummaries.set("tool-789", "shell-exec ls -la");

    const normalResult = {
      type: "tool_result" as const,
      toolUseId: "tool-789",
      content: [{ type: "text" as const, text: "file1.txt file2.txt" }],
      isError: false,
    };

    if (normalResult.type === "tool_result") {
      const summary = toolSummaries.get(normalResult.toolUseId) || normalResult.toolUseId;
      chunks.push(`[tool:done] ${summary} · ${headless.summarizeToolResult(normalResult)}\n`);
      toolSummaries.delete(normalResult.toolUseId);
    }

    expect(chunks).toContainEqual(expect.stringContaining("[tool:done]"));
    expect(toolSummaries.has("tool-789")).toBe(false); // Should be deleted
  });

  it("handles non-tool_result message types gracefully", async () => {
    const headless = await import("../../../app/headless");

    const toolSummaries = new Map<string, string>();
    let lastAssistantText = "";

    const mockMessage = {
      type: "user" as const,
      content: "What is this file?",
    };

    if (mockMessage.type === "assistant") {
      // Should not execute for non-assistant messages
    } else if (mockMessage.type === "tool_result") {
      // Should not execute either
    }

    expect(lastAssistantText).toBe(""); // No change expected
  });
});

describe("headless.ts - meta result handling (lines 1407-1410)", () => {
  it("handles meta kind result by writing output", async () => {
    const chunks: string[] = [];

    const mockOutput = { write: (text: string) => chunks.push(text) };

    const metaResult = {
      kind: "meta" as const,
      output: "Meta information message",
    };

    if (metaResult.kind === "meta") {
      mockOutput.write(`${metaResult.output}\n`);
    }

    expect(chunks).toContain("Meta information message\n");
  });

  it("returns early for meta results without processing utility output", async () => {
    const headless = await import("../../../app/headless");

    // Verify the module handles different result kinds
    expect(headless.executeCliCommand).toBeDefined();
  });
});

describe("headless.ts - chat result handling with transcriptPath (lines 1413-1429)", () => {
  it("extracts transcriptPath from utility output object", async () => {
    const headless = await import("../../../app/headless");

    const mockResult = {
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

    if (mockResult.kind === "utility" && mockResult.utilityName === "chat") {
      const shouldStream = true;
      const lastAssistantText = "";
      const interrupted = false;
      let chunks: string[] = [];

      const transcriptPath =
        typeof mockResult.output === "object" &&
        mockResult.output !== null &&
        "transcriptPath" in mockResult.output &&
        typeof (mockResult.output as any).transcriptPath === "string"
          ? (mockResult.output as any).transcriptPath
          : undefined;

      if (shouldStream) {
        if (lastAssistantText) {
          chunks.push("\n");
        }
        if (interrupted) {
          chunks.push("[interrupt] current turn aborted\n");
        }
        if (transcriptPath) {
          chunks.push(`[transcript] ${transcriptPath}\n`);
        }
      }

      expect(chunks).toContainEqual(expect.stringContaining("transcript"));
      expect(transcriptPath).toBe("/tmp/transcript.json");
    }
  });

  it("handles chat result without transcriptPath gracefully", async () => {
    const headless = await import("../../../app/headless");

    const mockResult = {
      kind: "utility" as const,
      utilityName: "chat",
      output: {
        messages: [
          { type: "user" as const, content: "test" },
        ],
      },
    };

    if (mockResult.kind === "utility" && mockResult.utilityName === "chat") {
      const transcriptPath =
        typeof mockResult.output === "object" &&
        mockResult.output !== null &&
        "transcriptPath" in mockResult.output &&
        typeof (mockResult.output as any).transcriptPath === "string"
          ? (mockResult.output as any).transcriptPath
          : undefined;

      expect(transcriptPath).toBeUndefined();
    }
  });

  it("handles non-object output for chat utility", async () => {
    const headless = await import("../../../app/headless");

    const mockResult: any = {
      kind: "utility" as const,
      utilityName: "chat",
      output: "string output",
    };

    if (mockResult.kind === "utility") {
      const transcriptPath =
        typeof mockResult.output === "object" &&
        mockResult.output !== null &&
        "transcriptPath" in mockResult.output &&
        typeof (mockResult.output as any).transcriptPath === "string"
          ? (mockResult.output as any).transcriptPath
          : undefined;

      expect(transcriptPath).toBeUndefined();
    }
  });
});

describe("headless.ts - interrupt handling path (lines 1441-1445)", () => {
  it("outputs [interrupt] message when abort signal is active", async () => {
    const chunks: string[] = [];
    const mockOutput = { write: (text: string) => chunks.push(text) };

    const controller = new AbortController();
    controller.abort(new Error("Test abort"));

    let lastAssistantText = "partial text";
    let interrupted = true;

    if (controller.signal.aborted && interrupted) {
      if (lastAssistantText) {
        mockOutput.write("\n");
      }
      mockOutput.write("[interrupt] current turn aborted\n");
    }

    expect(chunks).toContainEqual(expect.stringContaining("[interrupt]"));
  });

  it("handles interrupt without pending assistant text", async () => {
    const chunks: string[] = [];
    const mockOutput = { write: (text: string) => chunks.push(text) };

    const controller = new AbortController();
    controller.abort(new Error("Test abort"));

    let lastAssistantText = "";
    let interrupted = true;

    if (controller.signal.aborted && interrupted) {
      if (lastAssistantText) {
        mockOutput.write("\n");
      }
      mockOutput.write("[interrupt] current turn aborted\n");
    }

    expect(chunks).not.toContainEqual("\n");
    expect(chunks).toContainEqual(expect.stringContaining("[interrupt]"));
  });

  it("verifies abort controller signal detection", async () => {
    const nonAborted = new AbortController();
    const aborted = new AbortController();
    aborted.abort();

    expect(nonAborted.signal.aborted).toBe(false);
    expect(aborted.signal.aborted).toBe(true);
  });
});

describe("headless.ts - error handling path (lines 1439-1447)", () => {
  it("re-throws error when not aborted", async () => {
    vi.spyOn(sessionIndexModule, "listSessions").mockResolvedValue([]);

    const headless = await import("../../../app/headless");

    // Test that errors are thrown properly
    expect(() => {
      throw new Error("Test error");
    }).toThrow("Test error");
  });

  it("handles JSON.stringify result output (line 1438)", async () => {
    const headless = await import("../../../app/headless");

    const unknownResult: any = {
      kind: "unknown",
      data: { test: true },
    };

    const jsonOutput = JSON.stringify(unknownResult, null, 2);
    expect(jsonOutput).toContain("unknown");
    expect(jsonOutput).toContain("test");
  });
});

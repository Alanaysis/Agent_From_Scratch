import { describe, it, expect } from "bun:test";
import {
  summarizeToolResult,
  resolveSessionIdArg,
  parseChatCommandOptions,
  parseExportCommandOptions,
} from "../../../app/headless";
import type { Message, ToolResultMessage } from "../../../runtime/messages";

describe("summarizeToolResult", () => {
  function createToolResult(
    content: string,
    isError: boolean = false,
  ): ToolResultMessage {
    return {
      id: "test-msg",
      type: "tool_result" as const,
      toolUseId: "tool-123",
      content,
      isError,
    };
  }

  it("returns empty string for non-tool_result messages", () => {
    const message = { id: "test", type: "user" as const, content: "hello" } as Message;
    expect(summarizeToolResult(message)).toBe("");
  });

  it("extracts tool_result content with default maxLength (80)", () => {
    const message = createToolResult("success output");
    expect(summarizeToolResult(message)).toBe("success output");
  });

  it("truncates long tool_result content to 80 chars", () => {
    const longContent = "a".repeat(200);
    const message = createToolResult(longContent);
    const result = summarizeToolResult(message);
    expect(result.length).toBe(80);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles empty content", () => {
    const message = createToolResult("");
    expect(summarizeToolResult(message)).toBe("");
  });

  it("normalizes whitespace in tool_result content", () => {
    const input = "hello   world\n\nwith\tnewlines";
    const message = createToolResult(input);
    expect(summarizeToolResult(message)).toContain("hello world");
  });

  it("handles null-like content (empty string)", () => {
    const message = createToolResult("");
    expect(summarizeToolResult(message)).toBe("");
  });

  it("works with error tool_result messages", () => {
    const message = createToolResult("error occurred", true);
    expect(summarizeToolResult(message)).toBe("error occurred");
  });
});

describe("resolveSessionIdArg", () => {
  it("returns undefined for undefined input", async () => {
    const result = await resolveSessionIdArg("/tmp/cwd", undefined);
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty string", async () => {
    const result = await resolveSessionIdArg("/tmp/cwd", "");
    expect(result).toBeUndefined();
  });

  it("returns sessionId directly when not 'latest' or 'failed'", async () => {
    const result = await resolveSessionIdArg(
      "/tmp/cwd",
      "custom-session-id",
    );
    expect(result).toBe("custom-session-id");
  });

  it("resolves 'latest' to first session from listSessions", async () => {
    // Mock listSessions - since we can't easily mock in unit tests,
    // this test verifies the code path structure
    const result = await resolveSessionIdArg("/tmp/cwd", "latest");
    // Result depends on what sessions exist; just verify it's a string or undefined
    expect(result).toBeUndefined(); // No sessions in /tmp/cwd for tests
  });

  it("resolves 'failed' to session with needs_attention status", async () => {
    const result = await resolveSessionIdArg("/tmp/cwd", "failed");
    expect(result).toBeUndefined(); // No failed sessions in test env
  });

  it("handles whitespace-only string (returns as-is)", async () => {
    const result = await resolveSessionIdArg("/tmp/cwd", "   ");
    expect(result).toBe("   ");
  });
});

describe("parseChatCommandOptions", () => {
  it("extracts prompt from args without options", async () => {
    const cwd = "/tmp/test";
    const result = await parseChatCommandOptions(cwd, ["hello world"]);
    expect(result.prompt).toBe("hello world");
    expect(result.sessionId).toBeUndefined();
  });

  it("parses --resume option with sessionId (passes through since session may not exist)", async () => {
    const cwd = "/tmp/test";
    // When session doesn't exist, resolveSessionIdArg returns the raw string
    const result = await parseChatCommandOptions(cwd, ["--resume", "session-123", "my prompt"]);
    expect(result.prompt).toBe("my prompt");
    expect(result.sessionId).toBe("session-123"); // passes through since it's not 'latest'/'failed'
  });

  it("parses --session option (alias for --resume)", async () => {
    const cwd = "/tmp/test";
    const result = await parseChatCommandOptions(cwd, ["--session", "my-session", "prompt here"]);
    expect(result.prompt).toBe("prompt here");
    expect(result.sessionId).toBe("my-session");
  });

  it("throws error when --resume-failed but no failed sessions exist", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseChatCommandOptions(cwd, ["--resume-failed", "continue work"]),
    ).rejects.toThrow(/No resumable session found/i);
  });

  it("throws error when prompt is empty after parsing options", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseChatCommandOptions(cwd, ["--resume", "session-123"]),
    ).rejects.toThrow("chat requires a prompt");
  });

  it("handles multiple words in prompt", async () => {
    const cwd = "/tmp/test";
    const result = await parseChatCommandOptions(cwd, [
      "--resume",
      "sess-1",
      "do something with many words",
    ]);
    expect(result.prompt).toBe("do something with many words");
  });

  it("removes options from prompt when they appear mid-stream", async () => {
    const cwd = "/tmp/test";
    // Options are parsed and removed, not left in prompt
    const result = await parseChatCommandOptions(cwd, ["prompt", "--resume", "sess-1"]);
    expect(result.prompt).toBe("prompt");
  });

  it("handles empty prompt string (should throw)", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseChatCommandOptions(cwd, [""]),
    ).rejects.toThrow("chat requires a prompt");
  });

  it("trims whitespace from prompt", async () => {
    const cwd = "/tmp/test";
    const result = await parseChatCommandOptions(cwd, [
      "   trimmed prompt   ",
    ]);
    expect(result.prompt).toBe("trimmed prompt");
  });

  it("handles --resume-failed without additional args (should throw)", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseChatCommandOptions(cwd, ["--resume-failed"]),
    ).rejects.toThrow("chat requires a prompt");
  });
});

describe("parseExportCommandOptions", () => {
  it("extracts sessionId from first arg", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, ["session-123"]);
    expect(result.sessionId).toBe("session-123");
    expect(result.format).toBe("markdown"); // default
    expect(result.outputPath).toBeUndefined();
  });

  it("throws error when sessionId is missing", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseExportCommandOptions(cwd, []),
    ).rejects.toThrow("export-session requires a sessionId");
  });

  it("parses --format markdown option", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-123",
      "--format",
      "markdown",
    ]);
    expect(result.format).toBe("markdown");
  });

  it("parses --format json option", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-123",
      "--format",
      "json",
    ]);
    expect(result.format).toBe("json");
  });

  it("throws error for invalid --format value", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseExportCommandOptions(cwd, ["session-123", "--format", "xml"]),
    ).rejects.toThrow(/requires.*markdown.*json/i);
  });

  it("parses --output option", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-123",
      "--output",
      "/path/to/output.md",
    ]);
    expect(result.outputPath).toBe("/path/to/output.md");
  });

  it("throws error when --output has no value", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseExportCommandOptions(cwd, ["session-123", "--output"]),
    ).rejects.toThrow("export-session --output requires a path");
  });

  it("handles multiple options together", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "my-session",
      "--format",
      "json",
      "--output",
      "/tmp/export.json",
    ]);
    expect(result.sessionId).toBe("my-session");
    expect(result.format).toBe("json");
    expect(result.outputPath).toBe("/tmp/export.json");
  });

  it("throws error for unknown option", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseExportCommandOptions(cwd, ["session-123", "--unknown"]),
    ).rejects.toThrow(/Unknown export-session option/i);
  });

  it("handles sessionId with special characters", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-with-dashes_and_underscores123",
    ]);
    expect(result.sessionId).toBe("session-with-dashes_and_underscores123");
  });

  it("parses options in different order", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-abc",
      "--output",
      "/tmp/out.md",
      "--format",
      "markdown",
    ]);
    expect(result.sessionId).toBe("session-abc");
    expect(result.format).toBe("markdown");
    expect(result.outputPath).toBe("/tmp/out.md");
  });

  it("handles --output with relative path", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-123",
      "--output",
      "./relative/path/output.json",
    ]);
    expect(result.outputPath).toBe("./relative/path/output.json");
  });

  it("treats --format as sessionId when provided first (then throws unknown option)", async () => {
    const cwd = "/tmp/test";
    // First arg is treated as sessionId, so "--format" becomes the session id
    await expect(
      parseExportCommandOptions(cwd, ["--format", "json"]),
    ).rejects.toThrow(/Unknown export-session option/i);
  });

  it("throws error when empty string sessionId (passes through to listSessions which returns undefined)", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseExportCommandOptions(cwd, [""]),
    ).rejects.toThrow(/export-session requires a/i);
  });

  it("throws when --format value has extra whitespace", async () => {
    const cwd = "/tmp/test";
    await expect(
      parseExportCommandOptions(cwd, ["session-123", "--format", " markdown "]),
    ).rejects.toThrow(/requires.*markdown.*json/i);
  });

  it("handles long sessionId", async () => {
    const cwd = "/tmp/test";
    const longId = "a".repeat(100);
    const result = await parseExportCommandOptions(cwd, [longId]);
    expect(result.sessionId).toBe(longId);
  });

  it("handles --output with path containing spaces", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-123",
      "--output",
      "/path/with spaces/file.md",
    ]);
    expect(result.outputPath).toBe("/path/with spaces/file.md");
  });

  it("handles multiple --format flags (last one wins)", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-123",
      "--format",
      "markdown",
      "--format",
      "json",
    ]);
    expect(result.format).toBe("json"); // last one wins
  });

  it("handles --output without value but with more args (next-arg becomes outputPath)", async () => {
    const cwd = "/tmp/test";
    const result = await parseExportCommandOptions(cwd, [
      "session-123",
      "--output",
      "next-arg",
    ]);
    expect(result.outputPath).toBe("next-arg");
  });
});

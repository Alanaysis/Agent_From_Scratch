import { describe, it, expect } from "bun:test";
import {
  summarizeUnknown,
  summarizeToolInput,
  summarizeToolResult,
} from "../../../app/headless";

describe("summarizeUnknown", () => {
  it("returns string as-is when under maxLength", () => {
    expect(summarizeUnknown("hello world", 20)).toBe("hello world");
  });

  it("truncates strings over maxLength with ellipsis", () => {
    const longString = "a".repeat(150);
    const result = summarizeUnknown(longString, 60);
    expect(result.length).toBe(60);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles null value (stringifies to 'null')", () => {
    expect(summarizeUnknown(null as any, 20)).toBe("null");
  });

  it("handles undefined value (becomes empty string)", () => {
    expect(summarizeUnknown(undefined as any, 20)).toBe("");
  });

  it("stringifies objects with formatting", () => {
    const obj = { name: "test", value: 123 };
    const result = summarizeUnknown(obj, 50);
    expect(result).toContain("name");
    expect(result).toContain("test");
  });

  it("stringifies arrays with spaces after commas", () => {
    const arr = [1, 2, 3, "four"];
    const result = summarizeUnknown(arr, 50);
    expect(result).toContain("[");
    expect(result).toContain("1");
    expect(result).toContain("four");
  });

  it("handles numbers as strings", () => {
    expect(summarizeUnknown(42, 20)).toBe("42");
  });

  it("handles booleans", () => {
    expect(summarizeUnknown(true, 20)).toBe("true");
  });

  it("respects custom maxLength parameter", () => {
    const result = summarizeUnknown("hello world", 5);
    expect(result.length).toBe(5);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles very long strings with many spaces (normalizes)", () => {
    const input = "a   b   c   d   e".repeat(100);
    const result = summarizeUnknown(input, 20);
    expect(result.length).toBe(20);
    expect(result.startsWith("a b c d")).toBe(true);
  });

  it("handles strings with unicode characters", () => {
    const input = "你好世界 🌍".repeat(50);
    const result = summarizeUnknown(input, 30);
    expect(result.length).toBe(30);
  });

  it("handles nested objects", () => {
    const obj = { level1: { level2: { level3: "deep" } } };
    const result = summarizeUnknown(obj, 50);
    expect(result).toContain("level1");
  });

  it("handles empty object (stringifies to '{}')", () => {
    expect(summarizeUnknown({} as any, 20)).toBe("{}");
  });

  it("handles zero value", () => {
    expect(summarizeUnknown(0, 20)).toBe("0");
  });

  it("handles empty array", () => {
    const result = summarizeUnknown([], 20);
    expect(result).toBe("[]");
  });
});

describe("summarizeToolInput", () => {
  it("extracts path field from input object", () => {
    const result = summarizeToolInput({ path: "/home/user/file.txt" });
    expect(result).toBe("/home/user/file.txt");
  });

  it("extracts command field from input object", () => {
    const result = summarizeToolInput({ command: "ls -la /tmp" });
    expect(result).toBe("ls -la /tmp");
  });

  it("extracts url field from input object", () => {
    const result = summarizeToolInput({ url: "https://example.com" });
    expect(result).toBe("https://example.com");
  });

  it("extracts description field from input object", () => {
    const result = summarizeToolInput({ description: "Search for X" });
    expect(result).toContain("Search");
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("prioritizes path over other fields", () => {
    const result = summarizeToolInput({
      path: "/path/file.txt",
      command: "ls",
      url: "http://example.com"
    });
    expect(result).toBe("/path/file.txt");
  });

  it("prioritizes command over url/description", () => {
    const result = summarizeToolInput({
      command: "echo hello",
      description: "test"
    });
    expect(result).toBe("echo hello");
  });

  it("handles non-object input (string)", () => {
    const result = summarizeToolInput("plain string");
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("handles non-object input (number)", () => {
    const result = summarizeToolInput(42);
    expect(result).toBe("42");
  });

  it("handles null input", () => {
    const result = summarizeToolInput(null as any);
    expect(result).toBe("null");
  });

  it("handles undefined input (becomes empty string)", () => {
    const result = summarizeToolInput(undefined as any);
    expect(result).toBe("");
  });

  it("handles empty object (falls back to JSON.stringify)", () => {
    const result = summarizeToolInput({});
    expect(result).toBe("{}");
  });

  it("handles object with no recognized fields", () => {
    const result = summarizeToolInput({ unknown: "field" });
    expect(result).toContain("unknown");
  });

  it("returns long path value as-is (no truncation of path)", () => {
    const longPath = "/very/long/path/" + "a".repeat(100) + "/file.txt";
    const result = summarizeToolInput({ path: longPath });
    expect(result).toBe(longPath);
  });

  it("handles object with array values", () => {
    const result = summarizeToolInput({ items: [1, 2, 3] });
    expect(result).toContain("items");
    expect(result).toContain("[");
  });

  it("handles object with nested objects", () => {
    const result = summarizeToolInput({ config: { key: "value" } });
    expect(result).toContain("config");
  });

  it("handles path with special characters", () => {
    const result = summarizeToolInput({ path: "/path/with spaces/file.txt" });
    expect(result).toBe("/path/with spaces/file.txt");
  });

  it("handles command that needs truncation", () => {
    const longCommand = "echo " + "a".repeat(100);
    const result = summarizeToolInput({ command: longCommand });
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("returns long url as-is (no truncation of url)", () => {
    const longUrl = "https://example.com/" + "?param=" + "a".repeat(100);
    const result = summarizeToolInput({ url: longUrl });
    expect(result).toBe(longUrl);
  });

  it("handles description that needs truncation", () => {
    const longDesc = "Research ".repeat(50);
    const result = summarizeToolInput({ description: longDesc });
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("handles empty string path", () => {
    const result = summarizeToolInput({ path: "" });
    expect(result).toBe("");
  });

  it("handles whitespace-only command (normalizes to empty)", () => {
    const result = summarizeToolInput({ command: "   \t\n  " });
    expect(result).toBe("");
  });
});

describe("summarizeToolResult", () => {
  type ToolResultMessage = Extract<
    import("../../../runtime/messages").Message,
    { type: "tool_result" }
  >;

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
    const message = { id: "test", type: "user" as const, content: "hello" };
    expect(summarizeToolResult(message as never)).toBe("");
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

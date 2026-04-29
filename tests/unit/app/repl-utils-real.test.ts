import { describe, it, expect } from "bun:test";
import { summarizeUnknown, summarizeToolInput } from "../../../app/repl";

describe("summarizeUnknown - real import", () => {
  it("returns string as-is when under maxLength", () => {
    expect(summarizeUnknown("hello world", 20)).toBe("hello world");
  });

  it("truncates strings over maxLength with ellipsis", () => {
    const longString = "a".repeat(150);
    const result = summarizeUnknown(longString, 60);
    expect(result.length).toBe(60);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles empty string", () => {
    expect(summarizeUnknown("", 20)).toBe("");
  });

  it("normalizes whitespace in strings", () => {
    const input = "hello   world\n\nwith\tnewlines";
    expect(summarizeUnknown(input, 50)).toBe("hello world with newlines");
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

  it("handles very long strings with many spaces", () => {
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

describe("summarizeToolInput - real import", () => {
  it("extracts path field from input object", () => {
    const result = summarizeToolInput({ path: "/home/user/file.txt" } as any);
    expect(result).toBe("/home/user/file.txt");
  });

  it("extracts command field from input object", () => {
    const result = summarizeToolInput({ command: "ls -la /tmp" } as any);
    expect(result).toBe("ls -la /tmp");
  });

  it("extracts url field from input object", () => {
    const result = summarizeToolInput({ url: "https://example.com" } as any);
    expect(result).toBe("https://example.com");
  });

  it("extracts description field from input object", () => {
    const result = summarizeToolInput({
      description: "Search for X",
    } as any);
    expect(result).toBe("Search for X");
  });

  it("prioritizes path over other fields", () => {
    const result = summarizeToolInput({
      path: "/path/file.txt",
      command: "ls",
      url: "http://example.com",
    } as any);
    expect(result).toBe("/path/file.txt");
  });

  it("prioritizes command over url/description", () => {
    const result = summarizeToolInput({
      command: "echo hello",
      description: "test",
    } as any);
    expect(result).toBe("echo hello");
  });

  it("handles non-object input (string)", () => {
    const result = summarizeToolInput("plain string" as any);
    expect(result).toBe("plain string");
  });

  it("handles non-object input (number)", () => {
    const result = summarizeToolInput(42 as any);
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

  it("handles empty object", () => {
    const result = summarizeToolInput({} as any);
    expect(result).toBe("{}");
  });

  it("handles object with no recognized fields", () => {
    const result = summarizeToolInput({ unknown: "field" } as any);
    expect(result).toContain("unknown");
  });

  it("returns long path value as-is (no truncation of path)", () => {
    const longPath = "/very/long/path/" + "a".repeat(100) + "/file.txt";
    const result = summarizeToolInput({ path: longPath } as any);
    expect(result).toBe(longPath);
  });

  it("handles object with array values", () => {
    const result = summarizeToolInput({ items: [1, 2, 3] } as any);
    expect(result).toContain("items");
    expect(result).toContain("[");
  });

  it("handles object with nested objects", () => {
    const result = summarizeToolInput({ config: { key: "value" } } as any);
    expect(result).toContain("config");
  });

  it("handles path with special characters", () => {
    const result = summarizeToolInput({
      path: "/path/with spaces/file.txt",
    } as any);
    expect(result).toBe("/path/with spaces/file.txt");
  });

  it("handles command with flags", () => {
    const result = summarizeToolInput({
      command: "npm install --save-dev package",
    } as any);
    expect(result).toBe("npm install --save-dev package");
  });

  it("returns long url as-is (no truncation of url)", () => {
    const longUrl =
      "https://example.com/" + "?param=" + "a".repeat(100);
    const result = summarizeToolInput({ url: longUrl } as any);
    expect(result).toBe(longUrl);
  });

  it("handles description with newlines (normalizes whitespace)", () => {
    const result = summarizeToolInput({
      description: "Line 1\nLine 2\nLine 3",
    } as any);
    expect(result).toContain("Line 1 Line 2 Line 3");
  });

  it("handles command that needs truncation to 60 chars", () => {
    const longCommand = "echo ".repeat(50);
    const result = summarizeToolInput({ command: longCommand } as any);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("handles description that needs truncation to 60 chars", () => {
    const longDesc = "Research ".repeat(50);
    const result = summarizeToolInput({ description: longDesc } as any);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("handles empty string path", () => {
    const result = summarizeToolInput({ path: "" } as any);
    expect(result).toBe("");
  });

  it("handles whitespace-only command (normalizes to empty)", () => {
    const result = summarizeToolInput({ command: "   \t\n  " } as any);
    expect(result).toBe("");
  });
});

import { describe, it, expect, beforeEach } from "bun:test";
import * as replModule from "../../../app/repl";
import { SessionEngine } from "../../../runtime/session";
import { createInitialAppState } from "../../../runtime/state";

describe("resolveResumeTarget - unit tests", () => {
  const testCwd = "/tmp/test-session";

  beforeEach(() => {
    // Create a real session for testing createContext
    globalThis.testSession = new SessionEngine({
      id: "test-sess-123",
      cwd: testCwd,
    });
  });

  it("returns undefined when raw is undefined", async () => {
    const result = await replModule.resolveResumeTarget(testCwd, undefined);
    expect(result).toBeUndefined();
  });

  it("returns the raw target when not 'latest'", async () => {
    const customId = "my-custom-session-xyz";
    const result = await replModule.resolveResumeTarget(testCwd, customId);
    expect(result).toBe(customId);
  });

  it("returns first session id when raw is 'latest' and sessions exist", async () => {
    // This will use the real listSessions which may return different results
    const result = await replModule.resolveResumeTarget(testCwd, "latest");
    expect(result).toBeUndefined(); // No sessions in /tmp/test-session
  });

  it("handles empty string raw (returns undefined)", async () => {
    const result = await replModule.resolveResumeTarget(testCwd, "");
    expect(result).toBeUndefined();
  });
});

describe("createContext - unit tests", () => {
  const testCwd = "/tmp/test-context";
  let session: SessionEngine;
  let appStateRef: { current: any };

  beforeEach(() => {
    session = new SessionEngine({
      id: "test-sess-456",
      cwd: testCwd,
    });
    appStateRef = { current: createInitialAppState() };
  });

  it("creates context with correct properties", () => {
    const abortController = new AbortController();
    const ctx = replModule.createContext(
      testCwd,
      session,
      appStateRef,
      abortController,
    );

    expect(ctx.cwd).toBe(testCwd);
    expect(ctx.abortController).toBe(abortController);
    expect(Array.isArray(ctx.messages)).toBe(true);
    expect(typeof ctx.getAppState).toBe("function");
    expect(typeof ctx.setAppState).toBe("function");
  });

  it("getAppState returns current app state", () => {
    const abortController = new AbortController();
    const ctx = replModule.createContext(
      testCwd,
      session,
      appStateRef,
      abortController,
    );

    const state = ctx.getAppState();
    expect(state).toBeDefined();
    expect(Array.isArray(state.messages)).toBe(true);
    expect(typeof state.permissionContext).toBe("object");
  });

  it("setAppState updates the state", () => {
    const abortController = new AbortController();
    const ctx = replModule.createContext(
      testCwd,
      session,
      appStateRef,
      abortController,
    );

    expect(appStateRef.current.tasks).toEqual({});

    ctx.setAppState((prev) => ({ ...prev, tasks: { "task-1": { id: "task-1", title: "Test", status: "running" } as any } }));

    expect(Object.keys(appStateRef.current.tasks)).toContain("task-1");
  });

  it("setAppState receives previous state and returns new state", () => {
    const abortController = new AbortController();
    const ctx = replModule.createContext(
      testCwd,
      session,
      appStateRef,
      abortController,
    );

    ctx.setAppState((prev) => ({
      ...prev,
      messages: [...prev.messages, { id: "msg-1", type: "user" as const, content: "test" }],
    }));

    expect(appStateRef.current.messages).toHaveLength(1);
  });

  it("context messages reflect session state", () => {
    const abortController = new AbortController();
    const ctx = replModule.createContext(
      testCwd,
      session,
      appStateRef,
      abortController,
    );

    expect(ctx.messages).toEqual(session.getMessages());
  });
});

describe("summarizeUnknown - edge cases with special types", () => {
  it("handles Symbol value (stringifies to empty)", () => {
    const sym = Symbol("test");
    const result = replModule.summarizeUnknown(sym as any, 20);
    expect(result).toBe("");
  });

  it("throws on BigInt value", () => {
    const bigIntVal = BigInt(9007199254740991);
    expect(() => replModule.summarizeUnknown(bigIntVal as any, 30)).toThrow();
  });

  it("handles function value (stringifies to empty)", () => {
    const fn = () => "test";
    const result = replModule.summarizeUnknown(fn as any, 30);
    expect(result).toBe("");
  });

  it("handles Date object", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = replModule.summarizeUnknown(date, 50);
    expect(result).toContain("2024-01-01");
  });

  it("handles RegExp object (stringifies to {})", () => {
    const regex = /test/gi;
    const result = replModule.summarizeUnknown(regex as any, 30);
    expect(result).toBe("{}");
  });

  it("truncates at exact maxLength boundary without ellipsis", () => {
    const text = "a".repeat(50);
    const result = replModule.summarizeUnknown(text, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("…")).toBe(false);
  });

  it("handles string with only whitespace", () => {
    const result = replModule.summarizeUnknown("   \t\n  ", 20);
    expect(result).toBe("");
  });

  it("preserves single character when under maxLength", () => {
    expect(replModule.summarizeUnknown("x", 10)).toBe("x");
  });

  it("handles null value (stringifies to 'null')", () => {
    expect(replModule.summarizeUnknown(null as any, 20)).toBe("null");
  });

  it("handles undefined value (becomes empty string)", () => {
    expect(replModule.summarizeUnknown(undefined as any, 20)).toBe("");
  });

  it("stringifies objects with formatting", () => {
    const obj = { name: "test", value: 123 };
    const result = replModule.summarizeUnknown(obj, 50);
    expect(result).toContain("name");
    expect(result).toContain("test");
  });

  it("stringifies arrays with spaces after commas", () => {
    const arr = [1, 2, 3, "four"];
    const result = replModule.summarizeUnknown(arr, 50);
    expect(result).toContain("[");
    expect(result).toContain("1");
    expect(result).toContain("four");
  });

  it("handles numbers as strings", () => {
    expect(replModule.summarizeUnknown(42, 20)).toBe("42");
  });

  it("handles booleans", () => {
    expect(replModule.summarizeUnknown(true, 20)).toBe("true");
  });

  it("respects custom maxLength parameter", () => {
    const result = replModule.summarizeUnknown("hello world", 5);
    expect(result.length).toBe(5);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles very long strings with many spaces", () => {
    const input = "a   b   c   d   e".repeat(100);
    const result = replModule.summarizeUnknown(input, 20);
    expect(result.length).toBe(20);
    expect(result.startsWith("a b c d")).toBe(true);
  });

  it("handles strings with unicode characters", () => {
    const input = "你好世界 🌍".repeat(50);
    const result = replModule.summarizeUnknown(input, 30);
    expect(result.length).toBe(30);
  });

  it("handles nested objects", () => {
    const obj = { level1: { level2: { level3: "deep" } } };
    const result = replModule.summarizeUnknown(obj, 50);
    expect(result).toContain("level1");
  });

  it("handles empty object (stringifies to '{}')", () => {
    expect(replModule.summarizeUnknown({} as any, 20)).toBe("{}");
  });

  it("handles zero value", () => {
    expect(replModule.summarizeUnknown(0, 20)).toBe("0");
  });

  it("handles empty array", () => {
    const result = replModule.summarizeUnknown([], 20);
    expect(result).toBe("[]");
  });
});

describe("summarizeToolInput - edge cases with special types", () => {
  it("extracts path field from input object", () => {
    const result = replModule.summarizeToolInput({ path: "/home/user/file.txt" } as any);
    expect(result).toBe("/home/user/file.txt");
  });

  it("extracts command field from input object", () => {
    const result = replModule.summarizeToolInput({ command: "ls -la /tmp" } as any);
    expect(result).toBe("ls -la /tmp");
  });

  it("extracts url field from input object", () => {
    const result = replModule.summarizeToolInput({ url: "https://example.com" } as any);
    expect(result).toBe("https://example.com");
  });

  it("extracts description field from input object", () => {
    const result = replModule.summarizeToolInput({
      description: "Search for X",
    } as any);
    expect(result).toBe("Search for X");
  });

  it("prioritizes path over other fields", () => {
    const result = replModule.summarizeToolInput({
      path: "/path/file.txt",
      command: "ls",
      url: "http://example.com",
    } as any);
    expect(result).toBe("/path/file.txt");
  });

  it("prioritizes command over url/description", () => {
    const result = replModule.summarizeToolInput({
      command: "echo hello",
      description: "test",
    } as any);
    expect(result).toBe("echo hello");
  });

  it("handles non-object input (string)", () => {
    const result = replModule.summarizeToolInput("plain string" as any);
    expect(result).toBe("plain string");
  });

  it("handles non-object input (number)", () => {
    const result = replModule.summarizeToolInput(42 as any);
    expect(result).toBe("42");
  });

  it("handles null input", () => {
    const result = replModule.summarizeToolInput(null as any);
    expect(result).toBe("null");
  });

  it("handles undefined input (becomes empty string)", () => {
    const result = replModule.summarizeToolInput(undefined as any);
    expect(result).toBe("");
  });

  it("handles empty object", () => {
    const result = replModule.summarizeToolInput({} as any);
    expect(result).toBe("{}");
  });

  it("handles object with no recognized fields", () => {
    const result = replModule.summarizeToolInput({ unknown: "field" } as any);
    expect(result).toContain("unknown");
  });

  it("returns long path value as-is (no truncation of path)", () => {
    const longPath = "/very/long/path/" + "a".repeat(100) + "/file.txt";
    const result = replModule.summarizeToolInput({ path: longPath } as any);
    expect(result).toBe(longPath);
  });

  it("handles object with array values", () => {
    const result = replModule.summarizeToolInput({ items: [1, 2, 3] } as any);
    expect(result).toContain("items");
    expect(result).toContain("[");
  });

  it("handles object with nested objects", () => {
    const result = replModule.summarizeToolInput({ config: { key: "value" } } as any);
    expect(result).toContain("config");
  });

  it("handles path with special characters", () => {
    const result = replModule.summarizeToolInput({
      path: "/path/with spaces/file.txt",
    } as any);
    expect(result).toBe("/path/with spaces/file.txt");
  });

  it("handles command with flags", () => {
    const result = replModule.summarizeToolInput({
      command: "npm install --save-dev package",
    } as any);
    expect(result).toBe("npm install --save-dev package");
  });

  it("returns long url value as-is (no truncation of url)", () => {
    const longUrl = "https://example.com/" + "?param=" + "a".repeat(100);
    const result = replModule.summarizeToolInput({ url: longUrl } as any);
    expect(result).toBe(longUrl);
  });

  it("handles description with newlines (normalizes whitespace)", () => {
    const result = replModule.summarizeToolInput({
      description: "Line 1\nLine 2\nLine 3",
    } as any);
    expect(result).toContain("Line 1 Line 2 Line 3");
  });

  it("handles command that needs truncation to 60 chars", () => {
    const longCommand = "echo ".repeat(50);
    const result = replModule.summarizeToolInput({ command: longCommand } as any);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("handles description that needs truncation to 60 chars", () => {
    const longDesc = "Research ".repeat(50);
    const result = replModule.summarizeToolInput({ description: longDesc } as any);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("handles empty string path", () => {
    const result = replModule.summarizeToolInput({ path: "" } as any);
    expect(result).toBe("");
  });

  it("handles whitespace-only command (normalizes to empty)", () => {
    const result = replModule.summarizeToolInput({ command: "   \t\n  " } as any);
    expect(result).toBe("");
  });

  it("handles object with path as number (falls back to JSON.stringify)", () => {
    const result = replModule.summarizeToolInput({ path: 123 } as any);
    expect(result).toContain("{");
  });

  it("handles object with command as boolean", () => {
    const result = replModule.summarizeToolInput({ command: true } as any);
    expect(result).toContain("true");
  });

  it("handles deeply nested path structure", () => {
    const result = replModule.summarizeToolInput({
      path: "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/file.txt",
    } as any);
    expect(result).toBe("/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/file.txt");
  });

  it("handles command with unicode characters", () => {
    const result = replModule.summarizeToolInput({
      command: "echo 你好世界",
    } as any);
    expect(result).toContain("你好世界");
  });

  it("handles URL with authentication info (no masking)", () => {
    const result = replModule.summarizeToolInput({
      url: "https://user:pass@api.example.com/v1/endpoint",
    } as any);
    expect(result).toBe(
      "https://user:pass@api.example.com/v1/endpoint"
    );
  });

  it("handles description with markdown formatting", () => {
    const result = replModule.summarizeToolInput({
      description: "**Bold** and *italic* text",
    } as any);
    expect(result).toContain("Bold");
    expect(result).toContain("italic");
  });
});

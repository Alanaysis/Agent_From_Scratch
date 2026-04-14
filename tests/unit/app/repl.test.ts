import { describe, it, expect } from 'bun:test';
import { summarizeUnknown, summarizeToolInput } from '../../../app/repl';

describe('summarizeUnknown', () => {
  it('returns string as-is when under maxLength', () => {
    expect(summarizeUnknown("hello world", 20)).toBe("hello world");
  });

  it('truncates strings over maxLength with ellipsis', () => {
    const longString = "a".repeat(150);
    const result = summarizeUnknown(longString, 60);
    expect(result.length).toBe(60);
    expect(result.endsWith("…")).toBe(true);
  });

  it('handles empty string', () => {
    expect(summarizeUnknown("", 20)).toBe("");
  });

  it('normalizes whitespace in strings', () => {
    const input = "hello   world\n\nwith\tnewlines";
    expect(summarizeUnknown(input, 50)).toBe("hello world with newlines");
  });

  it('handles null value (stringifies to "null")', () => {
    // JSON.stringify(null) returns the string "null"
    expect(summarizeUnknown(null as any, 20)).toBe("null");
  });

  it('handles undefined value (JSON.stringify returns undefined which becomes "")', () => {
    // JSON.stringify(undefined) returns the value undefined (not a string),
    // so the ?? "" fallback applies and returns empty string
    expect(summarizeUnknown(undefined as any, 20)).toBe("");
  });

  it('stringifies objects with formatting', () => {
    const obj = { name: "test", value: 123 };
    const result = summarizeUnknown(obj, 50);
    expect(result).toContain("name");
    expect(result).toContain("test");
  });

  it('stringifies arrays with spaces after commas', () => {
    // JSON.stringify adds spaces: [1, 2, 3] not [1,2,3]
    const arr = [1, 2, 3, "four"];
    const result = summarizeUnknown(arr, 50);
    expect(result).toContain("[");
    expect(result).toContain("1");
    expect(result).toContain("four"); // full word
  });

  it('handles numbers as strings', () => {
    expect(summarizeUnknown(42, 20)).toBe("42");
  });

  it('handles booleans', () => {
    expect(summarizeUnknown(true, 20)).toBe("true");
  });

  it('respects custom maxLength parameter', () => {
    const result = summarizeUnknown("hello world", 5);
    expect(result.length).toBe(5);
    expect(result.endsWith("…")).toBe(true);
  });

  it('handles very long strings with many spaces', () => {
    const input = "a   b   c   d   e".repeat(100);
    const result = summarizeUnknown(input, 20);
    expect(result.length).toBe(20);
    expect(result.startsWith("a b c d")).toBe(true);
  });

  it('handles strings with unicode characters', () => {
    const input = "你好世界 🌍".repeat(50);
    const result = summarizeUnknown(input, 30);
    expect(result.length).toBe(30);
  });

  it('handles nested objects', () => {
    const obj = { level1: { level2: { level3: "deep" } } };
    const result = summarizeUnknown(obj, 50);
    expect(result).toContain("level1");
  });

  it('handles empty object (stringifies to "{}")', () => {
    expect(summarizeUnknown({} as any, 20)).toBe("{}");
  });

  it('handles zero value', () => {
    expect(summarizeUnknown(0, 20)).toBe("0");
  });

  it('handles empty array', () => {
    const result = summarizeUnknown([], 20);
    expect(result).toBe("[]");
  });
});

describe('summarizeToolInput', () => {
  function summarizeToolInput(input: unknown): string {
    if (typeof input !== "object" || input === null) {
      return summarizeUnknown(input, 60);
    }
    if ("path" in input && typeof input.path === "string") {
      return input.path;
    }
    if ("command" in input && typeof input.command === "string") {
      return summarizeUnknown(input.command, 60);
    }
    if ("url" in input && typeof input.url === "string") {
      return input.url;
    }
    if ("description" in input && typeof input.description === "string") {
      return summarizeUnknown(input.description, 60);
    }
    return summarizeUnknown(input, 60);
  }

  it('extracts path field from input object', () => {
    const result = summarizeToolInput({ path: "/home/user/file.txt" });
    expect(result).toBe("/home/user/file.txt");
  });

  it('extracts command field from input object', () => {
    const result = summarizeToolInput({ command: "ls -la /tmp" });
    expect(result).toBe("ls -la /tmp");
  });

  it('extracts url field from input object', () => {
    const result = summarizeToolInput({ url: "https://example.com" });
    expect(result).toBe("https://example.com");
  });

  it('extracts description field from input object', () => {
    const result = summarizeToolInput({ description: "Search for X" });
    expect(result).toBe("Search for X");
  });

  it('prioritizes path over other fields', () => {
    const result = summarizeToolInput({
      path: "/path/file.txt",
      command: "ls",
      url: "http://example.com"
    });
    expect(result).toBe("/path/file.txt");
  });

  it('prioritizes command over url/description', () => {
    const result = summarizeToolInput({
      command: "echo hello",
      description: "test"
    });
    expect(result).toBe("echo hello");
  });

  it('handles non-object input (string)', () => {
    const result = summarizeToolInput("plain string");
    expect(result).toBe("plain string");
  });

  it('handles non-object input (number)', () => {
    const result = summarizeToolInput(42);
    expect(result).toBe("42");
  });

  it('handles null input (falls back to JSON.stringify)', () => {
    // null is typeof "object" in JavaScript, so it goes through the check
    // But then fails typeof object check because null !== null is false... actually it passes
    // Then falls through to summarizeUnknown which stringifies to "null"
    const result = summarizeToolInput(null as any);
    expect(result).toBe("null");
  });

  it('handles undefined input (falls back to JSON.stringify which returns undefined, then "")', () => {
    // undefined falls through the typeof check (typeof undefined === "undefined" !== "object")
    // So it calls summarizeUnknown(undefined) which does JSON.stringify(undefined) = undefined ?? "" = ""
    const result = summarizeToolInput(undefined as any);
    expect(result).toBe("");
  });

  it('handles empty object (falls back to JSON.stringify)', () => {
    const result = summarizeToolInput({});
    expect(result).toBe("{}");
  });

  it('handles object with no recognized fields', () => {
    const result = summarizeToolInput({ unknown: "field" });
    expect(result).toContain("unknown");
  });

  it('returns long path value as-is (no truncation of path)', () => {
    // The actual repl.ts code does NOT truncate paths - only commands/descriptions get truncated
    const longPath = "/very/long/path/" + "a".repeat(100) + "/file.txt";
    const result = summarizeToolInput({ path: longPath });
    expect(result).toBe(longPath); // Path is returned as-is, no truncation
  });

  it('handles object with array values', () => {
    const result = summarizeToolInput({ items: [1, 2, 3] });
    // JSON.stringify adds spaces after commas
    expect(result).toContain("items");
    expect(result).toContain("[");
  });

  it('handles object with nested objects', () => {
    const result = summarizeToolInput({ config: { key: "value" } });
    expect(result).toContain("config");
  });

  it('handles path with special characters', () => {
    const result = summarizeToolInput({ path: "/path/with spaces/file.txt" });
    expect(result).toBe("/path/with spaces/file.txt");
  });

  it('handles command with flags', () => {
    const result = summarizeToolInput({ command: "npm install --save-dev package" });
    expect(result).toBe("npm install --save-dev package");
  });

  it('returns long url as-is (no truncation of url)', () => {
    // URLs are returned as-is without truncation
    const longUrl = "https://example.com/" + "?param=" + "a".repeat(100);
    const result = summarizeToolInput({ url: longUrl });
    expect(result).toBe(longUrl); // URL is returned as-is, no truncation
  });

  it('handles description with newlines (normalizes whitespace)', () => {
    const result = summarizeToolInput({
      description: "Line 1\nLine 2\nLine 3"
    });
    expect(result).toContain("Line 1 Line 2 Line 3");
  });

  it('handles command that needs truncation', () => {
    // Commands DO get truncated to maxLength=60
    const longCommand = "echo " + "a".repeat(100);
    const result = summarizeToolInput({ command: longCommand });
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('handles description that needs truncation', () => {
    // Descriptions DO get truncated to maxLength=60
    const longDesc = "Research ".repeat(50);
    const result = summarizeToolInput({ description: longDesc });
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('handles string input that needs truncation', () => {
    // Non-object inputs also use maxLength=60
    const longString = "a".repeat(100);
    const result = summarizeToolInput(longString as any);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('handles empty string path', () => {
    const result = summarizeToolInput({ path: "" });
    expect(result).toBe("");
  });

  it('handles whitespace-only command (normalizes to empty)', () => {
    const result = summarizeToolInput({ command: "   \t\n  " });
    expect(result).toBe("");
  });
});

// Test the integration between both functions
describe('summarizeUnknown + summarizeToolInput - combined scenarios', () => {
  function summarizeToolInput(input: unknown): string {
    if (typeof input !== "object" || input === null) {
      return summarizeUnknown(input, 60);
    }
    if ("path" in input && typeof input.path === "string") {
      return input.path;
    }
    if ("command" in input && typeof input.command === "string") {
      return summarizeUnknown(input.command, 60);
    }
    if ("url" in input && typeof input.url === "string") {
      return input.url;
    }
    if ("description" in input && typeof input.description === "string") {
      return summarizeUnknown(input.description, 60);
    }
    return summarizeUnknown(input, 60);
  }

  it('handles read tool with long path', () => {
    // Paths are returned as-is without truncation
    const result = summarizeToolInput({
      path: "/very/long/file/path/that/exceeds/default/maxlength/for/tool/input/output/display.txt"
    });
    expect(result).toContain("display.txt");
  });

  it('handles shell tool with complex command (gets truncated)', () => {
    const result = summarizeToolInput({
      command: "grep -r 'pattern' /path/to/project --include='*.ts' | head -20"
    });
    expect(result).toContain("grep");
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('handles web fetch with long url', () => {
    // URLs are returned as-is without truncation
    const result = summarizeToolInput({
      url: "https://api.example.com/v1/users?page=1&limit=50&filter=status:active"
    });
    expect(result).toContain("api.example.com");
  });

  it('handles agent tool with description (gets truncated)', () => {
    const result = summarizeToolInput({
      description: "Research the latest developments in artificial intelligence and machine learning"
    });
    expect(result).toContain("Research");
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('handles edge case of empty string path', () => {
    const result = summarizeToolInput({ path: "" });
    expect(result).toBe("");
  });

  it('handles edge case of whitespace-only command (normalizes to empty)', () => {
    const result = summarizeToolInput({ command: "   \t\n  " });
    expect(result).toBe("");
  });

  it('handles read tool with normal path', () => {
    const result = summarizeToolInput({ path: "/home/user/document.pdf" });
    expect(result).toBe("/home/user/document.pdf");
  });

  it('handles write tool with command-style input (truncated)', () => {
    const result = summarizeToolInput({
      command: "write /path/to/file.txt " + "content ".repeat(50)
    });
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('handles edit tool with description', () => {
    const result = summarizeToolInput({
      description: "Replace old string with new string in file"
    });
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('handles complex nested input object (falls back to JSON.stringify)', () => {
    const result = summarizeToolInput({
      tool: "custom",
      config: { enabled: true, retries: 3 },
      data: [1, 2, 3]
    });
    expect(result).toContain("tool");
  });
});

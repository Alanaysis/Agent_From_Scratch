import { describe, it, expect } from "bun:test";
import {
  parseTranscript,
  clipText,
  formatExportMessageEntry,
  summarizeUnknown,
  summarizeToolInput,
} from "../../../app/headless";

describe("parseTranscript", () => {
  it("parses valid JSON lines into objects", () => {
    const text = '{"type":"user","content":"hello"}\n{"type":"assistant","text":"hi"}';
    const result = parseTranscript(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "user", content: "hello" });
    expect(result[1]).toEqual({ type: "assistant", text: "hi" });
  });

  it("handles lines that fail JSON.parse (returns as string)", () => {
    const text = '{"type":"user","content":"hello"}\nnot valid json\n{"type":"assistant","text":"hi"}';
    const result = parseTranscript(text);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "user", content: "hello" });
    expect(result[1]).toBe("not valid json");
    expect(result[2]).toEqual({ type: "assistant", text: "hi" });
  });

  it("filters out empty lines", () => {
    const text = '{"type":"user"}\n\n   \n{"type":"assistant"}';
    const result = parseTranscript(text);
    expect(result).toHaveLength(2);
  });

  it("handles trailing newlines", () => {
    const text = '{"type":"user"}\n';
    const result = parseTranscript(text);
    expect(result).toHaveLength(1);
  });

  it("handles leading whitespace in lines (trims)", () => {
    const text = '  {"type":"user"}  \n\t{"type":"assistant"}\t';
    const result = parseTranscript(text);
    expect(result[0]).toEqual({ type: "user" });
    expect(result[1]).toEqual({ type: "assistant" });
  });

  it("handles empty string", () => {
    const result = parseTranscript("");
    expect(result).toHaveLength(0);
  });

  it("handles whitespace-only input", () => {
    const result = parseTranscript("   \n\n  ");
    expect(result).toHaveLength(0);
  });

  it("parses JSON with nested objects", () => {
    const text = '{"type":"assistant","content":[{"type":"text","text":"hi"}]}';
    const result = parseTranscript(text);
    expect(result[0]).toEqual({ type: "assistant", content: [{ type: "text", text: "hi" }] });
  });

  it("handles mixed valid/invalid JSON gracefully", () => {
    const text = '{"valid":true}\nrandom text\n{"also":123}';
    const result = parseTranscript(text);
    expect(result).toHaveLength(3);
    expect(typeof result[0]).toBe("object");
    expect(typeof result[1]).toBe("string");
    expect(typeof result[2]).toBe("object");
  });
});

describe("clipText", () => {
  it("returns text as-is when under maxLength", () => {
    expect(clipText("hello world", 20)).toBe("hello world");
  });

  it("clips text over maxLength with ellipsis", () => {
    const longText = "a".repeat(100);
    const result = clipText(longText, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("…")).toBe(true);
  });

  it("normalizes whitespace before clipping", () => {
    const input = "hello   world\n\nwith\tnewlines";
    const result = clipText(input, 20);
    expect(result).toContain("hello world");
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("handles empty string", () => {
    expect(clipText("", 20)).toBe("");
  });

  it("handles exact maxLength (no clipping)", () => {
    const exact = "a".repeat(50);
    expect(clipText(exact, 50)).toBe(exact);
  });

  it("handles single character", () => {
    expect(clipText("x", 10)).toBe("x");
  });

  it("handles whitespace-only text (normalizes to empty)", () => {
    const result = clipText("   \t\n  ", 20);
    expect(result).toBe("");
  });

  it("handles unicode characters", () => {
    const input = "你好世界 🌍".repeat(50);
    const result = clipText(input, 30);
    expect(result.length).toBe(30);
  });

  it("respects custom maxLength parameter", () => {
    const result = clipText("hello world", 5);
    expect(result.length).toBe(5);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("formatExportMessageEntry", () => {
  describe("user messages", () => {
    it("formats user message with clipped content", () => {
      const message = {
        type: "user" as const,
        content: "hello world",
      };
      const result = formatExportMessageEntry(message as any);
      expect(result).toBe('user: hello world');
    });

    it("clips long user content to 240 chars", () => {
      const longContent = "a".repeat(500);
      const message = {
        type: "user" as const,
        content: longContent,
      };
      const result = formatExportMessageEntry(message as any);
      expect(result.startsWith("user:")).toBe(true);
      expect(result.length).toBeLessThanOrEqual(246); // "user: " (6) + 240 chars = 246 max
    });
  });

  describe("tool_result messages", () => {
    it("formats successful tool result with tool_result status", () => {
      const message = {
        type: "tool_result" as const,
        toolUseId: "tool-123",
        content: "success output",
        isError: false,
      };
      const result = formatExportMessageEntry(message as any);
      expect(result).toBe('tool_result(tool-123): success output');
    });

    it("formats error tool result with tool_error status", () => {
      const message = {
        type: "tool_result" as const,
        toolUseId: "tool-456",
        content: "error occurred",
        isError: true,
      };
      const result = formatExportMessageEntry(message as any);
      expect(result).toBe('tool_error(tool-456): error occurred');
    });

    it("clips long tool_result content to 400 chars", () => {
      const longContent = "a".repeat(1000);
      const message = {
        type: "tool_result" as const,
        toolUseId: "tool-789",
        content: longContent,
        isError: false,
      };
      const result = formatExportMessageEntry(message as any);
      expect(result.startsWith("tool_result(tool-789):")).toBe(true);
    });
  });

  describe("assistant messages with text blocks", () => {
    it("formats assistant message with text block", () => {
      const message = {
        type: "assistant" as const,
        content: [
          {
            type: "text" as const,
            text: "here is the answer",
          },
        ],
      };
      const result = formatExportMessageEntry(message as any);
      expect(result).toBe('assistant: here is the answer');
    });

    it("clips long assistant text to 400 chars", () => {
      const message = {
        type: "assistant" as const,
        content: [
          {
            type: "text" as const,
            text: "a".repeat(1000),
          },
        ],
      };
      const result = formatExportMessageEntry(message as any);
      expect(result.startsWith("assistant:")).toBe(true);
    });

    it("formats assistant message with tool_use block", () => {
      const message = {
        type: "assistant" as const,
        content: [
          {
            type: "tool_use" as const,
            id: "tool-abc",
            name: "Read",
            input: { path: "/tmp/file.txt" },
          },
        ],
      };
      const result = formatExportMessageEntry(message as any);
      expect(result).toContain("tool_use(tool-abc)");
      expect(result).toContain("Read");
      expect(result).toContain("/tmp/file.txt");
    });

    it("handles assistant message with mixed blocks", () => {
      const message = {
        type: "assistant" as const,
        content: [
          {
            type: "text" as const,
            text: "I will read the file.",
          },
          {
            type: "tool_use" as const,
            id: "tool-def",
            name: "Read",
            input: { path: "/tmp/test.txt" },
          },
        ],
      };
      const result = formatExportMessageEntry(message as any);
      expect(result).toContain("I will read the file.");
      expect(result).toContain("|"); // blocks are joined with |
    });

    it("handles empty content array", () => {
      const message = {
        type: "assistant" as const,
        content: [],
      };
      const result = formatExportMessageEntry(message as any);
      expect(result).toBe("");
    });

    it("clips tool_use input to 60 chars", () => {
      const message = {
        type: "assistant" as const,
        content: [
          {
            type: "tool_use" as const,
            id: "tool-xyz",
            name: "Shell",
            input: { command: "a".repeat(200) },
          },
        ],
      };
      const result = formatExportMessageEntry(message as any);
      // Command should be truncated to ~60 chars
      expect(result).toContain("tool_use(tool-xyz)");
    });
  });

  it("handles message with unknown type (edge case)", () => {
    // TypeScript would normally prevent this, but runtime could have issues
    const message = {
      type: "unknown" as any,
      content: [],
    };
    const result = formatExportMessageEntry(message);
    expect(typeof result).toBe("string");
  });
});

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

// Combined tests for formatExportMessageEntry with various message structures
describe("formatExportMessageEntry - combined scenarios", () => {
  it("handles complex assistant message with multiple tool calls", () => {
    const message = {
      type: "assistant" as const,
      content: [
        { type: "text" as const, text: "Let me check the file." },
        {
          type: "tool_use" as const,
          id: "tool-1",
          name: "Read",
          input: { path: "/tmp/test.txt" },
        },
        {
          type: "tool_use" as const,
          id: "tool-2",
          name: "Shell",
          input: { command: "ls -la /tmp" },
        },
      ],
    };
    const result = formatExportMessageEntry(message as any);
    expect(result).toContain("Let me check the file.");
    expect(result).toContain("|"); // separators between blocks
    expect(result).toContain("tool_use(tool-1)");
    expect(result).toContain("Read");
  });

  it("handles tool_result with error content", () => {
    const message = {
      type: "tool_result" as const,
      toolUseId: "error-tool",
      content: JSON.stringify({ error: "File not found" }),
      isError: true,
    };
    const result = formatExportMessageEntry(message as any);
    expect(result).toBe('tool_error(error-tool): {"error":"File not found"}');
  });

  it("handles user message with special characters", () => {
    const message = {
      type: "user" as const,
      content: 'read file.txt with "quotes" and \t tabs',
    };
    const result = formatExportMessageEntry(message as any);
    expect(result).toBe('user: read file.txt with "quotes" and tabs');
  });

  it("handles assistant message with very long tool input", () => {
    const message = {
      type: "assistant" as const,
      content: [
        {
          type: "tool_use" as const,
          id: "long-tool",
          name: "Agent",
          input: {
            description: "Do something",
            prompt: "a".repeat(200),
          },
        },
      ],
    };
    const result = formatExportMessageEntry(message as any);
    expect(result).toContain("tool_use(long-tool)");
    // Prompt should be truncated to 60 chars
    expect(result.length).toBeLessThanOrEqual(120);
  });
});

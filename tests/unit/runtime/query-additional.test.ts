import { describe, it, expect } from "bun:test";
import * as queryModule from "../../../runtime/query";

describe("parseQuery - fetch URL patterns (line 173 coverage)", () => {
  it("handles HTTPS URLs", async () => {
    const result = queryModule.parseQuery("fetch https://example.com/api/data");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).url).toContain("https://example.com");
      expect((result.input as any).prompt).toBeDefined();
    }
  });

  it("handles HTTP URLs", async () => {
    const result = queryModule.parseQuery("fetch http://localhost:8080/test");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).url).toContain("http://localhost:8080");
    }
  });

  it("handles URLs with port numbers", async () => {
    const result = queryModule.parseQuery("fetch http://localhost:3000/api/data");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).url).toContain(":3000");
    }
  });

  it("handles URLs with query parameters", async () => {
    const result = queryModule.parseQuery("fetch https://api.example.com/search?q=test&page=1");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).url).toContain("?q=test");
    }
  });

  it("handles URLs with fragments", async () => {
    const result = queryModule.parseQuery("fetch https://example.com/page#section");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).url).toContain("#section");
    }
  });

  it("handles URLs with encoded characters", async () => {
    const result = queryModule.parseQuery("fetch https://example.com/search?q=hello%20world&lang=en");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).url).toContain("%20");
    }
  });

  it("handles IPv6 URLs", async () => {
    const result = queryModule.parseQuery("fetch http://[::1]:8080/test");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).url).toContain("[::1]");
    }
  });

  it("handles fetch with custom prompt", async () => {
    const result = queryModule.parseQuery("fetch https://example.com with detail analysis");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).prompt).toContain("detail");
    }
  });

  it("handles fetch without explicit prompt", async () => {
    const result = queryModule.parseQuery("fetch https://example.com");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).prompt).toBeDefined();
    }
  });
});

describe("parseQuery - write/create/save patterns (lines 180-193)", () => {
  it("handles 'write' command", async () => {
    const result = queryModule.parseQuery("write /path/to/file.txt hello world");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).path).toBe("/path/to/file.txt");
      expect((result.input as any).content).toBe("hello world");
    }
  });

  it("handles 'create' command", async () => {
    const result = queryModule.parseQuery("create /app/config.json {\"key\": \"value\"}");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).path).toBe("/app/config.json");
      expect((result.input as any).content).toContain("{\"key\": \"value\"}");
    }
  });

  it("handles 'save' command", async () => {
    const result = queryModule.parseQuery("save /tmp/data.log important information");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).path).toBe("/tmp/data.log");
      expect((result.input as any).content).toBe("important information");
    }
  });

  it("handles Chinese '写入' command", async () => {
    const result = queryModule.parseQuery("写入 /path/to/file.txt 中文内容测试");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).content).toContain("中文内容");
    }
  });

  it("handles Chinese '创建文件' command", async () => {
    const result = queryModule.parseQuery("创建文件 /app/test.txt test content");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).path).toContain("/app/test.txt");
    }
  });

  it("handles write with JSON content", async () => {
    const result = queryModule.parseQuery("write config.json {\"name\": \"test\", \"version\": \"1.0\"}");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).content).toContain("\"name\": \"test\"");
    }
  });

  it("handles write with multi-word content", async () => {
    const result = queryModule.parseQuery("write notes.txt This is a longer note with multiple words");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).content).toContain("longer note");
    }
  });
});

describe("parseQuery - edit/replace patterns (lines 197-210)", () => {
  it("handles 'edit' command with -> arrow", async () => {
    const result = queryModule.parseQuery("edit /path/to/file.txt old content -> new content");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).oldString).toContain("old content");
      expect((result.input as any).newString).toContain("new content");
    }
  });

  it("handles 'replace' command with => arrow", async () => {
    const result = queryModule.parseQuery("replace /app/config.json key: old => key: new");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).oldString).toContain("key: old");
      expect((result.input as any).newString).toContain("key: new");
    }
  });

  it("handles 'edit' command with Chinese =>", async () => {
    const result = queryModule.parseQuery("编辑 /path/to/file.txt 旧内容 => 新内容");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).newString).toContain("新内容");
    }
  });

  it("handles '替换' command with Chinese 为", async () => {
    const result = queryModule.parseQuery("替换 /app/test.txt 原来的 -> 现在的");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).oldString).toContain("原来的");
      expect((result.input as any).newString).toContain("现在的");
    }
  });

  it("handles 'edit' command with Chinese ->", async () => {
    const result = queryModule.parseQuery("编辑 /path/file.txt 旧文本 -> 新文本");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).newString).toContain("新文本");
    }
  });

  it("handles edit with code content", async () => {
    const result = queryModule.parseQuery("edit src/main.ts function old() {} -> function new() {}");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).oldString).toContain("function old()");
    }
  });

  it("handles edit with complex patterns", async () => {
    const result = queryModule.parseQuery("replace /app/config.yaml port: 3000 -> port: 8080");
    expect(result.kind).toBe("tool");
    if (result.kind === "tool") {
      expect((result.input as any).path).toContain("/app/config.yaml");
    }
  });

  it("returns text kind for unmatched edit pattern", async () => {
    const result = queryModule.parseQuery("edit file.txt without proper arrow");
    expect(result.kind).toBe("text");
  });
});

describe("parseQuery - intro function patterns (lines 213-250)", () => {
  it("generates intro for read tool", async () => {
    const result = queryModule.parseQuery("read /path/to/file.txt");
    if (result.kind === "tool") {
      expect(result.intro).toBeDefined();
      expect(result.intro).toContain("/path/to/file.txt");
    }
  });

  it("generates intro for write tool", async () => {
    const result = queryModule.parseQuery("write /app/test.txt content");
    if (result.kind === "tool") {
      expect(result.intro).toBeDefined();
      expect(result.intro).toContain("/app/test.txt");
    }
  });

  it("generates intro for edit tool", async () => {
    const result = queryModule.parseQuery("edit /app/file.txt old -> new");
    if (result.kind === "tool") {
      expect(result.intro).toBeDefined();
      expect(result.intro).toContain("/app/file.txt");
    }
  });

  it("generates intro for shell tool", async () => {
    const result = queryModule.parseQuery("shell ls -la /tmp");
    if (result.kind === "tool") {
      expect(result.intro).toBeDefined();
      expect(result.intro).toContain("shell");
    }
  });

  it("generates intro for agent tool", async () => {
    const result = queryModule.parseQuery("agent investigate this issue");
    if (result.kind === "tool") {
      expect(result.intro).toBeDefined();
    }
  });

  it("generates intro for fetch tool", async () => {
    const result = queryModule.parseQuery("fetch https://example.com");
    if (result.kind === "tool") {
      expect(result.intro).toBeDefined();
      expect(result.intro).toContain("抓取"); // Chinese intro text
    }
  });

  it("returns text kind for unknown commands", async () => {
    const result = queryModule.parseQuery("unknown command that doesn't match any pattern");
    expect(result.kind).toBe("text");
    if (result.kind === "text") {
      expect(result.text).toBeDefined();
    }
  });

  it("handles text kind default behavior", async () => {
    const result = queryModule.parseQuery("");
    expect(result.kind).toBe("text");
    if (result.kind === "text") {
      expect(Array.isArray(result.text)).toBe(true);
      expect(result.text.length).toBeGreaterThan(0);
    }
  });
});

describe("parseQuery - summarizeResult patterns", () => {
  it("summarizes read tool result", async () => {
    const result = queryModule.parseQuery("read /path/to/file.txt");
    if (result.kind === "tool" && result.summarizeResult) {
      const summary = result.summarizeResult({ content: "file contents here" });
      expect(summary).toBeDefined();
      expect(summary.length).toBeGreaterThan(0);
    }
  });

  it("summarizes write tool result", async () => {
    const result = queryModule.parseQuery("write /app/test.txt content");
    if (result.kind === "tool" && result.summarizeResult) {
      const summary = result.summarizeResult({ success: true, path: "/app/test.txt" });
      expect(summary).toContain("/app/test.txt");
    }
  });

  it("summarizes edit tool result", async () => {
    const result = queryModule.parseQuery("edit /app/file.txt old -> new");
    if (result.kind === "tool" && result.summarizeResult) {
      const summary = result.summarizeResult({ modified: true });
      expect(summary).toContain("/app/file.txt");
    }
  });

  it("summarizes shell tool result", async () => {
    const result = queryModule.parseQuery("shell ls -la /tmp");
    if (result.kind === "tool" && result.summarizeResult) {
      const summary = result.summarizeResult({ stdout: "file1.txt file2.txt\n", stderr: "" });
      expect(summary).toBeDefined();
    }
  });

  it("summarizes fetch tool result with truncation", async () => {
    const result = queryModule.parseQuery("fetch https://example.com");
    if (result.kind === "tool" && result.summarizeResult) {
      const longContent = "a".repeat(2000);
      const summary = result.summarizeResult(longContent);
      // Should be truncated to reasonable length
      expect(summary.length).toBeLessThanOrEqual(1200 + 50);
    }
  });

  it("summarizes agent tool result", async () => {
    const result = queryModule.parseQuery("agent investigate this issue");
    if (result.kind === "tool" && result.summarizeResult) {
      const summary = result.summarizeResult({ findings: "test results" });
      expect(summary).toBeDefined();
    }
  });

  it("handles empty result in summarize", async () => {
    const result = queryModule.parseQuery("read /path/to/file.txt");
    if (result.kind === "tool" && result.summarizeResult) {
      const summary = result.summarizeResult("");
      expect(summary).toBeDefined();
    }
  });

  it("handles null in summarize", async () => {
    const result = queryModule.parseQuery("read /path/to/file.txt");
    if (result.kind === "tool" && result.summarizeResult) {
      // @ts-expect-error - testing edge case
      const summary = result.summarizeResult(null);
      expect(summary).toBeDefined();
    }
  });
});

describe("parseQuery - summarizeError patterns", () => {
  it("generates error for read tool", async () => {
    const result = queryModule.parseQuery("read /path/to/file.txt");
    if (result.kind === "tool" && result.summarizeError) {
      const errorSummary = result.summarizeError("permission denied");
      expect(errorSummary).toContain("/path/to/file.txt");
      expect(errorSummary).toContain("permission denied");
    }
  });

  it("generates error for write tool", async () => {
    const result = queryModule.parseQuery("write /app/test.txt content");
    if (result.kind === "tool" && result.summarizeError) {
      const errorSummary = result.summarizeError("disk full");
      expect(errorSummary).toContain("/app/test.txt");
    }
  });

  it("generates error for edit tool", async () => {
    const result = queryModule.parseQuery("edit /app/file.txt old -> new");
    if (result.kind === "tool" && result.summarizeError) {
      const errorSummary = result.summarizeError("file not found");
      expect(errorSummary).toContain("/app/file.txt");
    }
  });

  it("generates error for fetch tool", async () => {
    const result = queryModule.parseQuery("fetch https://example.com");
    if (result.kind === "tool" && result.summarizeError) {
      const errorSummary = result.summarizeError("network timeout");
      expect(errorSummary).toContain("https://example.com");
    }
  });

  it("handles various error messages", async () => {
    const testErrors = ["connection refused", "timeout", "404 not found", "internal server error"];
    for (const err of testErrors) {
      const result = queryModule.parseQuery(`read /path/${err}.txt`);
      if (result.kind === "tool" && result.summarizeError) {
        const summary = result.summarizeError(err);
        expect(summary).toContain(err);
      }
    }
  });

  it("handles empty error message", async () => {
    const result = queryModule.parseQuery("read /path/to/file.txt");
    if (result.kind === "tool" && result.summarizeError) {
      const summary = result.summarizeError("");
      expect(summary).toBeDefined();
    }
  });

  it("handles error with special characters", async () => {
    const result = queryModule.parseQuery("read /path/to/file.txt");
    if (result.kind === "tool" && result.summarizeError) {
      const summary = result.summarizeError("error: <invalid> & 'quotes'");
      expect(summary).toBeDefined();
    }
  });
});

describe("parseQuery - edge cases and validation", () => {
  it("handles empty input", async () => {
    const result = queryModule.parseQuery("");
    expect(result.kind).toBe("text");
  });

  it("handles whitespace-only input", async () => {
    const result = queryModule.parseQuery("   \n\t  ");
    expect(result.kind).toBe("text");
  });

  it("handles very long commands", async () => {
    const longPath = "/a".repeat(1000);
    const result = queryModule.parseQuery(`write ${longPath} content`);
    if (result.kind === "tool") {
      expect((result.input as any).path.length).toBeGreaterThan(1000);
    }
  });

  it("handles commands with special characters in path", async () => {
    const result = queryModule.parseQuery("write /path/with spaces/file.txt content");
    if (result.kind === "tool") {
      expect((result.input as any).path).toContain("spaces");
    }
  });

  it("handles mixed case commands", async () => {
    const result1 = queryModule.parseQuery("WRITE /path/to/file.txt content");
    const result2 = queryModule.parseQuery("Write /path/to/file.txt content");
    expect(result1.kind).toBe("tool");
    expect(result2.kind).toBe("tool");
  });

  it("handles unicode in file paths", async () => {
    const result = queryModule.parseQuery("write /path/中文/test.txt 内容");
    if (result.kind === "tool") {
      expect((result.input as any).path).toContain("中文");
    }
  });

  it("handles numeric file extensions", async () => {
    const result = queryModule.parseQuery("write test.123 content");
    if (result.kind === "tool") {
      expect((result.input as any).path).toBe("test.123");
    }
  });

  it("handles commands with multiple spaces", async () => {
    const result = queryModule.parseQuery("write   /path/to/file.txt    content here");
    if (result.kind === "tool") {
      expect((result.input as any).content).toBe("content here");
    }
  });
});

import { describe, it, expect } from "bun:test";
import * as queryModule from "../../../runtime/query";

describe("query.ts - pattern matching edge cases", () => {
  describe("parseQuery - fetch URL patterns (line 173)", () => {
    it("handles fetch with simple URL", async () => {
      const result = queryModule.parseQuery("fetch https://example.com");
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect(result.toolName).toBe("WebFetch");
        expect((result.input as any).url).toBe("https://example.com");
      }
    });

    it("handles fetch with URL and prompt", async () => {
      const result = queryModule.parseQuery("fetch https://example.com summarize this");
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect(result.toolName).toBe("WebFetch");
        expect((result.input as any).url).toBe("https://example.com");
        expect((result.input as any).prompt).toBe("summarize this");
      }
    });

    it("handles fetch with URL containing query params", async () => {
      const result = queryModule.parseQuery(
        "fetch https://api.example.com/data?foo=bar&baz=qux"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain("?");
      }
    });

    it("handles fetch with https URL and empty prompt", async () => {
      const result = queryModule.parseQuery("fetch https://example.com ");
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).prompt).toBe("");
      }
    });

    it("handles fetch with HTTP URL", async () => {
      const result = queryModule.parseQuery("fetch http://example.com/page");
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toBe("http://example.com/page");
      }
    });

    it("handles fetch with complex prompt", async () => {
      const result = queryModule.parseQuery(
        "fetch https://docs.example.com read and extract key points"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).prompt).toBe(
          "read and extract key points"
        );
      }
    });

    it("handles fetch with Chinese characters in prompt", async () => {
      const result = queryModule.parseQuery("fetch https://example.com 抓取内容");
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).prompt).toBe("抓取内容");
      }
    });

    it("returns text kind for non-fetch URLs", async () => {
      const result = queryModule.parseQuery("https://example.com is down?");
      expect(result.kind).toBe("text");
    });
  });

  describe("parseQuery - write/create patterns (lines 180-193)", () => {
    it("handles write command with path and content", async () => {
      const result = queryModule.parseQuery(
        "write /tmp/test.txt hello world"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect(result.toolName).toBe("Write");
        expect((result.input as any).path).toBe("/tmp/test.txt");
        expect((result.input as any).content).toBe("hello world");
      }
    });

    it("handles create command", async () => {
      const result = queryModule.parseQuery(
        "create /tmp/newfile.js console.log('hi')"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect(result.toolName).toBe("Write");
        expect((result.input as any).path).toBe("/tmp/newfile.js");
      }
    });

    it("handles save command", async () => {
      const result = queryModule.parseQuery(
        "save /tmp/data.json {\"key\": \"value\"}"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/data.json");
      }
    });

    it("handles Chinese write command", async () => {
      const result = queryModule.parseQuery(
        "写入 /tmp/file.txt 内容"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/file.txt");
      }
    });

    it("handles Chinese create command", async () => {
      const result = queryModule.parseQuery(
        "创建文件 /tmp/test.js code"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/test.js");
      }
    });

    it("handles write with complex content", async () => {
      const result = queryModule.parseQuery(
        "write /tmp/script.sh #!/bin/bash\necho hello"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).content).toContain("#!/bin/bash");
      }
    });

    it("handles write with JSON content", async () => {
      const result = queryModule.parseQuery(
        'write /tmp/config.json {"name": "test", "value": 123}'
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).content).toContain('"name"');
      }
    });

    it("handles write with multiline content", async () => {
      const result = queryModule.parseQuery(
        "write /tmp/multi.txt line1\nline2\nline3"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).content).toContain("\n");
      }
    });

    it("handles case-insensitive write command", async () => {
      const result = queryModule.parseQuery(
        "WRITE /tmp/test.txt content"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/test.txt");
      }
    });

    it("handles case-insensitive create command", async () => {
      const result = queryModule.parseQuery(
        "CREATE /tmp/new.js code"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/new.js");
      }
    });

    it("handles case-insensitive save command", async () => {
      const result = queryModule.parseQuery(
        "SAVE /tmp/data.txt text"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/data.txt");
      }
    });
  });

  describe("parseQuery - edit/replace patterns (lines 197-210)", () => {
    it("handles edit command with arrow", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/file.txt old text -> new text"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect(result.toolName).toBe("Edit");
        expect((result.input as any).path).toBe("/tmp/file.txt");
        expect((result.input as any).oldString).toBe("old text");
        expect((result.input as any).newString).toBe("new text");
      }
    });

    it("handles replace command with arrow", async () => {
      const result = queryModule.parseQuery(
        "replace /tmp/file.txt hello -> world"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/file.txt");
        expect((result.input as any).oldString).toBe("hello");
        expect((result.input as any).newString).toBe("world");
      }
    });

    it("handles edit command with double arrow", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/file.txt old text => new text"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).newString).toBe("new text");
      }
    });

    it("handles Chinese edit command", async () => {
      const result = queryModule.parseQuery(
        "编辑 /tmp/file.txt 旧内容 -> 新内容"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/file.txt");
      }
    });

    it("handles Chinese replace command", async () => {
      const result = queryModule.parseQuery(
        "替换 /tmp/file.txt 旧 -> 新"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/file.txt");
      }
    });

    it("handles edit with Chinese arrow", async () => {
      const result = queryModule.parseQuery(
        "编辑 /tmp/file.txt 旧内容为 新内容"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).newString).toBe("新内容");
      }
    });

    it("handles case-insensitive edit command", async () => {
      const result = queryModule.parseQuery(
        "EDIT /tmp/file.txt old -> new"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/file.txt");
      }
    });

    it("handles case-insensitive replace command", async () => {
      const result = queryModule.parseQuery(
        "REPLACE /tmp/file.txt hello -> world"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toBe("/tmp/file.txt");
      }
    });

    it("handles edit with complex old/new strings", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/code.js function foo() { return 1; } -> function foo() { return 2; }"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).oldString).toContain("function");
        expect((result.input as any).newString).toContain("return 2");
      }
    });

    it("handles edit with multiline strings", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/file.txt line1\nline2 -> line3\nline4"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).oldString).toContain("\n");
      }
    });

    it("handles Chinese edit with arrow", async () => {
      const result = queryModule.parseQuery(
        "编辑 /tmp/file.txt 旧内容 -> 新内容"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toContain("/tmp/");
      }
    });

    it("handles Chinese edit with '为' arrow", async () => {
      const result = queryModule.parseQuery(
        "编辑 /tmp/file.txt 旧内容为 新内容"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).newString).toBe("新内容");
      }
    });

    it("handles Chinese replace with arrow", async () => {
      const result = queryModule.parseQuery(
        "替换 /tmp/file.txt 旧 -> 新"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).path).toContain("/tmp/");
      }
    });

    it("handles Chinese replace with '为' arrow", async () => {
      const result = queryModule.parseQuery(
        "替换 /tmp/file.txt 旧内容为 新内容"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).newString).toBe("新内容");
      }
    });

    it("returns text kind for non-edit commands", async () => {
      const result = queryModule.parseQuery("edit this file please?");
      expect(result.kind).toBe("text");
    });

    it("returns text kind without proper edit format", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/file.txt just old"
      );
      expect(result.kind).toBe("text");
    });
  });

  describe("parseQuery - default text pattern (line 213)", () => {
    it("returns text kind for simple questions", async () => {
      const result = queryModule.parseQuery("What is the weather?");
      expect(result.kind).toBe("text");
    });

    it("returns text kind for general queries", async () => {
      const result = queryModule.parseQuery("Explain how this works");
      expect(result.kind).toBe("text");
    });

    it("returns text kind for statements", async () => {
      const result = queryModule.parseQuery("I need help with coding");
      expect(result.kind).toBe("text");
    });

    it("handles empty string as text", async () => {
      const result = queryModule.parseQuery("");
      expect(result.kind).toBe("text");
    });

    it("handles whitespace-only string", async () => {
      const result = queryModule.parseQuery("   ");
      expect(result.kind).toBe("text");
    });

    it("handles special characters as text", async () => {
      const result = queryModule.parseQuery("What is 5 + 5?");
      expect(result.kind).toBe("text");
    });

    it("handles unicode characters in text queries", async () => {
      const result = queryModule.parseQuery("你好世界");
      expect(result.kind).toBe("text");
    });

    it("handles emoji in text queries", async () => {
      const result = queryModule.parseQuery("Hello! 👋 How are you?");
      expect(result.kind).toBe("text");
    });

    it("handles code snippets as text when not matching patterns", async () => {
      const result = queryModule.parseQuery(
        "const x = 5; console.log(x);"
      );
      expect(result.kind).toBe("text");
    });

    it("handles SQL queries as text", async () => {
      const result = queryModule.parseQuery(
        "SELECT * FROM users WHERE id = 1"
      );
      expect(result.kind).toBe("text");
    });

    it("handles JSON as text when not in write command", async () => {
      const result = queryModule.parseQuery(
        '{"name": "test", "value": 123}'
      );
      expect(result.kind).toBe("text");
    });

    it("handles markdown as text", async () => {
      const result = queryModule.parseQuery("# Header\n\nSome text");
      expect(result.kind).toBe("text");
    });
  });

  describe("parseQuery - intro and summarize functions", () => {
    it("fetch tool has intro function", async () => {
      const result = queryModule.parseQuery("fetch https://example.com");
      if (result.kind === "tool") {
        expect(typeof result.intro).toBe("function");
      } else {
        expect.unreachable();
      }
    });

    it("write tool has intro function", async () => {
      const result = queryModule.parseQuery(
        "write /tmp/test.txt content"
      );
      if (result.kind === "tool") {
        expect(typeof result.intro).toBe("function");
      } else {
        expect.unreachable();
      }
    });

    it("edit tool has intro function", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/file.txt old -> new"
      );
      if (result.kind === "tool") {
        expect(typeof result.intro).toBe("function");
      } else {
        expect.unreachable();
      }
    });

    it("fetch tool has summarizeResult function", async () => {
      const result = queryModule.parseQuery("fetch https://example.com");
      if (result.kind === "tool") {
        expect(typeof result.summarizeResult).toBe("function");
        const summary = result.summarizeResult({ data: "test" });
        expect(summary).toBeTruthy();
      } else {
        expect.unreachable();
      }
    });

    it("write tool has summarizeResult function", async () => {
      const result = queryModule.parseQuery(
        "write /tmp/test.txt content"
      );
      if (result.kind === "tool") {
        expect(typeof result.summarizeResult).toBe("function");
        const summary = result.summarizeResult({ path: "/tmp/test.txt" });
        expect(summary).toContain("/tmp/test.txt");
      } else {
        expect.unreachable();
      }
    });

    it("edit tool has summarizeResult function", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/file.txt old -> new"
      );
      if (result.kind === "tool") {
        expect(typeof result.summarizeResult).toBe("function");
        const summary = result.summarizeResult();
        expect(summary).toContain("/tmp/file.txt");
      } else {
        expect.unreachable();
      }
    });

    it("fetch tool has summarizeError function", async () => {
      const result = queryModule.parseQuery("fetch https://example.com");
      if (result.kind === "tool") {
        expect(typeof result.summarizeError).toBe("function");
        const errorSummary = result.summarizeError("Network error");
        expect(errorSummary).toContain("失败");
        expect(errorSummary).toContain("Network error");
      } else {
        expect.unreachable();
      }
    });

    it("write tool has summarizeError function", async () => {
      const result = queryModule.parseQuery(
        "write /tmp/test.txt content"
      );
      if (result.kind === "tool") {
        expect(typeof result.summarizeError).toBe("function");
        const errorSummary = result.summarizeError("Permission denied");
        expect(errorSummary).toContain("/tmp/test.txt");
        expect(errorSummary).toContain("失败");
      } else {
        expect.unreachable();
      }
    });

    it("edit tool has summarizeError function", async () => {
      const result = queryModule.parseQuery(
        "edit /tmp/file.txt old -> new"
      );
      if (result.kind === "tool") {
        expect(typeof result.summarizeError).toBe("function");
        const errorSummary = result.summarizeError("File not found");
        expect(errorSummary).toContain("/tmp/file.txt");
        expect(errorSummary).toContain("失败");
      } else {
        expect.unreachable();
      }
    });

    it("text kind returns undefined for intro", async () => {
      const result = queryModule.parseQuery("Hello world");
      if (result.kind === "text") {
        expect(result.intro).toBeUndefined();
      } else {
        expect.unreachable();
      }
    });

    it("text kind returns undefined for summarizeResult", async () => {
      const result = queryModule.parseQuery("Hello world");
      if (result.kind === "text") {
        expect(result.summarizeResult).toBeUndefined();
      } else {
        expect.unreachable();
      }
    });

    it("text kind returns undefined for summarizeError", async () => {
      const result = queryModule.parseQuery("Hello world");
      if (result.kind === "text") {
        expect(result.summarizeError).toBeUndefined();
      } else {
        expect.unreachable();
      }
    });

    it("summarizeResult truncates long results", async () => {
      const result = queryModule.parseQuery(
        "fetch https://example.com"
      );
      if (result.kind === "tool") {
        const longContent = "a".repeat(2000);
        const summary = result.summarizeResult(longContent);
        expect(summary.length).toBeLessThanOrEqual(1200 + 50); // Allow for prefix text
      } else {
        expect.unreachable();
      }
    });

    it("summarizeError includes error message", async () => {
      const result = queryModule.parseQuery(
        "fetch https://example.com"
      );
      if (result.kind === "tool") {
        const summary = result.summarizeError("Connection timeout");
        expect(summary).toContain("Connection timeout");
      } else {
        expect.unreachable();
      }
    });
  });

  describe("parseQuery - complex URL patterns", () => {
    it("handles fetch with port number in URL", async () => {
      const result = queryModule.parseQuery(
        "fetch http://localhost:3000/api/data"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain(":3000");
      }
    });

    it("handles fetch with subdomain", async () => {
      const result = queryModule.parseQuery(
        "fetch https://api.github.com/users/octocat"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain("github.com");
      }
    });

    it("handles fetch with path segments", async () => {
      const result = queryModule.parseQuery(
        "fetch https://example.com/path/to/resource"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain("/path/");
      }
    });

    it("handles fetch with fragment identifier", async () => {
      const result = queryModule.parseQuery(
        "fetch https://example.com/page#section"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain("#");
      }
    });

    it("handles fetch with encoded characters", async () => {
      const result = queryModule.parseQuery(
        "fetch https://example.com/search?q=hello%20world"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain("%20");
      }
    });

    it("handles fetch with IPv6 address", async () => {
      const result = queryModule.parseQuery(
        "fetch http://[::1]:8080/test"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain("[::1]");
      }
    });

    it("handles fetch with query params and fragment", async () => {
      const result = queryModule.parseQuery(
        "fetch https://example.com/page?foo=bar#section"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).toContain("?");
        expect((result.input as any).url).toContain("#");
      }
    });

    it("handles fetch with trailing slash", async () => {
      const result = queryModule.parseQuery(
        "fetch https://example.com/"
      );
      expect(result.kind).toBe("tool");
      if (result.kind === "tool") {
        expect((result.input as any).url).endsWith("/");
      }
    });

    it("handles fetch without protocol", async () => {
      const result = queryModule.parseQuery(
        "fetch example.com/page"
      );
      // Should not match as tool since no http/https prefix
      expect(result.kind).toBe("text");
    });
  });
});

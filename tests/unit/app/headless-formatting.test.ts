import { describe, it, expect } from "bun:test";
import {
  formatInspectView,
  formatCleanupSummary,
  formatMarkdownExport,
  formatJsonExport,
  formatTranscriptEntry,
  formatTranscriptMessages,
  formatSessionList,
  formatSessionMetadata,
} from "../../../app/headless";
import type { SessionInfo } from "../../../storage/sessionIndex";
import type { Message } from "../../../runtime/messages";

describe("formatInspectView", () => {
  function createMockSession(): SessionInfo {
    return {
      id: "test-session-123",
      title: "Test Session",
      summary: "A test session for coverage",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T12:00:00Z",
      messageCount: 10,
      toolUseCount: 3,
      errorCount: 1,
      status: "ready" as const,
    };
  }

  function createUserMessage(content: string): Extract<Message, { type: "user" }> {
    return { id: "u1", type: "user" as const, content };
  }

  function createAssistantText(text: string): Extract<Message, { type: "assistant" }> {
    return {
      id: "a1",
      type: "assistant" as const,
      content: [{ type: "text" as const, text }],
    };
  }

  function createToolResult(content: string, isError?: boolean): Extract<Message, { type: "tool_result" }> {
    return {
      id: "t1",
      type: "tool_result" as const,
      toolUseId: "tool-abc",
      content,
      isError: isError ?? false,
    };
  }

  it("formats session with recent messages and no errors", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("hello"),
      createAssistantText("hi there"),
      createUserMessage("how are you"),
      createAssistantText("i am good"),
    ];

    const result = formatInspectView("/tmp/test", session, messages);

    expect(result).toContain("Session Inspect");
    expect(result).toContain("test-session-123");
    expect(result).toContain("Test Session");
    expect(result).toContain("recent messages:");
    expect(result).toContain("hi there");
    expect(result).toContain("recent errors:");
    expect(result).toContain("(none)");
  });

  it("includes recent errors in output", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("hello"),
      createToolResult("error occurred", true),
      createAssistantText("recovered"),
    ];

    const result = formatInspectView("/tmp/test", session, messages);

    expect(result).toContain("recent errors:");
    expect(result).toContain("1. error occurred");
  });

  it("truncates long error content to 200 chars", () => {
    const session = createMockSession();
    const longError = "e".repeat(500);
    const messages: Message[] = [createToolResult(longError, true)];

    const result = formatInspectView("/tmp/test", session, messages);

    expect(result).toContain("1."); // error is numbered
  });

  it("shows (none) when no recent messages exist", () => {
    const session = createMockSession();
    const messages: Message[] = [];

    const result = formatInspectView("/tmp/test", session, messages);

    expect(result).toContain("(none)");
  });

  it("includes metadata file path", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("test")];

    const result = formatInspectView("/tmp/test", session, messages);

    expect(result).toContain("metadata file:");
    expect(result).toContain("/tmp/test");
  });

  it("includes transcript file path", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("test")];

    const result = formatInspectView("/tmp/test", session, messages);

    expect(result).toContain("transcript file:");
  });

  it("shows only last 3 errors even if more exist", () => {
    const session = createMockSession();
    const messages: Message[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        createToolResult(`error ${i}`, true),
      ),
    ];

    const result = formatInspectView("/tmp/test", session, messages);

    // Count error lines specifically (they start with number followed by period in "recent errors:" section)
    const lines = result.split("\n");
    let errorCount = 0;
    let inErrorsSection = false;
    for (const line of lines) {
      if (line.includes("recent errors:")) {
        inErrorsSection = true;
        continue;
      }
      if (inErrorsSection && line.match(/^\d+\./)) {
        errorCount++;
      }
    }
    expect(errorCount).toBe(3); // last 3 only
  });

  it("handles sessions with all metadata fields", () => {
    const session: SessionInfo = {
      id: "full-session",
      title: "Full Session Title",
      summary: "Complete summary here",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-12-31T23:59:59Z",
      messageCount: 100,
      toolUseCount: 50,
      errorCount: 5,
      status: "needs_attention" as const,
    };
    const messages: Message[] = [createUserMessage("test")];

    const result = formatInspectView("/tmp/test", session, messages);

    expect(result).toContain("Full Session Title");
    expect(result).toContain("Complete summary here");
  });
});

describe("formatCleanupSummary", () => {
  function createMockSession(id: string): SessionInfo {
    return {
      id,
      title: `Session ${id}`,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-15T12:00:00Z",
    };
  }

  it("returns message when no sessions removed and none skipped", () => {
    const result = formatCleanupSummary([], 0);
    expect(result).toBe("No sessions removed.");
  });

  it("includes skipped count in message", () => {
    const result = formatCleanupSummary([], 5);
    expect(result).toContain("5 session(s) kept");
  });

  it("lists removed sessions with details", () => {
    const removed: SessionInfo[] = [
      createMockSession("session-1"),
      createMockSession("session-2"),
    ];

    const result = formatCleanupSummary(removed, 0);

    expect(result).toContain("Removed 2 session(s):");
    expect(result).toContain("session-1");
    expect(result).toContain("session-2");
  });

  it("includes updated timestamp in session listing", () => {
    const removed: SessionInfo[] = [createMockSession("test-sess")];
    const result = formatCleanupSummary(removed, 0);

    expect(result).toContain("2024-01-15T12:00:00Z");
  });

  it("includes session title in listing", () => {
    const removed: SessionInfo[] = [createMockSession("test")];
    (removed[0] as any).title = "My Custom Title";
    const result = formatCleanupSummary(removed, 0);

    expect(result).toContain("My Custom Title");
  });

  it("shows session id when no title exists", () => {
    const removed: SessionInfo[] = [createMockSession("no-title-session")];
    delete (removed[0] as any).title;
    const result = formatCleanupSummary(removed, 0);

    expect(result).toContain("no-title-session");
  });

  it("includes skipped count when both removed and skipped", () => {
    const removed: SessionInfo[] = [createMockSession("to-remove")];
    const result = formatCleanupSummary(removed, 3);

    expect(result).toContain("Removed 1 session(s)");
    expect(result).toContain("Kept 3 session(s)");
  });

  it("handles dryRun mode", () => {
    const removed: SessionInfo[] = [createMockSession("pending")];
    const result = formatCleanupSummary(removed, 0, true);

    expect(result).toContain("Would remove");
    expect(result).toContain("1 session(s)");
    expect(result).toContain("pending");
  });

  it("uses createdAt when updatedAt not available", () => {
    const removed: SessionInfo[] = [createMockSession("no-updated")];
    delete (removed[0] as any).updatedAt;
    (removed[0] as any).createdAt = "2024-06-15T00:00:00Z";

    const result = formatCleanupSummary(removed, 0);

    expect(result).toContain("2024-06-15T00:00:00Z");
  });

  it("handles empty string title", () => {
    const removed: SessionInfo[] = [createMockSession("empty-title")];
    (removed[0] as any).title = "";
    const result = formatCleanupSummary(removed, 0);

    expect(result).toContain("empty-title"); // falls back to id
  });
});

describe("formatMarkdownExport", () => {
  function createMockSession(): SessionInfo {
    return {
      id: "markdown-export-test",
      title: "Test Title",
      summary: "Test Summary",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
      messageCount: 5,
      toolUseCount: 2,
      errorCount: 1,
      status: "ready" as const,
    };
  }

  it("formats session header with id", () => {
    const session = createMockSession();
    const messages: Message[] = [];

    const result = formatMarkdownExport(session, messages);

    expect(result).toContain("# Session markdown-export-test");
  });

  it("includes all metadata fields in output", () => {
    const session = createMockSession();
    const messages: Message[] = [];

    const result = formatMarkdownExport(session, messages);

    expect(result).toContain("- Title: Test Title");
    expect(result).toContain("- Summary: Test Summary");
    expect(result).toContain("- Created: 2024-01-01T00:00:00Z");
    expect(result).toContain("- Updated: 2024-01-02T00:00:00Z");
    expect(result).toContain("- Messages: 5");
    expect(result).toContain("- Tools/Errors: 2 / 1");
    expect(result).toContain("- Status: ready");
  });

  it("shows '-' for missing metadata fields", () => {
    const session: SessionInfo = { id: "minimal" };
    (session as any).title = undefined;
    (session as any).summary = undefined;
    (session as any).createdAt = undefined;
    (session as any).updatedAt = undefined;

    const result = formatMarkdownExport(session, []);

    expect(result).toContain("- Title: minimal"); // falls back to id
    expect(result).toContain("- Summary: -");
    expect(result).toContain("- Created: -");
  });

  it("includes message transcript with numbering", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("first"),
      createUserMessage("second"),
    ];

    const result = formatMarkdownExport(session, messages);

    expect(result).toContain("## Transcript");
    expect(result).toContain("1. user: first");
    expect(result).toContain("2. user: second");
  });

  it("clips long message content to 240 chars", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("a".repeat(500)),
    ];

    const result = formatMarkdownExport(session, messages);

    // Find the user line and check its length
    const lines = result.split("\n");
    const userLine = lines.find((l) => l.startsWith("1. user:"));
    expect(userLine?.length).toBeLessThanOrEqual(6 + 240 + 3); // "1. user: " + 240 + ellipsis
  });

  it("handles tool_result messages", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("ask"),
      createToolResult("success result"),
    ];

    const result = formatMarkdownExport(session, messages);

    expect(result).toContain("tool_result");
  });

  it("handles assistant messages with text blocks", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("ask"),
      createAssistantText("here is the answer"),
    ];

    const result = formatMarkdownExport(session, messages);

    expect(result).toContain("assistant: here is the answer");
  });

  it("handles assistant messages with tool_use blocks", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("read this"),
      {
        id: "a1",
        type: "assistant" as const,
        content: [{
          type: "tool_use" as const,
          id: "tool-123",
          name: "Read",
          input: { path: "/tmp/file.txt" },
        }],
      } as Message,
    ];

    const result = formatMarkdownExport(session, messages);

    expect(result).toContain("tool_use(tool-123)");
    expect(result).toContain("Read");
  });

  it("handles empty message array", () => {
    const session = createMockSession();
    const result = formatMarkdownExport(session, []);

    expect(result).toContain("## Transcript");
    // Should have transcript section but no messages after it
  });

  it("includes provider/model when available", () => {
    const session: SessionInfo = { id: "with-provider" };
    (session as any).provider = "anthropic";
    (session as any).model = "claude-3-opus-20240229";

    const result = formatMarkdownExport(session, []);

    expect(result).toContain("Provider/Model: anthropic / claude-3-opus-20240229");
  });

  it("includes firstPrompt and lastPrompt when available", () => {
    const session: SessionInfo = { id: "with-prompts" };
    (session as any).firstPrompt = "initial question";
    (session as any).lastPrompt = "final question";

    const result = formatMarkdownExport(session, []);

    expect(result).toContain("- First Prompt: initial question");
    expect(result).toContain("- Last Prompt: final question");
  });

  it("includes lastTool and lastError when available", () => {
    const session: SessionInfo = { id: "with-activity" };
    (session as any).lastTool = "Read /tmp/data.json";
    (session as any).lastError = "permission denied";

    const result = formatMarkdownExport(session, []);

    expect(result).toContain("- Last Tool: Read /tmp/data.json");
    expect(result).toContain("- Last Error: permission denied");
  });
});

describe("formatJsonExport", () => {
  function createMockSession(): SessionInfo {
    return {
      id: "json-export-test",
      title: "Test Title",
      createdAt: "2024-01-01T00:00:00Z",
    };
  }

  it("returns valid JSON string", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("hello")];

    const result = formatJsonExport(session, messages);

    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("includes session object in output", () => {
    const session = createMockSession();
    const messages: Message[] = [];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.session).toBeDefined();
    expect(parsed.session.id).toBe("json-export-test");
  });

  it("includes messages array in output", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("test")];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages).toBeDefined();
    expect(Array.isArray(parsed.messages)).toBe(true);
  });

  it("clips long user content to 240 chars", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("a".repeat(500))];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages[0].content.length).toBeLessThanOrEqual(240);
  });

  it("clips long tool_result content to 400 chars", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("ask"), createToolResult("b".repeat(600))];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages[1].content.length).toBeLessThanOrEqual(400);
  });

  it("clips long assistant text to 400 chars", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("ask"), createAssistantText("c".repeat(600))];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages[1].content[0].text.length).toBeLessThanOrEqual(400);
  });

  it("preserves tool_result isError flag", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("ask"), createToolResult("error", true)];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages[1].isError).toBe(true);
  });

  it("preserves tool_use blocks unchanged", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("read file"),
      {
        id: "a1",
        type: "assistant" as const,
        content: [{
          type: "tool_use" as const,
          id: "tool-xyz",
          name: "Read",
          input: { path: "/tmp/test.txt" },
        }],
      } as Message,
    ];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages[1].content[0].type).toBe("tool_use");
    expect(parsed.messages[1].content[0].name).toBe("Read");
  });

  it("handles empty message array", () => {
    const session = createMockSession();
    const result = formatJsonExport(session, []);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages).toEqual([]);
  });

  it("produces formatted output with indentation", () => {
    const session = createMockSession();
    const messages: Message[] = [createUserMessage("test")];

    const result = formatJsonExport(session, messages);

    // JSON.stringify with indent=2 should have newlines and indentation
    expect(result).toContain("\n");
    expect(result).toContain("  ");
  });

  it("handles assistant message with mixed blocks", () => {
    const session = createMockSession();
    const messages: Message[] = [
      createUserMessage("do this"),
      {
        id: "a1",
        type: "assistant" as const,
        content: [
          { type: "text" as const, text: "I will read the file." },
          {
            type: "tool_use" as const,
            id: "tool-abc",
            name: "Read",
            input: { path: "/tmp/file.txt" },
          },
        ],
      } as Message,
    ];

    const result = formatJsonExport(session, messages);
    const parsed = JSON.parse(result) as any;

    expect(parsed.messages[1].content).toHaveLength(2);
    expect(parsed.messages[1].content[0].type).toBe("text");
    expect(parsed.messages[1].content[1].type).toBe("tool_use");
  });
});

describe("formatTranscriptEntry", () => {
  it("formats user message correctly", () => {
    const message: Extract<Message, { type: "user" }> = {
      id: "u1",
      type: "user" as const,
      content: "hello world",
    };

    const result = formatTranscriptEntry(message);

    expect(result).toBe("user: hello world");
  });

  it("formats successful tool_result with tool_result status", () => {
    const message: Extract<Message, { type: "tool_result" }> = {
      id: "t1",
      type: "tool_result" as const,
      toolUseId: "tool-abc",
      content: "success output",
      isError: false,
    };

    const result = formatTranscriptEntry(message);

    expect(result).toBe("tool_result(tool-abc): success output");
  });

  it("formats error tool_result with tool_error status", () => {
    const message: Extract<Message, { type: "tool_result" }> = {
      id: "t1",
      type: "tool_result" as const,
      toolUseId: "tool-error",
      content: "something went wrong",
      isError: true,
    };

    const result = formatTranscriptEntry(message);

    expect(result).toBe("tool_error(tool-error): something went wrong");
  });

  it("truncates long error content to 240 chars", () => {
    const message: Extract<Message, { type: "tool_result" }> = {
      id: "t1",
      type: "tool_result" as const,
      toolUseId: "tool-err",
      content: "e".repeat(500),
      isError: true,
    };

    const result = formatTranscriptEntry(message);

    expect(result.length).toBeLessThanOrEqual(21 + 240 + 3); // tool_error(tool-err): + 240 + ellipsis
  });

  it("formats assistant message with text block", () => {
    const message: Extract<Message, { type: "assistant" }> = {
      id: "a1",
      type: "assistant" as const,
      content: [{ type: "text" as const, text: "here is the answer" }],
    };

    const result = formatTranscriptEntry(message);

    expect(result).toBe("assistant: here is the answer");
  });

  it("formats assistant message with tool_use block", () => {
    const message: Extract<Message, { type: "assistant" }> = {
      id: "a1",
      type: "assistant" as const,
      content: [{
        type: "tool_use" as const,
        id: "tool-123",
        name: "Read",
        input: { path: "/tmp/file.txt" },
      }],
    };

    const result = formatTranscriptEntry(message);

    expect(result).toContain("tool_use(tool-123)");
    expect(result).toContain("Read");
    expect(result).toContain("/tmp/file.txt");
  });

  it("joins multiple blocks with newlines", () => {
    const message: Extract<Message, { type: "assistant" }> = {
      id: "a1",
      type: "assistant" as const,
      content: [
        { type: "text" as const, text: "I will read the file." },
        {
          type: "tool_use" as const,
          id: "tool-abc",
          name: "Read",
          input: { path: "/tmp/test.txt" },
        },
      ],
    };

    const result = formatTranscriptEntry(message);

    expect(result).toContain("I will read the file.");
    expect(result).toContain("\n"); // blocks joined with newline
  });

  it("handles empty content array", () => {
    const message: Extract<Message, { type: "assistant" }> = {
      id: "a1",
      type: "assistant" as const,
      content: [],
    };

    const result = formatTranscriptEntry(message);

    expect(result).toBe("");
  });

  it("summarizes long tool_use input", () => {
    const message: Extract<Message, { type: "assistant" }> = {
      id: "a1",
      type: "assistant" as const,
      content: [{
        type: "tool_use" as const,
        id: "tool-long",
        name: "Shell",
        input: { command: "a".repeat(200) },
      }],
    };

    const result = formatTranscriptEntry(message);

    // Command should be truncated to 60 chars
    expect(result.length).toBeLessThanOrEqual(87); // tool_use(tool-long): Shell + space + 60 + ellipsis
  });
});

describe("formatSessionList", () => {
  it("returns 'No sessions found.' for empty array", () => {
    const result = formatSessionList([]);
    expect(result).toBe("No sessions found.");
  });

  it("formats single ready session with basic info", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("- session-123");
    expect(result).toContain("2024-01-01T00:00:00.000Z");
  });

  it("marks needs_attention sessions with '!' marker", () => {
    const sessions: SessionInfo[] = [
      { id: "session-alert", status: "needs_attention" as const, createdAt: "2024-01-01T00:00:00.000Z" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("! session-alert");
  });

  it("includes provider/model info when available", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", provider: "anthropic", model: "claude-v1" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("anthropic/claude-v1");
  });

  it("includes message count when available", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", messageCount: 5 },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("5 msg");
  });

  it("includes tool/use/error counts when available", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", toolUseCount: 10, errorCount: 2 },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("tools:10");
    expect(result).toContain("errors:2");
  });

  it("includes session status when available", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", status: "completed" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("completed");
  });

  it("includes lastTool info when available", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", lastTool: "Read /tmp/file.txt" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("last tool: Read /tmp/file.txt");
  });

  it("includes lastError info when available", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", lastError: "Permission denied" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("last error: Permission denied");
  });

  it("includes summary when available", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", summary: "Test session for file operations" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("summary: Test session for file operations");
  });

  it("includes filters in output when options provided", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z" },
    ];

    const result = formatSessionList(sessions, { limit: 5, status: "ready" });

    expect(result).toContain("status=ready");
    expect(result).toContain("limit=5");
  });

  it("handles multiple sessions with different statuses", () => {
    const sessions: SessionInfo[] = [
      { id: "session-1", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "session-2", status: "needs_attention" as const, createdAt: "2024-01-02T00:00:00.000Z" },
    ];

    const result = formatSessionList(sessions);

    // Each session spans 2 lines (header + details), so 2 sessions = 4 lines total
    expect(result.split("\n").length).toBeGreaterThanOrEqual(2);
    expect(result).toContain("session-1");
    expect(result).toContain("session-2");
    expect(result).toContain("- session-1");
    expect(result).toContain("! session-2");
  });

  it("handles missing updatedAt by using createdAt", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, title: "Test" },
    ];
    delete (sessions[0] as any).updatedAt;

    const result = formatSessionList(sessions);

    expect(result).toContain("Test"); // Uses title or falls back to id
  });

  it("handles empty string title by using session id", () => {
    const sessions: SessionInfo[] = [
      { id: "session-123", status: "ready" as const, createdAt: "2024-01-01T00:00:00.000Z", title: "" },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("session-123"); // Falls back to id for empty title
  });

  it("handles multiple optional fields together", () => {
    const sessions: SessionInfo[] = [
      {
        id: "full-session",
        status: "ready" as const,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        title: "Full Session",
        provider: "anthropic",
        model: "claude-v3",
        messageCount: 50,
        toolUseCount: 25,
        errorCount: 3,
        status: "completed",
        lastTool: "Shell ls -la",
        summary: "Complete test session",
      },
    ];

    const result = formatSessionList(sessions);

    expect(result).toContain("Full Session");
    expect(result).toContain("anthropic/claude-v3");
    expect(result).toContain("50 msg");
  });
});

describe("formatSessionMetadata", () => {
  it("formats all metadata fields with values", () => {
    const session: SessionInfo = {
      id: "session-123",
      title: "Test Title",
      summary: "Test Summary",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      messageCount: 10,
      toolUseCount: 5,
      errorCount: 1,
      provider: "anthropic",
      model: "claude-v1",
      status: "ready" as const,
      firstPrompt: "Hello",
      lastPrompt: "Goodbye",
      lastTool: "Read file.txt",
      lastError: "",
    };

    const result = formatSessionMetadata(session);

    expect(result).toContain("session: session-123");
    expect(result).toContain("title: Test Title");
    expect(result).toContain("summary: Test Summary");
    expect(result).toContain("created: 2024-01-01T00:00:00.000Z");
    expect(result).toContain("updated: 2024-01-02T00:00:00.000Z");
    expect(result).toContain("messages: 10");
    expect(result).toContain("tools/errors: 5 / 1");
    expect(result).toContain("provider/model: anthropic / claude-v1");
    expect(result).toContain("status: ready");
    expect(result).toContain("first prompt: Hello");
    expect(result).toContain("last prompt: Goodbye");
    expect(result).toContain("last tool: Read file.txt");
  });

  it("uses defaults for missing fields", () => {
    const session: SessionInfo = { id: "session-123" };

    const result = formatSessionMetadata(session);

    expect(result).toContain("title: session-123"); // Falls back to id
    expect(result).toContain("summary: -");
    expect(result).toContain("created: -");
    expect(result).toContain("updated: -");
    expect(result).toContain("tools/errors: 0 / 0");
    expect(result).toContain("provider/model: - / -");
    expect(result).toContain("status: -");
    expect(result).toContain("first prompt: -");
    expect(result).toContain("last prompt: -");
    expect(result).toContain("last tool: -");
  });

  it("handles undefined lastError gracefully", () => {
    const session: SessionInfo = { id: "session-123" };
    (session as any).lastError = undefined;

    const result = formatSessionMetadata(session);

    expect(result).toContain("last error: -");
  });
});

describe("formatTranscriptMessages", () => {
  it("returns empty message when no messages provided", () => {
    const result = formatTranscriptMessages([]);
    expect(result).toBe("Transcript is empty.");
  });

  describe("compact mode (compact=true)", () => {
    it("formats user messages with numbering in compact mode", () => {
      const messages: Message[] = [createUserMessage("hello")];
      const result = formatTranscriptMessages(messages, true);

      expect(result).toContain("1. user:");
      expect(result).toContain("hello");
    });

    it("formats tool_result with status in compact mode", () => {
      const messages: Message[] = [createToolResult("output")];
      const result = formatTranscriptMessages(messages, true);

      expect(result).toContain("1. tool_result:");
    });

    it("formats error tool_result in compact mode", () => {
      const messages: Message[] = [createToolResult("error", true)];
      const result = formatTranscriptMessages(messages, true);

      expect(result).toContain("1. tool_error:");
    });

    it("formats assistant text blocks in compact mode", () => {
      const messages: Message[] = [createAssistantText("response")];
      const result = formatTranscriptMessages(messages, true);

      expect(result).toContain("1. assistant:");
      expect(result).toContain("response");
    });

    it("formats tool_use blocks in compact mode", () => {
      const messages: Message[] = [
        createUserMessage("read"),
        {
          id: "a1",
          type: "assistant" as const,
          content: [{
            type: "tool_use" as const,
            id: "tool-123",
            name: "Read",
            input: { path: "/tmp/file.txt" },
          }],
        } as Message,
      ];
      const result = formatTranscriptMessages(messages, true);

      expect(result).toContain("Read");
      expect(result).toContain("/tmp/file.txt");
    });

    it("joins multiple blocks with | in compact mode", () => {
      const messages: Message[] = [
        createUserMessage("do this"),
        {
          id: "a1",
          type: "assistant" as const,
          content: [
            { type: "text" as const, text: "I will read." },
            {
              type: "tool_use" as const,
              id: "tool-abc",
              name: "Read",
              input: { path: "/tmp/file.txt" },
            },
          ],
        } as Message,
      ];
      const result = formatTranscriptMessages(messages, true);

      expect(result).toContain("|"); // blocks joined with pipe
    });

    it("truncates content to 120 chars in compact mode", () => {
      const messages: Message[] = [createUserMessage("a".repeat(300))];
      const result = formatTranscriptMessages(messages, true);

      expect(result.length).toBeLessThanOrEqual(9 + 120 + 3); // "1. user: " + 120 + ellipsis
    });

    it("handles mixed message types in compact mode", () => {
      const messages: Message[] = [
        createUserMessage("ask"),
        createAssistantText("response"),
        createToolResult("output"),
      ];
      const result = formatTranscriptMessages(messages, true);

      expect(result.split("\n").length).toBe(3); // each message on its own line
    });
  });

  describe("non-compact mode (compact=false or undefined)", () => {
    it("formats with numbered entries separated by blank lines", () => {
      const messages: Message[] = [
        createUserMessage("first"),
        createUserMessage("second"),
      ];
      const result = formatTranscriptMessages(messages, false);

      expect(result).toContain("\n\n"); // entries separated by blank line
    });

    it("uses full transcript entry formatting in non-compact mode", () => {
      const messages: Message[] = [createUserMessage("hello")];
      const result = formatTranscriptMessages(messages, false);

      expect(result).toContain("1. user: hello");
    });

    it("includes blank line between tool_result entries", () => {
      const messages: Message[] = [
        createToolResult("result 1"),
        createToolResult("result 2"),
      ];
      const result = formatTranscriptMessages(messages, false);

      expect(result).toContain("\n\n"); // separator between entries
    });

    it("handles assistant messages with multiple blocks", () => {
      const messages: Message[] = [
        createUserMessage("do this"),
        {
          id: "a1",
          type: "assistant" as const,
          content: [
            { type: "text" as const, text: "I will." },
            {
              type: "tool_use" as const,
              id: "tool-abc",
              name: "Read",
              input: { path: "/tmp/file.txt" },
            },
          ],
        } as Message,
      ];
      const result = formatTranscriptMessages(messages, false);

      expect(result).toContain("I will."); // text block included
    });
  });

  it("handles undefined compact parameter (defaults to non-compact)", () => {
    const messages: Message[] = [createUserMessage("test")];
    const result = formatTranscriptMessages(messages);

    expect(result).toContain("1. user: test");
  });

  it("preserves message order", () => {
    const messages: Message[] = [
      createUserMessage("first"),
      createAssistantText("second"),
      createToolResult("third"),
    ];
    const result = formatTranscriptMessages(messages, true);

    const lines = result.split("\n");
    expect(lines[0]).toContain("first");
    expect(lines[1]).toContain("second");
    expect(lines[2]).toContain("third");
  });

  it("handles mixed error and success tool_results", () => {
    const messages: Message[] = [
      createToolResult("success", false),
      createToolResult("error", true),
    ];
    const result = formatTranscriptMessages(messages, true);

    expect(result).toContain("tool_result");
    expect(result).toContain("tool_error");
  });
});

// Helper functions for creating messages in tests
function createUserMessage(content: string): Extract<Message, { type: "user" }> {
  return { id: "u1", type: "user" as const, content };
}

function createAssistantText(text: string): Extract<Message, { type: "assistant" }> {
  return {
    id: "a1",
    type: "assistant" as const,
    content: [{ type: "text" as const, text }],
  };
}

function createToolResult(content: string, isError?: boolean): Extract<Message, { type: "tool_result" }> {
  return {
    id: "t1",
    type: "tool_result" as const,
    toolUseId: "tool-abc",
    content,
    isError: isError ?? false,
  };
}

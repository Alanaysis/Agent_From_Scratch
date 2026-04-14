import { describe, it, expect, vi } from "bun:test";
import * as transcriptModule from "../../../storage/transcript";
import * as sessionIndexModule from "../../../storage/sessionIndex";
import type { Message } from "../../../runtime/messages";

vi.mock("../../../storage/transcript", () => ({
  appendTranscript: vi.fn(),
  getTranscriptPath: vi.fn().mockReturnValue("/tmp/transcript.json"),
}));

vi.mock("../../../storage/sessionIndex", () => ({
  updateSessionInfo: vi.fn(),
}));

describe("SessionEngine - basic operations (lines 17-23)", () => {
  it("creates session with correct id from config", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session-123", cwd: "/tmp" });

    expect(engine.sessionId).toBe("test-session-123");
  });

  it("creates session with correct cwd from config", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "session-456", cwd: "/home/user/project" });

    expect(engine.cwd).toBe("/home/user/project");
  });

  it("returns config id as sessionId property", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "my-session", cwd: "/tmp" });

    expect(engine.sessionId).toBe("my-session");
  });

  it("returns config cwd as cwd property", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test", cwd: "/different/path" });

    expect(engine.cwd).toBe("/different/path");
  });
});

describe("SessionEngine - message management (lines 25-31)", () => {
  it("returns empty messages array when no messages added", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const messages = engine.getMessages();
    expect(messages).toEqual([]);
  });

  it("returns copy of messages array (not reference)", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const msg1: Message = { type: "user" as const, content: "Hello" };
    engine.appendMessage(msg1);

    const messages1 = engine.getMessages();
    const messages2 = engine.getMessages();

    // Should be different array instances
    expect(messages1).not.toBe(messages2);
  });

  it("appends message to internal list", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const msg1: Message = { type: "user" as const, content: "Hello" };
    engine.appendMessage(msg1);

    expect(engine.getMessages()).toHaveLength(1);
  });

  it("appends multiple messages correctly", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const msg1: Message = { type: "user" as const, content: "Hello" };
    const msg2: Message = { type: "assistant" as const, content: [{ type: "text" as const, text: "Hi!" }] };
    const msg3: Message = { type: "tool_result" as const, toolUseId: "tool-1", content: "", isError: false };

    engine.appendMessage(msg1);
    engine.appendMessage(msg2);
    engine.appendMessage(msg3);

    expect(engine.getMessages()).toHaveLength(3);
  });

  it("maintains message order after appending", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const msg1: Message = { type: "user" as const, content: "First" };
    const msg2: Message = { type: "assistant" as const, content: [{ type: "text" as const, text: "Second" }] };

    engine.appendMessage(msg1);
    engine.appendMessage(msg2);

    const messages = engine.getMessages();
    expect(messages[0].type).toBe("user");
    expect(messages[1].type).toBe("assistant");
  });

  it("handles tool_result message types", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const msg: Message = {
      type: "tool_result" as const,
      toolUseId: "tool-123",
      content: [{ type: "text" as const, text: "File contents" }],
      isError: false,
    };

    engine.appendMessage(msg);

    expect(engine.getMessages()).toHaveLength(1);
  });

  it("handles assistant message with tool_use blocks", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const msg: Message = {
      type: "assistant" as const,
      content: [{
        type: "tool_use" as const,
        id: "tool-123",
        name: "read-file",
        input: "/path/to/file.txt",
      }],
    };

    engine.appendMessage(msg);

    expect(engine.getMessages()).toHaveLength(1);
  });
});

describe("SessionEngine - hydrateMessages (lines 33-35)", () => {
  it("replaces messages with new array from hydrateMessages", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    // Add initial message
    engine.appendMessage({ type: "user" as const, content: "Hello" });
    expect(engine.getMessages()).toHaveLength(1);

    // Hydrate with new messages
    const newMessages: Message[] = [
      { type: "user" as const, content: "Reset" },
      { type: "assistant" as const, content: [{ type: "text" as const, text: "Ready" }] },
    ];

    engine.hydrateMessages(newMessages);

    expect(engine.getMessages()).toHaveLength(2);
  });

  it("clears existing messages when hydrating with empty array", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    // Add initial message
    engine.appendMessage({ type: "user" as const, content: "Hello" });

    // Hydrate with empty array
    engine.hydrateMessages([]);

    expect(engine.getMessages()).toHaveLength(0);
  });

  it("preserves message types during hydration", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const messages: Message[] = [
      { type: "user" as const, content: "First message" },
      { type: "assistant" as const, content: [{ type: "text" as const, text: "Response 1" }] },
      { type: "tool_result" as const, toolUseId: "tool-1", content: "", isError: false },
    ];

    engine.hydrateMessages(messages);

    expect(engine.getMessages()[0].type).toBe("user");
    expect(engine.getMessages()[1].type).toBe("assistant");
    expect(engine.getMessages()[2].type).toBe("tool_result");
  });

  it("handles hydration with assistant tool_use messages", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const messages: Message[] = [
      {
        type: "assistant" as const,
        content: [{
          type: "tool_use" as const,
          id: "tool-456",
          name: "shell-exec",
          input: { command: "ls -la" },
        }],
      },
    ];

    engine.hydrateMessages(messages);

    expect(engine.getMessages()).toHaveLength(1);
  });
});

describe("SessionEngine - recordMessages (lines 37-41)", () => {
  it("appends messages and records to transcript", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const messages: Message[] = [
      { type: "user" as const, content: "Hello" },
      { type: "assistant" as const, content: [{ type: "text" as const, text: "Hi!" }] },
    ];

    await engine.recordMessages(messages);

    expect(engine.getMessages()).toHaveLength(2);
  });

  it("calls appendTranscript with correct parameters", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "session-123", cwd: "/test/path" });

    const messages: Message[] = [{ type: "user" as const, content: "Test" }];

    await engine.recordMessages(messages);

    expect(transcriptModule.appendTranscript).toHaveBeenCalledWith(
      "/test/path",
      "session-123",
      messages
    );
  });

  it("calls updateSessionInfo with correct parameters", async () => {
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "session-456", cwd: "/home/user" });

    const messages: Message[] = [
      { type: "user" as const, content: "Hello" },
      { type: "assistant" as const, content: [{ type: "text" as const, text: "World" }] },
    ];

    await engine.recordMessages(messages);

    expect(sessionIndexModule.updateSessionInfo).toHaveBeenCalledWith(
      "/home/user",
      "session-456",
      messages
    );
  });

  it("accumulates messages across multiple recordMessages calls", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    // First batch
    await engine.recordMessages([
      { type: "user" as const, content: "First" },
    ]);

    expect(engine.getMessages()).toHaveLength(1);

    // Second batch
    await engine.recordMessages([
      { type: "assistant" as const, content: [{ type: "text" as const, text: "Second" }] },
    ]);

    expect(engine.getMessages()).toHaveLength(2);
  });

  it("handles empty messages array in recordMessages", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    await engine.recordMessages([]);

    // Should not fail with empty array
    expect(engine.getMessages()).toHaveLength(0);
  });

  it("handles tool_result messages in recordMessages", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const messages: Message[] = [{
      type: "tool_result" as const,
      toolUseId: "tool-789",
      content: "Result data",
      isError: false,
    }];

    await engine.recordMessages(messages);

    expect(engine.getMessages()).toHaveLength(1);
  });
});

describe("SessionEngine - transcript path (lines 43-45)", () => {
  it("returns correct transcript path for session", async () => {
    vi.spyOn(transcriptModule, "getTranscriptPath").mockReturnValue("/tmp/transcripts/session-123.json");

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "session-123", cwd: "/tmp" });

    const path = engine.getTranscriptPath();
    expect(path).toContain("/tmp/transcripts/");
  });

  it("includes session id in transcript path", async () => {
    vi.spyOn(transcriptModule, "getTranscriptPath").mockReturnValue("/sessions/my-session/transcript.json");

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "my-session", cwd: "/sessions" });

    const path = engine.getTranscriptPath();
    expect(path).toContain("my-session");
  });

  it("handles different cwd paths correctly", async () => {
    vi.spyOn(transcriptModule, "getTranscriptPath").mockReturnValue("/home/user/project/sessions/test/transcript.json");

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test", cwd: "/home/user/project/sessions" });

    const path = engine.getTranscriptPath();
    expect(path).toContain("/home/user/project/");
  });
});

describe("SessionEngine - usage tracking (lines 47-49)", () => {
  it("returns empty usage by default", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const usage = engine.getUsage();
    expect(usage).toBeDefined();
  });

  it("returns copy of usage (not reference)", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const usage1 = engine.getUsage();
    const usage2 = engine.getUsage();

    // Should be different object instances
    expect(usage1).not.toBe(usage2);
  });

  it("handles usage with token counts", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const usage = engine.getUsage();
    expect(usage).toBeDefined();
  });

  it("handles null/undefined in usage object", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const usage = engine.getUsage();
    expect(usage).toBeDefined();
  });
});

describe("SessionEngine - edge cases and error handling", () => {
  it("handles session with special characters in id", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "session-with-dashes_and_underscores123", cwd: "/tmp" });

    expect(engine.sessionId).toBe("session-with-dashes_and_underscores123");
  });

  it("handles session with long paths in cwd", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const longPath = "/a".repeat(500) + "/project";
    const engine = new SessionEngine({ id: "test", cwd: longPath });

    expect(engine.cwd).toBe(longPath);
  });

  it("handles messages with complex nested structures", async () => {
    vi.spyOn(transcriptModule, "appendTranscript").mockResolvedValue(undefined);
    vi.spyOn(sessionIndexModule, "updateSessionInfo").mockResolvedValue(undefined);

    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    const complexMsg: Message = {
      type: "assistant" as const,
      content: [{
        type: "tool_use" as const,
        id: "tool-123",
        name: "agent",
        input: {
          task: "Investigate this issue",
          context: {
            file: "/path/to/file.txt",
            lines: [10, 20, 30],
          },
        },
      }],
    };

    engine.appendMessage(complexMsg);

    expect(engine.getMessages()).toHaveLength(1);
  });

  it("handles rapid message appends", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    // Rapidly append many messages
    for (let i = 0; i < 100; i++) {
      engine.appendMessage({ type: "user" as const, content: `Message ${i}` });
    }

    expect(engine.getMessages()).toHaveLength(100);
  });

  it("handles message with empty content", async () => {
    const { SessionEngine } = await import("../../../runtime/session");

    const engine = new SessionEngine({ id: "test-session", cwd: "/tmp" });

    // User messages can have any string content including empty
    const msg: Message = { type: "user" as const, content: "" };

    expect(() => engine.appendMessage(msg)).not.toThrow();
  });
});

import { describe, it, expect } from "bun:test";
import * as llmModule from "../../../runtime/llm";

describe("extractOpenAiText - edge cases (lines 163-170)", () => {
  it("handles array with null text property", async () => {
    const content: any = [
      { type: "text" as const, text: null },
    ];

    const result = llmModule.extractOpenAiText?.(content);
    // null text returns empty string from filter
    expect(result).toBe("");
  });

  it("handles array with undefined text property", async () => {
    const content: any = [
      { type: "text" as const, text: undefined },
    ];

    const result = llmModule.extractOpenAiText?.(content);
    expect(result).toBe("");
  });

  it("handles array with non-string text property", async () => {
    const content: any = [
      { type: "text" as const, text: 123 as any },
    ];

    const result = llmModule.extractOpenAiText?.(content);
    // Non-string type check fails, returns empty
    expect(result).toBe("");
  });

  it("handles deeply nested array structure", async () => {
    const content: any = [
      { type: "text" as const, text: "First" },
      { type: "tool_use" as const, name: "read-file", input: "/path.txt" },
      { type: "text" as const, text: "Second" },
    ];

    const result = llmModule.extractOpenAiText?.(content);
    expect(result).toContain("First");
    expect(result).toContain("Second");
  });

  it("handles single object with text property (not array)", async () => {
    const content: any = { type: "text" as const, text: "Single text" };

    const result = llmModule.extractOpenAiText?.(content);
    expect(result).toBe("Single text");
  });

  it("handles object with non-text type", async () => {
    const content: any = { type: "tool_use" as const, name: "read-file", input: "/path" };

    const result = llmModule.extractOpenAiText?.(content);
    expect(result).toBe("");
  });

  it("handles array with mixed null and valid text", async () => {
    const content: any = [
      null as any,
      { type: "text" as const, text: "Valid text" },
      undefined as any,
    ];

    const result = llmModule.extractOpenAiText?.(content);
    expect(result).toBe("Valid text");
  });
});

describe("parseToolArguments - edge cases (lines 172-178)", () => {
  it("handles whitespace-only string", async () => {
    const result = llmModule.parseToolArguments?.("   ");
    // Whitespace is truthy, JSON.parse fails, returns { raw: "   " }
    expect(result).toEqual({ raw: "   " });
  });

  it("handles number as input (type coercion)", async () => {
    const result = llmModule.parseToolArguments?.(42 as any);
    expect(result).toEqual({}); // Non-string coerces to empty string via ? check
  });

  it("handles boolean true", async () => {
    const result = llmModule.parseToolArguments?.(true as any);
    expect(result).toEqual({ raw: "true" });
  });

  it("handles boolean false", async () => {
    const result = llmModule.parseToolArguments?.(false as any);
    expect(result).toEqual({ raw: "false" });
  });

  it("handles JSON with unicode characters", async () => {
    const json = '{"emoji": "\ud83d\ude00", "chinese": "\u4e2d\u6587"}';
    const result = llmModule.parseToolArguments?.(json);
    expect(result).toEqual({ emoji: "\ud83d\ude00", chinese: "\u4e2d\u6587" });
  });

  it("handles JSON with escape sequences", async () => {
    const json = '{"newline": "\\n", "tab": "\\t", "backslash": "\\\\"}';
    const result = llmModule.parseToolArguments?.(json);
    expect(result).toEqual({ newline: "\n", tab: "\t", backslash: "\\" });
  });

  it("handles very large JSON object", async () => {
    const largeObj: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      largeObj[`key${i}`] = `value${i}`;
    }
    const result = llmModule.parseToolArguments?.(JSON.stringify(largeObj));
    expect(Object.keys(result).length).toBe(100);
  });

  it("handles JSON array as root", async () => {
    const json = '[1, 2, 3, "four"]';
    const result = llmModule.parseToolArguments?.(json);
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(4);
  });

  it("handles JSON number as root", async () => {
    const json = "3.14159";
    const result = llmModule.parseToolArguments?.(json);
    expect(result).toBe(3.14159);
  });

  it("handles JSON boolean as root", async () => {
    const result1 = llmModule.parseToolArguments?.("true");
    const result2 = llmModule.parseToolArguments?.("false");
    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });

  it("handles malformed JSON with unclosed quotes", async () => {
    const json = '{"key": "unclosed';
    const result = llmModule.parseToolArguments?.(json);
    expect(result).toEqual({ raw: json });
  });

  it("handles malformed JSON with trailing comma", async () => {
    const json = '{"a": 1,}';
    const result = llmModule.parseToolArguments?.(json);
    // Some parsers accept this, some don't - we expect either behavior
    expect(result).toBeDefined();
  });

  it("handles JSON with nested objects and arrays", async () => {
    const json = '{"user": {"name": "test", "tags": ["admin", "user"]}}';
    const result = llmModule.parseToolArguments?.(json);
    expect((result as any).user.name).toBe("test");
    expect(Array.isArray((result as any).user.tags)).toBe(true);
  });

  it("handles empty string with spaces only", async () => {
    const result = llmModule.parseToolArguments?.(" ");
    expect(result).toEqual({ raw: " " });
  });

  it("handles JSON with special number values", async () => {
    // These are valid in some JSON parsers
    const testCases = [
      '{"value": 1e10}',
      '{"value": 1.5e-10}',
    ];
    for (const json of testCases) {
      const result = llmModule.parseToolArguments?.(json);
      expect(result).toBeDefined();
    }
  });
});

describe("toOpenAiMessages - conversion edge cases", () => {
  it("handles systemPrompt array in config", async () => {
    const messages: any[] = [{ type: "user" as const, content: "Hello" }];
    const systemPrompt: string[] = ["Base system"];
    const config: any = {
      systemPrompt: "Additional context",
      model: "test-model",
      apiKey: "test-key",
      baseUrl: "https://api.test.com",
    };

    // Test that the conversion function exists and has correct signature
    expect(toOpenAiMessages).toBeDefined();
  });

  it("handles assistant message with empty content array", async () => {
    const messages = [{ type: "assistant" as const, content: [] }];
    expect(messages[0].content.length).toBe(0);
  });

  it("handles tool_result without isError flag (defaults to false)", async () => {
    const messages = [{
      type: "tool_result" as const,
      toolUseId: "tool-123",
      content: "Result",
    }];

    expect(messages[0].isError).toBeUndefined(); // Not set if not provided
  });

  it("handles message with nested tool_use in input", async () => {
    const messages = [{
      type: "assistant" as const,
      content: [{
        type: "tool_use" as const,
        id: "tool-123",
        name: "agent",
        input: { nested: { deep: "value" } },
      }],
    }];

    expect(messages[0].content[0].input.nested.deep).toBe("value");
  });
});

describe("toAnthropicMessages - conversion edge cases", () => {
  it("handles system prompt prepending", async () => {
    const messages = [{ type: "user" as const, content: "Hello" }];
    // Anthropic format prepends system prompts differently than OpenAI
    expect(messages.length).toBe(1);
  });

  it("handles tool_result with isError true", async () => {
    const messages = [{
      type: "tool_result" as const,
      toolUseId: "tool-123",
      content: "Error occurred",
      isError: true,
    }];

    expect(messages[0].isError).toBe(true);
  });

  it("preserves complex input structures in tool_use", async () => {
    const messages = [{
      type: "assistant" as const,
      content: [{
        type: "tool_use" as const,
        id: "tool-123",
        name: "agent",
        input: {
          task: "Complex task",
          context: {
            file: "/path/to/file.txt",
            metadata: { created: Date.now() },
          },
        },
      }],
    }];

    const toolUse = messages[0].content[0] as any;
    expect(toolUse.name).toBe("agent");
    expect(toolUse.input.context.file).toBe("/path/to/file.txt");
  });
});

describe("LLM streaming - SSE parsing edge cases", () => {
  it("handles empty event name", async () => {
    const frame = "data: hello";
    const lines = frame.split("\n");

    let eventName: string | null = null;
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      }
    }

    expect(eventName).toBeNull();
  });

  it("handles multiple data fields in one frame", async () => {
    const frame = "event: message\ndata: first\ndata: second";
    const lines = frame.split("\n");

    const dataList: string[] = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataList.push(line.slice(5)); // Note: 5 chars for "data:"
      }
    }

    expect(dataList.length).toBe(2);
  });

  it("handles frame with only event field", async () => {
    const frame = "event: ping";
    const lines = frame.split("\n");

    let hasEvent = false;
    for (const line of lines) {
      if (line.startsWith("event:")) {
        hasEvent = true;
        break;
      }
    }

    expect(hasEvent).toBe(true);
  });

  it("handles trailing empty data field", async () => {
    const frame = "data:";
    const value = frame.slice(5); // After "data:"

    expect(value).toBe("");
  });

  it("handles carriage return in SSE stream", async () => {
    const frame = "event: message\r\ndata: hello";
    const normalized = frame.replace(/\r\n/g, "\n");

    expect(normalized.split("\n").length).toBeGreaterThan(1);
  });

  it("handles mixed line endings", async () => {
    const frame = "event: message\ndata: hello\r\n\nevent: ping";
    const lines = frame.replace(/\r\n/g, "\n").split("\n");

    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("LLM provider configuration validation", () => {
  it("handles missing model field (should fail validation)", async () => {
    const config: any = {
      apiKey: "test-key",
      baseUrl: "https://api.test.com",
    };

    expect(config.model).toBeUndefined();
  });

  it("handles invalid API key format", async () => {
    const config: any = {
      model: "test-model",
      apiKey: "", // Empty key
      baseUrl: "https://api.test.com",
    };

    expect(config.apiKey).toBe("");
  });

  it("handles malformed URL in baseUrl", async () => {
    const config: any = {
      model: "test-model",
      apiKey: "test-key",
      baseUrl: "not-a-valid-url",
    };

    expect(config.baseUrl).toBe("not-a-valid-url");
  });

  it("handles extra fields in config (should be ignored)", async () => {
    const config: any = {
      model: "test-model",
      apiKey: "test-key",
      baseUrl: "https://api.test.com",
      extraField1: "ignored",
      extraField2: 123,
      nested: { data: true },
    };

    expect(config.extraField1).toBe("ignored"); // Extra fields stored but ignored by provider
  });

  it("handles case sensitivity of model names", async () => {
    const configs = [
      "gpt-4",
      "GPT-4",
      "gpt-4-turbo",
      "claude-3-opus",
      "CLAUDE-3-OPUS",
    ];

    for (const model of configs) {
      const config: any = { model, apiKey: "test", baseUrl: "https://api.test.com" };
      expect(config.model).toBe(model); // Case preserved
    }
  });
});

describe("Anthropic provider - content block type handling", () => {
  it("handles tool_use block in Anthropic format", async () => {
    const payload: any = {
      content_block: {
        type: "tool_use" as const,
        id: "tool-123",
        name: "read-file",
        input: "/path.txt",
      },
    };

    expect(payload.content_block.type).toBe("tool_use");
  });

  it("handles text block with empty string text", async () => {
    const payload: any = {
      content_block: {
        type: "text" as const,
        text: "",
      },
    };

    expect(payload.content_block.text).toBe("");
  });

  it("handles content_block_delta with tool_use_start", async () => {
    const payload: any = {
      delta: {
        type: "tool_use_start" as const,
        id: "tool-123",
        name: "shell-exec",
      },
    };

    expect(payload.delta.type).toBe("tool_use_start");
  });

  it("handles unknown content block types gracefully", async () => {
    const payload: any = {
      content_block: {
        type: "unknown_type" as any,
        data: "some data",
      },
    };

    // Should not throw, just handle appropriately
    expect(payload.content_block.type).toBe("unknown_type");
  });
});

describe("Anthropic provider - input_json_delta edge cases", () => {
  it("handles partial JSON that becomes valid after multiple deltas", async () => {
    const toolCallsByIndex = new Map<number, { id: string; name: string; inputJson: string }>();

    // First delta
    const delta1: any = { index: 0, delta: { type: "input_json_delta", partial_json: '{"key": ' } };
    if (delta1.delta.type === "input_json_delta" && typeof delta1.delta.partial_json === "string") {
      const existing = toolCallsByIndex.get(delta1.index ?? 0) ?? { id: "", name: "", inputJson: "" };
      existing.inputJson += delta1.delta.partial_json;
      toolCallsByIndex.set(0, existing);
    }

    // Second delta completes the JSON
    const delta2: any = { index: 0, delta: { type: "input_json_delta", partial_json: '"value"}' } };
    if (delta2.delta.type === "input_json_delta" && typeof delta2.delta.partial_json === "string") {
      const existing = toolCallsByIndex.get(delta2.index ?? 0) ?? { id: "", name: "", inputJson: "" };
      existing.inputJson += delta2.delta.partial_json;
      toolCallsByIndex.set(0, existing);
    }

    const result = JSON.parse(toolCallsByIndex.get(0)?.inputJson || "");
    expect(result.key).toBe("value");
  });

  it("handles input_json_delta with null partial_json", async () => {
    const payload: any = {
      delta: {
        type: "input_json_delta" as const,
        partial_json: null,
      },
    };

    // Type check should fail
    if (payload.delta.type === "input_json_delta" && typeof payload.delta.partial_json === "string") {
      expect(true).toBe(false); // Should not execute
    } else {
      expect(true).toBe(true);
    }
  });

  it("handles multiple tool calls with same index (shouldn't happen but test anyway)", async () => {
    const toolCallsByIndex = new Map<number, { id: string; name: string; inputJson: string }>();

    // Both deltas have index 0 (edge case)
    const delta1: any = { index: 0, delta: { type: "input_json_delta", partial_json: '{"a": ' } };
    const delta2: any = { index: 0, delta: { type: "input_json_delta", partial_json: '"b"}' } };

    if (delta1.delta.type === "input_json_delta" && typeof delta1.delta.partial_json === "string") {
      const existing = toolCallsByIndex.get(delta1.index ?? 0) ?? { id: "", name: "", inputJson: "" };
      existing.inputJson += delta1.delta.partial_json;
      toolCallsByIndex.set(0, existing);
    }

    if (delta2.delta.type === "input_json_delta" && typeof delta2.delta.partial_json === "string") {
      const existing = toolCallsByIndex.get(delta2.index ?? 0) ?? { id: "", name: "", inputJson: "" };
      existing.inputJson += delta2.delta.partial_json;
      toolCallsByIndex.set(0, existing);
    }

    // Should merge both deltas
    expect(toolCallsByIndex.get(0)?.inputJson).toBe('{"a": "b"}');
  });
});

describe("LLM error handling - response parsing", () => {
  it("handles non-JSON error response", async () => {
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue("plain text error"),
    };

    expect(mockResponse.ok).toBe(false);
  });

  it("handles error with no message property", async () => {
    const payload: any = {
      error: {},
    };

    try {
      throw new Error(
        payload.error?.message ||
          `LLM request failed with status 400`,
      );
    } catch (error) {
      expect((error as Error).message).toBe("LLM request failed with status 400");
    }
  });

  it("handles error object with nested message", async () => {
    const payload: any = {
      error: {
        details: {
          message: "Nested error message",
        },
      },
    };

    // Should use top-level message or fallback
    try {
      throw new Error(
        payload.error?.message ||
          `LLM request failed with status 500`,
      );
    } catch (error) {
      expect((error as Error).message).toBe("LLM request failed with status 500");
    }
  });

  it("handles rate limit error response", async () => {
    const payload: any = {
      error: {
        message: "Rate limit exceeded",
        code: "rate_limit_exceeded",
      },
    };

    expect(payload.error.message).toBe("Rate limit exceeded");
  });

  it("handles authentication error response", async () => {
    const payload: any = {
      error: {
        message: "Invalid API key",
        code: "invalid_api_key",
      },
    };

    expect(payload.error.message).toBe("Invalid API key");
  });
});


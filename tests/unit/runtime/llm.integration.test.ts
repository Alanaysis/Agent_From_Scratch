import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

// Mock fetch globally for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('LLM Module - Integration Tests', () => {
  let tempDir: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-integration-test-'));
    vi.clearAllMocks();
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.CCL_LLM_API_KEY;
    delete process.env.CCL_LLM_MODEL;
    delete process.env.CCL_LLM_PROVIDER;
    delete process.env.CCL_LLM_BASE_URL;
    delete process.env.CCL_LLM_SYSTEM_PROMPT;
    delete process.env.CCL_ANTHROPIC_VERSION;
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
    // Bun doesn't have resetModules - just restore env
    process.env = originalEnv;
  });

  describe('extractOpenAiText - helper function', () => {
    it('extracts text from string content directly', async () => {
      const { getLlmConfigFromEnv } = await import('../../../runtime/llm');
      // We need to access the private extractOpenAiText function
      // Since it's not exported, we test indirectly through runLlmTurn

      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  // First chunk - text content
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":"Hello"}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  // Second chunk - more text
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":" World"}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  // End marker
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
    });

    it('handles array content with text blocks', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Array content format with multiple text parts
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":[{"type":"text","text":"Part"},{"type":"text","text":"2"}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      // Should concatenate all text parts
      expect(result.text).toContain('Part');
    });

    it('handles empty content gracefully', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toBe('');
    });

    it('handles null content in response', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Content is null/undefined
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toBe('');
    });

    it('handles undefined content in response', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Delta exists but content is undefined
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toBe('');
    });
  });

  describe('parseToolArguments - helper function', () => {
    it('parses valid JSON correctly', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Tool call with valid JSON arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"Read","arguments":"{\\"path\\":\\"file.txt\\"}"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [
          {
            name: 'Read',
            description: 'Read a file',
            parameters: { type: 'object', properties: { path: { type: 'string' } } },
          },
        ],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('Read');
      expect(result.toolCalls[0].input).toEqual({ path: 'file.txt' });
    });

    it('handles empty string arguments', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Tool call with empty arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"Tool","arguments":""}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.toolCalls).toHaveLength(1);
      // Empty string should return empty object
      expect(result.toolCalls[0].input).toEqual({});
    });

    it('falls back to raw object when JSON parsing fails', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Tool call with invalid JSON arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"Tool","arguments":"not valid json"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.toolCalls).toHaveLength(1);
      // Should fall back to wrapping in raw property
      expect((result.toolCalls[0].input as any).raw).toBe('not valid json');
    });

    it('handles null arguments', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Tool call with null arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"Tool"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.toolCalls).toHaveLength(1);
      // Null arguments should return empty object
      expect(result.toolCalls[0].input).toEqual({});
    });
  });

  describe('readSseEvents - streaming handler', () => {
    it('handles multiple SSE events correctly', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":"Hello"}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  // Multiple events in one chunk
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":" World"}}]}

event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"Tool","arguments":"{}"}}]}}]}


`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      let accumulatedText = '';
      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [
          { name: 'Tool', description: 'A test tool', parameters: {} },
        ],
        onTextDelta: (text) => {
          accumulatedText = text;
        },
      });

      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
    });

    it('handles incomplete SSE frames gracefully', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  // Incomplete frame - no double newline yet
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":"Partial`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  // Complete the frame
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`"}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toContain('Partial');
    });

    it('handles malformed data lines', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Malformed line without "data:" prefix
                  const data = encoder.encode(`event: message
This is not a valid SSE line

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":"Valid"}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toContain('Valid');
    });

    it('handles empty data lines', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Empty data line
                  const data = encoder.encode(`event: message
data:

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"content":"Test"}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toContain('Test');
    });

    it('handles [DONE] marker correctly', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      // Should complete without error even with just [DONE]
      expect(result).toBeDefined();
    });

    it('handles missing response body', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: null,
      } as any);

      await expect(
        (await import('../../../runtime/llm')).runLlmTurn({
          messages: [],
          systemPrompt: [],
          tools: [],
        })
      ).rejects.toThrow('Streaming response body is missing');
    });
  });

  describe('OpenAI Provider - Tool Call Handling', () => {
    it('handles multiple tool calls in sequence', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // First tool call
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"Read","arguments":"{\\"path\\":\\"file1.txt\\"}"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  // Second tool call
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_2","function":{"name":"Read","arguments":"{\\"path\\":\\"file2.txt\\"}"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [
          { name: 'Read', description: 'Read a file', parameters: {} },
        ],
      });

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].name).toBe('Read');
      expect(result.toolCalls[1].name).toBe('Read');
    });

    it('handles incremental tool call arguments', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // First part of arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"Read"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  // Partial arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\""}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  // More arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"path"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 4) {
                  const encoder = new TextEncoder();
                  // Final arguments
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"file.txt\\"}"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 5) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [
          { name: 'Read', description: 'Read a file', parameters: {} },
        ],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('Read');
      expect((result.toolCalls[0].input as any).path).toBe('file.txt');
    });

    it('handles tool call with missing id', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Tool call without id
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"Read","arguments":"{}"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [{ name: 'Read', description: 'Read a file', parameters: {} }],
      });

      expect(result.toolCalls).toHaveLength(1);
      // ID should be empty string when not provided
      expect(result.toolCalls[0].id).toBe('');
    });
  });

  describe('Anthropic Provider - Tool Call Handling', () => {
    beforeEach(() => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'claude-3-opus';
      process.env.CCL_LLM_PROVIDER = 'anthropic';
    });

    it('handles tool_use content_block_start event', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // content_block_start for tool_use
                  const data = encoder.encode(`event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_abc123","name":"Read","input":{"path":"file.txt"}}}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message_stop
data: {"type":"message_stop"}

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [
          { name: 'Read', description: 'Read a file', parameters: {} },
        ],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('Read');
      expect((result.toolCalls[0].input as any).path).toBe('file.txt');
    });

    it('handles partial_tool_use_delta event', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // content_block_start
                  const data = encoder.encode(`event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_abc123","name":"Read"}}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  // partial_json for arguments - first chunk: {"path":"
                  const dataStr1 = String.raw`event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"partial_json","partial_json":"{\"path\":\""}}

`;
                  return { done: false, value: encoder.encode(dataStr1) };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  // More partial JSON - completing the path value and closing object
                  const dataStr2 = String.raw`event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"partial_json","partial_json":"file.txt\""}}

`;
                  const data2 = encoder.encode(dataStr2);
                  return { done: false, value: data2 };
                } else if (callCount === 4) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message_stop
data: {"type":"message_stop"}

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [{ name: 'Read', description: 'Read a file', parameters: {} }],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('Read');
    });

    it('handles error event correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // Error event
                  const data = encoder.encode(`event: error
data: {"type":"error","error":{"message":"Rate limit exceeded","type":"rate_limit_error"}}

`);
                  return { done: false, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      await expect(
        (await import('../../../runtime/llm')).runLlmTurn({
          messages: [],
          systemPrompt: [],
          tools: [],
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('handles text content_block correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // content_block_start for text
                  const data = encoder.encode(`event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  // text delta
                  const data = encoder.encode(`event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  // More text
                  const data = encoder.encode(`event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}

`);
                  return { done: false, value: data };
                } else if (callCount === 4) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message_stop
data: {"type":"message_stop"}

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result.text).toContain('Hello');
      expect(result.text).toContain('World');
    });

    it('handles mixed text and tool_use blocks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  // First text block
                  const data = encoder.encode(`event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  // Text delta
                  const data = encoder.encode(`event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Before tool"}}

`);
                  return { done: false, value: data };
                } else if (callCount === 3) {
                  const encoder = new TextEncoder();
                  // Second block - tool_use
                  const data = encoder.encode(`event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_abc","name":"Read","input":{"path":"file.txt"}}}

`);
                  return { done: false, value: data };
                } else if (callCount === 4) {
                  const encoder = new TextEncoder();
                  // Finish text block
                  const data = encoder.encode(`event: message_stop
data: {"type":"message_stop"}

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [{ name: 'Read', description: 'Read a file', parameters: {} }],
      });

      expect(result.text).toContain('Before tool');
      expect(result.toolCalls).toHaveLength(1);
    });
  });

  describe('getProvider - provider selection', () => {
    it('selects OpenAI provider for openai config', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';
      process.env.CCL_LLM_PROVIDER = 'openai';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
        },
      } as any);

      await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      // Should call OpenAI endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('selects Anthropic provider for anthropic config', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'claude-3-opus';
      process.env.CCL_LLM_PROVIDER = 'anthropic';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
        },
      } as any);

      await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      // Should call Anthropic endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-key',
            'anthropic-version': expect.any(String),
          }),
        })
      );
    });

    it('defaults to OpenAI when provider is not anthropic', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';
      // No provider specified - should default to openai

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
        },
      } as any);

      await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });
  });

  describe('runLlmTurn - comprehensive scenarios', () => {
    it('handles complete conversation with tool calls and responses', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      // First call returns a tool use
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let callCount = 0;
            return {
              read: async () => {
                callCount++;
                if (callCount === 1) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"Read","arguments":"{\\"path\\":\\"test.txt\\"}"}}]}}]}

`);
                  return { done: false, value: data };
                } else if (callCount === 2) {
                  const encoder = new TextEncoder();
                  const data = encoder.encode(`event: message
data: [DONE]

`);
                  return { done: true, value: data };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [
          { id: 'user-1', type: 'user' as const, content: 'Read test.txt' },
        ],
        systemPrompt: ['You are a helpful assistant'],
        tools: [
          { name: 'Read', description: 'Read a file', parameters: {} },
        ],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('Read');
    });

    it('handles empty messages array', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: ['System prompt'],
        tools: [],
      });

      expect(result).toBeDefined();
    });

    it('handles empty systemPrompt array', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [{ id: 'user-1', type: 'user' as const, content: 'Hello' }],
        systemPrompt: [],
        tools: [],
      });

      expect(result).toBeDefined();
    });

    it('handles empty tools array', async () => {
      process.env.CCL_LLM_API_KEY = 'test-key';
      process.env.CCL_LLM_MODEL = 'gpt-4o';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({ read: async () => ({ done: true, value: undefined }) }),
        },
      } as any);

      const result = await (await import('../../../runtime/llm')).runLlmTurn({
        messages: [],
        systemPrompt: [],
        tools: [],
      });

      expect(result).toBeDefined();
    });
  });
});

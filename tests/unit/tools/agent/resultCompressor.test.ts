import { describe, it, expect } from 'bun:test';
import { compressSubagentResult } from '../../../../tools/agent/resultCompressor';
import type { Message, AssistantMessage } from '../../../../runtime/messages';

describe('compressSubagentResult', () => {
  it('returns default message for empty messages', () => {
    const result = compressSubagentResult([]);
    expect(result).toBe('Subagent completed with no text output.');
  });

  it('extracts text from assistant messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'assistant',
        content: [{ type: 'text', text: 'Hello from subagent' }],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('Hello from subagent');
  });

  it('joins multiple assistant texts with double newline', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'assistant',
        content: [{ type: 'text', text: 'First finding' }],
      } as AssistantMessage,
      {
        id: 'msg-2',
        type: 'assistant',
        content: [{ type: 'text', text: 'Second finding' }],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('First finding\n\nSecond finding');
  });

  it('ignores tool_result messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'assistant',
        content: [{ type: 'text', text: 'Analysis result' }],
      } as AssistantMessage,
      {
        id: 'msg-2',
        type: 'tool_result',
        toolUseId: 'tu-1',
        content: '{"data": "raw tool output"}',
      } as Message,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('Analysis result');
  });

  it('ignores user messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'user',
        content: 'Do this task',
      } as Message,
      {
        id: 'msg-2',
        type: 'assistant',
        content: [{ type: 'text', text: 'Task done' }],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('Task done');
  });

  it('ignores empty text blocks', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'assistant',
        content: [{ type: 'text', text: '' }],
      } as AssistantMessage,
      {
        id: 'msg-2',
        type: 'assistant',
        content: [{ type: 'text', text: '   ' }],
      } as AssistantMessage,
      {
        id: 'msg-3',
        type: 'assistant',
        content: [{ type: 'text', text: 'Actual content' }],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('Actual content');
  });

  it('ignores tool_use blocks in assistant messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'assistant',
        content: [
          { type: 'text', text: 'Reading file...' },
          { type: 'tool_use', id: 'tu-1', name: 'Read', input: { path: '/test' } },
        ],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('Reading file...');
  });

  it('handles mixed message types correctly', () => {
    const messages: Message[] = [
      { id: 'msg-1', type: 'user', content: 'Search for config' } as Message,
      {
        id: 'msg-2',
        type: 'assistant',
        content: [{ type: 'text', text: 'Let me search...' }],
      } as AssistantMessage,
      { id: 'msg-3', type: 'tool_result', toolUseId: 'tu-1', content: '{}' } as Message,
      {
        id: 'msg-4',
        type: 'assistant',
        content: [{ type: 'text', text: 'Found config at /etc/app.conf' }],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('Let me search...\n\nFound config at /etc/app.conf');
  });

  it('returns default when all text blocks are empty', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'assistant',
        content: [{ type: 'text', text: '' }],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('Subagent completed with no text output.');
  });

  it('handles unicode content', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        type: 'assistant',
        content: [{ type: 'text', text: '分析结果：发现3个关键问题' }],
      } as AssistantMessage,
    ];

    const result = compressSubagentResult(messages);
    expect(result).toBe('分析结果：发现3个关键问题');
  });
});

import { describe, it, expect } from 'bun:test';
import {
  estimateTokens,
  estimateMessageTokens,
  compressMessages,
} from '../../../runtime/usage';

describe('Context Window Management', () => {
  describe('estimateTokens', () => {
    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('estimates ~4 chars per token for English', () => {
      const text = 'Hello World Test'; // 16 chars
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThanOrEqual(3);
      expect(tokens).toBeLessThanOrEqual(6);
    });

    it('counts newlines as separate tokens', () => {
      const withNewlines = 'a\nb\nc'; // 3 newlines
      const withoutNewlines = 'abc'; // 0 newlines
      const diff = estimateTokens(withNewlines) - estimateTokens(withoutNewlines);
      expect(diff).toBe(3);
    });

    it('handles null/undefined gracefully', () => {
      expect(estimateTokens(null as any)).toBe(0);
      expect(estimateTokens(undefined as any)).toBe(0);
    });
  });

  describe('estimateMessageTokens', () => {
    it('returns 0 for empty array', () => {
      expect(estimateMessageTokens([])).toBe(0);
    });

    it('estimates tokens for user messages', () => {
      const messages = [{ type: 'user', content: 'Hello World' }];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('estimates tokens for assistant messages with text blocks', () => {
      const messages = [{
        type: 'assistant',
        content: [{ type: 'text', text: 'This is a response' }],
      }];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('estimates tokens for assistant messages with tool_use blocks', () => {
      const messages = [{
        type: 'assistant',
        content: [{ type: 'tool_use', input: { path: '/test/file.txt' } }],
      }];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('estimates tokens for tool_result messages', () => {
      const messages = [{ type: 'tool_result', content: 'File content here' }];
      const tokens = estimateMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('sums tokens across multiple messages', () => {
      const single = [{ type: 'user', content: 'Hello' }];
      const double = [
        { type: 'user', content: 'Hello' },
        { type: 'assistant', content: [{ type: 'text', text: 'World' }] },
      ];
      const singleTokens = estimateMessageTokens(single);
      const doubleTokens = estimateMessageTokens(double);
      expect(doubleTokens).toBeGreaterThan(singleTokens);
    });
  });

  describe('compressMessages', () => {
    it('returns original messages when under 80% threshold', () => {
      const messages = [
        { type: 'user', content: 'Hello' },
        { type: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
      ];
      const { compressed, summary } = compressMessages(messages, 10000, 1000);
      expect(compressed).toHaveLength(2);
      expect(summary).toBe('');
    });

    it('compresses old messages when over threshold', () => {
      // Create enough messages to trigger compression
      const messages = [];
      for (let i = 0; i < 20; i++) {
        messages.push({ type: 'user', content: `Message ${i} with some content to fill tokens` });
        messages.push({ type: 'assistant', content: [{ type: 'text', text: `Response ${i} with content` }] });
      }

      // Set target low enough to trigger compression
      const { compressed, summary } = compressMessages(messages, 100, 500);
      expect(compressed.length).toBeLessThan(messages.length);
      expect(summary).toContain('Earlier conversation summary');
    });

    it('keeps last 30% of messages', () => {
      const messages = [];
      for (let i = 0; i < 30; i++) {
        messages.push({ type: 'user', content: `Message ${i}` });
      }

      const { compressed } = compressMessages(messages, 50, 500);
      const keepCount = Math.max(3, Math.floor(30 * 0.3));
      expect(compressed.length).toBe(keepCount);
    });

    it('keeps at least 3 messages', () => {
      const messages = [
        { type: 'user', content: 'a' },
        { type: 'user', content: 'b' },
        { type: 'user', content: 'c' },
        { type: 'user', content: 'd' },
      ];
      const { compressed } = compressMessages(messages, 5, 100);
      expect(compressed.length).toBeGreaterThanOrEqual(3);
    });

    it('summary includes message count', () => {
      const messages = [];
      for (let i = 0; i < 20; i++) {
        messages.push({ type: 'user', content: `Message ${i} content` });
      }

      const { summary } = compressMessages(messages, 50, 500);
      expect(summary).toMatch(/\d+ messages compressed/);
    });
  });
});

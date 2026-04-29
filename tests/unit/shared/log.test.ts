import { describe, it, expect } from 'bun:test';
import { logDebug } from '../../../shared/log';

describe('Logging Utilities', () => {
  describe('logDebug', () => {
    it('accepts simple string message without throwing', () => {
      expect(() => logDebug('simple message')).not.toThrow();
    });

    it('accepts empty string without throwing', () => {
      expect(() => logDebug('')).not.toThrow();
    });

    it('accepts long messages without throwing', () => {
      const longMessage = 'x'.repeat(10000);
      expect(() => logDebug(longMessage)).not.toThrow();
    });

    it('accepts message with special characters', () => {
      const message = 'Special: \n\t\r\\\"quotes\\\"\u00e9\u00fc';
      expect(() => logDebug(message)).not.toThrow();
    });

    it('accepts unicode and emoji in messages', () => {
      const message = 'Unicode: \u4e2d\u6587 \ud55c\uc77c \ud83c\udf89';
      expect(() => logDebug(message)).not.toThrow();
    });

    it('accepts JSON-like strings', () => {
      const message = '{"key":"value","nested":{"a":1}}';
      expect(() => logDebug(message)).not.toThrow();
    });

    it('accepts multiline messages', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      expect(() => logDebug(message)).not.toThrow();
    });

    it('does not return any value (void)', () => {
      const result = logDebug('test');
      expect(result).toBeUndefined();
    });

    it('handles null-like strings', () => {
      expect(() => logDebug('null')).not.toThrow();
      expect(() => logDebug('undefined')).not.toThrow();
      expect(() => logDebug('NaN')).not.toThrow();
    });

    it('handles very short messages', () => {
      expect(() => logDebug('a')).not.toThrow();
      expect(() => logDebug(' ')).not.toThrow();
    });

    it('handles messages with newlines at different positions', () => {
      expect(() => logDebug('\nstart')).not.toThrow();
      expect(() => logDebug('end\n')).not.toThrow();
      expect(() => logDebug('\nmiddle\n')).not.toThrow();
    });

    it('handles carriage return and tab characters', () => {
      const message = 'Carriage\rReturn\tTab';
      expect(() => logDebug(message)).not.toThrow();
    });
  });
});

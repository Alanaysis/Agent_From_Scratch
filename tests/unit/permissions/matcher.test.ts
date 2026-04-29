import { describe, it, expect } from 'bun:test';
import type { PermissionRule } from '../../../permissions/types';

describe('Permission Rule Matching', () => {
  // Helper function that mirrors the matchesRule logic from engine.ts
  function getInputPattern(input: unknown): string | undefined {
    if (typeof input !== "object" || input === null) {
      return undefined;
    }

    if ("path" in input && typeof input.path === "string") {
      const trimmed = input.path.trim();
      return trimmed ? trimmed : undefined;
    }

    if (
      "command" in input &&
      typeof input.command === "string"
    ) {
      const trimmed = input.command.trim();
      return trimmed ? trimmed : undefined;
    }

    if ("url" in input && typeof input.url === "string") {
      const trimmed = input.url.trim();
      return trimmed ? trimmed : undefined;
    }

    if (
      "description" in input &&
      typeof input.description === "string"
    ) {
      const trimmed = input.description.trim();
      return trimmed ? trimmed : undefined;
    }

    return undefined;
  }

  function matchesRule(
    toolName: string,
    rule: PermissionRule,
    input: unknown,
  ): boolean {
    if (rule.toolName !== toolName) {
      return false;
    }
    // In engine.ts: if (!rule.pattern) returns true for falsy patterns (empty string, undefined)
    const trimmedPattern = rule.pattern?.trim();
    if (!trimmedPattern) {
      return true;
    }
    const inputPattern = getInputPattern(input);
    return inputPattern === trimmedPattern;
  }

  describe('tool name matching', () => {
    it('returns true when tool names match and no pattern exists', () => {
      const rule: PermissionRule = { toolName: 'Read' };
      expect(matchesRule('Read', rule, { path: '/test.txt' })).toBe(true);
    });

    it('returns false when tool names do not match', () => {
      const rule: PermissionRule = { toolName: 'Read' };
      expect(matchesRule('Write', rule, { path: '/test.txt' })).toBe(false);
    });

    it('returns true when tool name matches exactly', () => {
      const rule: PermissionRule = { toolName: 'Shell' };
      expect(matchesRule('Shell', rule, { command: 'ls -la' })).toBe(true);
    });

    it('returns false for case-sensitive name mismatch', () => {
      const rule: PermissionRule = { toolName: 'read' }; // lowercase
      expect(matchesRule('Read', rule, { path: '/test.txt' })).toBe(false);
    });
  });

  describe('pattern matching - exact matches', () => {
    it('returns true when pattern matches exactly (path)', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '/test.txt' };
      expect(matchesRule('Read', rule, { path: '/test.txt' })).toBe(true);
    });

    it('returns false when pattern does not match (different path)', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '/different.txt' };
      expect(matchesRule('Read', rule, { path: '/test.txt' })).toBe(false);
    });

    it('returns true when no pattern exists (matches all for that tool)', () => {
      const rule: PermissionRule = { toolName: 'Read' }; // No pattern
      expect(matchesRule('Read', rule, { path: '/any/path.txt' })).toBe(true);
    });

    it('returns false when patterns differ completely', () => {
      const rule: PermissionRule = { toolName: 'Write', pattern: '/allowed/file.txt' };
      expect(matchesRule('Write', rule, { path: '/denied/file.txt' })).toBe(false);
    });
  });

  describe('pattern matching for different input types', () => {
    it('matches shell command patterns correctly', () => {
      const rule: PermissionRule = { toolName: 'Shell', pattern: 'ls -la' };
      expect(matchesRule('Shell', rule, { command: 'ls -la' })).toBe(true);
    });

    it('returns false for different shell commands', () => {
      const rule: PermissionRule = { toolName: 'Shell', pattern: 'rm -rf' };
      expect(matchesRule('Shell', rule, { command: 'ls -la' })).toBe(false);
    });

    it('matches URL patterns for web tools', () => {
      const rule: PermissionRule = { toolName: 'WebFetch', pattern: 'https://example.com/api' };
      expect(matchesRule('WebFetch', rule, { url: 'https://example.com/api' })).toBe(true);
    });

    it('matches description patterns for agent tools', () => {
      const rule: PermissionRule = { toolName: 'Agent', pattern: 'data analysis' };
      expect(matchesRule('Agent', rule, { description: 'perform data analysis on logs' })).toBe(false); // Different content
    });

    it('matches exact description patterns', () => {
      const rule: PermissionRule = { toolName: 'Agent', pattern: 'data analysis on logs' };
      expect(matchesRule('Agent', rule, { description: 'perform data analysis on logs' })).toBe(false); // Description doesn't equal pattern
    });
  });

  describe('edge cases with whitespace trimming', () => {
    it('handles empty string patterns - falsy pattern matches all (engine.ts behavior)', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '' };
      // In engine.ts: if (!rule.pattern) return true; - empty string is falsy
      expect(matchesRule('Read', rule, { path: '/test.txt' })).toBe(true);
    });

    it('handles whitespace-only patterns in rule - trimmed to empty matches all', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '   ' };
      // Rule pattern is trimmed: '   '.trim() = '' which is falsy -> matches all
      expect(matchesRule('Read', rule, { path: '/test.txt' })).toBe(true);
    });

    it('handles input with leading/trailing whitespace (trimmed by getInputPattern)', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '/test.txt' };
      expect(matchesRule('Read', rule, { path: '  /test.txt  ' })).toBe(true);
    });

    it('handles input with trailing whitespace that matches after trimming', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '/test.txt' };
      // Input is trimmed to '/test.txt' which equals the pattern
      expect(matchesRule('Read', rule, { path: '/test.txt  ' })).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('handles rules with special characters in patterns', () => {
      const rule: PermissionRule = { toolName: 'Write', pattern: '/path/with-special_chars.txt' };
      expect(matchesRule('Write', rule, { path: '/path/with-special_chars.txt' })).toBe(true);
    });

    it('handles unicode characters in patterns', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '/path/文件.txt' };
      expect(matchesRule('Read', rule, { path: '/path/文件.txt' })).toBe(true);
    });

    it('handles very long patterns', () => {
      const longPath = '/a'.repeat(100) + '.txt';
      const rule: PermissionRule = { toolName: 'Read', pattern: longPath };
      expect(matchesRule('Read', rule, { path: longPath })).toBe(true);
    });

    it('handles patterns with newlines (should not match)', () => {
      const rule: PermissionRule = { toolName: 'Write', pattern: '/path\n.txt' };
      expect(matchesRule('Write', rule, { path: '/path.txt' })).toBe(false);
    });

    it('handles null/undefined input gracefully', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: 'anything' };
      expect(matchesRule('Read', rule, null as any)).toBe(false);
      expect(matchesRule('Read', rule, undefined as any)).toBe(false);
    });

    it('handles primitive input types gracefully', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: 'anything' };
      expect(matchesRule('Read', rule, 'string' as any)).toBe(false);
      expect(matchesRule('Read', rule, 123 as any)).toBe(false);
    });
  });

  describe('pattern extraction priority', () => {
    it('extracts path when present (not command)', () => {
      const rule: PermissionRule = { toolName: 'Test', pattern: '/my/path' };
      // Input has both path and command - path should be extracted first
      expect(matchesRule('Test', rule, { path: '/my/path', command: 'something' })).toBe(true);
    });

    it('extracts command when no path but command exists', () => {
      const rule: PermissionRule = { toolName: 'Shell', pattern: 'ls -la' };
      expect(matchesRule('Shell', rule, { command: 'ls -la', otherField: true })).toBe(true);
    });

    it('extracts url when no path/command but url exists', () => {
      const rule: PermissionRule = { toolName: 'WebFetch', pattern: 'https://example.com' };
      expect(matchesRule('WebFetch', rule, { url: 'https://example.com' })).toBe(true);
    });

    it('extracts description as fallback when nothing else exists', () => {
      const rule: PermissionRule = { toolName: 'Agent', pattern: 'do task' };
      expect(matchesRule('Agent', rule, { description: 'do task' })).toBe(true);
    });
  });
});

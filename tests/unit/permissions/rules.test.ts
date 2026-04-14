import { describe, it, expect } from 'bun:test';
import { addAllowRule } from '../../../permissions/rules';
import type { PermissionContext, PermissionRule } from '../../../permissions/types';

describe('Permissions Rules', () => {
  const baseContext: PermissionContext = {
    mode: 'default',
    allowRules: [],
    denyRules: [],
    askRules: [],
  };

  describe('addAllowRule', () => {
    it('adds a rule to allowRules array', () => {
      const newRule: PermissionRule = { toolName: 'Read' };
      const result = addAllowRule(baseContext, newRule);

      expect(result.allowRules).toHaveLength(1);
      expect(result.allowRules[0]).toEqual(newRule);
    });

    it('preserves existing allow rules when adding a new one', () => {
      const initialContext: PermissionContext = {
        ...baseContext,
        allowRules: [{ toolName: 'Read' }],
      };

      const newRule: PermissionRule = { toolName: 'Write' };
      const result = addAllowRule(initialContext, newRule);

      expect(result.allowRules).toHaveLength(2);
      expect(result.allowRules[0]).toEqual({ toolName: 'Read' });
      expect(result.allowRules[1]).toEqual(newRule);
    });

    it('preserves other context properties when adding a rule', () => {
      const initialContext: PermissionContext = {
        ...baseContext,
        mode: 'acceptEdits',
        denyRules: [{ toolName: 'Shell' }],
      };

      const newRule: PermissionRule = { toolName: 'Read' };
      const result = addAllowRule(initialContext, newRule);

      expect(result.mode).toBe('acceptEdits');
      expect(result.denyRules).toHaveLength(1);
      expect(result.denyRules[0]).toEqual({ toolName: 'Shell' });
    });

    it('creates a new array (not mutating original)', () => {
      const initialContext: PermissionContext = {
        ...baseContext,
        allowRules: [{ toolName: 'Read' }],
      };

      addAllowRule(initialContext, { toolName: 'Write' });

      // Original should be unchanged
      expect(initialContext.allowRules).toHaveLength(1);
      expect(initialContext.allowRules[0]).toEqual({ toolName: 'Read' });
    });

    it('adds rules with patterns', () => {
      const newRule: PermissionRule = {
        toolName: 'Write',
        pattern: '/allowed/*',
      };
      const result = addAllowRule(baseContext, newRule);

      expect(result.allowRules).toHaveLength(1);
      expect(result.allowRules[0]).toEqual(newRule);
    });

    it('adds multiple rules sequentially', () => {
      let context: PermissionContext = baseContext;

      context = addAllowRule(context, { toolName: 'Read' });
      context = addAllowRule(context, { toolName: 'Write' });
      context = addAllowRule(context, { toolName: 'Shell' });

      expect(context.allowRules).toHaveLength(3);
      expect(context.allowRules.map(r => r.toolName)).toEqual(['Read', 'Write', 'Shell']);
    });

    it('handles rules with undefined pattern (matches all for that tool)', () => {
      const newRule: PermissionRule = { toolName: 'Read' }; // No pattern
      const result = addAllowRule(baseContext, newRule);

      expect(result.allowRules[0].toolName).toBe('Read');
      expect(result.allowRules[0].pattern).toBeUndefined();
    });
  });

  describe('rule structure validation', () => {
    it('creates valid rule with required toolName field', () => {
      const rule: PermissionRule = { toolName: 'TestTool' };
      const result = addAllowRule(baseContext, rule);

      expect(result.allowRules[0].toolName).toBe('TestTool');
    });

    it('creates valid rule with optional pattern field', () => {
      const rule: PermissionRule = { toolName: 'TestTool', pattern: '/test/path' };
      const result = addAllowRule(baseContext, rule);

      expect(result.allowRules[0].pattern).toBe('/test/path');
    });

    it('preserves pattern when adding rule with pattern', () => {
      const rule: PermissionRule = { toolName: 'Write', pattern: '/data/*.json' };
      const result = addAllowRule(baseContext, rule);

      expect(result.allowRules[0].pattern).toBe('/data/*.json');
    });
  });

  describe('context immutability', () => {
    it('does not mutate the original context object', () => {
      const originalContext: PermissionContext = {
        ...baseContext,
        allowRules: [{ toolName: 'Read' }],
      };

      const originalAllowRulesRef = originalContext.allowRules;

      addAllowRule(originalContext, { toolName: 'Write' });

      expect(originalContext.allowRules).toBe(originalAllowRulesRef);
      expect(originalContext.allowRules).toHaveLength(1);
    });

    it('returns a new context object with spread operator', () => {
      const result = addAllowRule(baseContext, { toolName: 'Read' });

      expect(result).not.toBe(baseContext);
    });
  });

  describe('edge cases', () => {
    it('adds rule to empty allowRules array', () => {
      const context: PermissionContext = {
        ...baseContext,
        allowRules: [],
      };

      const result = addAllowRule(context, { toolName: 'Read' });

      expect(result.allowRules).toHaveLength(1);
    });

    it('handles rules with empty string pattern', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '' };
      const result = addAllowRule(baseContext, rule);

      expect(result.allowRules[0].pattern).toBe('');
    });

    it('handles rules with complex patterns', () => {
      const rule: PermissionRule = {
        toolName: 'Write',
        pattern: '/path/with/special-chars_123/file.txt',
      };
      const result = addAllowRule(baseContext, rule);

      expect(result.allowRules[0].pattern).toBe(rule.pattern);
    });

    it('handles rules with unicode in pattern', () => {
      const rule: PermissionRule = { toolName: 'Read', pattern: '/path/文件.txt' };
      const result = addAllowRule(baseContext, rule);

      expect(result.allowRules[0].pattern).toBe('/path/文件.txt');
    });
  });

  describe('integration with permission context modes', () => {
    it('allows adding rules in default mode', () => {
      const context: PermissionContext = { ...baseContext, mode: 'default' };
      const result = addAllowRule(context, { toolName: 'Read' });

      expect(result.mode).toBe('default');
      expect(result.allowRules).toHaveLength(1);
    });

    it('allows adding rules in acceptEdits mode', () => {
      const context: PermissionContext = { ...baseContext, mode: 'acceptEdits' };
      const result = addAllowRule(context, { toolName: 'Read' });

      expect(result.mode).toBe('acceptEdits');
    });

    it('allows adding rules in bypassPermissions mode', () => {
      const context: PermissionContext = { ...baseContext, mode: 'bypassPermissions' };
      const result = addAllowRule(context, { toolName: 'Read' });

      expect(result.mode).toBe('bypassPermissions');
    });
  });
});

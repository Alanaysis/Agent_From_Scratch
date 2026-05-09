import { describe, it, expect } from 'bun:test';
import {
  shouldReflect,
  parseReflectionOutput,
  type ReflectionTrigger,
  DEFAULT_REFLECTION_CONFIG,
  type ReflectionConfig,
} from '../../../runtime/reflection';

describe('Reflection Engine', () => {
  describe('shouldReflect', () => {
    it('returns false when disabled', () => {
      const config: ReflectionConfig = { ...DEFAULT_REFLECTION_CONFIG, enabled: false };
      expect(
        shouldReflect({ type: 'task_failed', errorCount: 5, lastError: 'err' }, config),
      ).toBe(false);
    });

    it('returns true for task_failed with enough errors', () => {
      expect(
        shouldReflect({ type: 'task_failed', errorCount: 2, lastError: 'err' }),
      ).toBe(true);
    });

    it('returns false for task_failed with few errors', () => {
      expect(
        shouldReflect({ type: 'task_failed', errorCount: 1, lastError: 'err' }),
      ).toBe(false);
    });

    it('returns true for repeated_errors with count >= 3', () => {
      expect(
        shouldReflect({ type: 'repeated_errors', errorPattern: 'timeout', count: 3 }),
      ).toBe(true);
    });

    it('returns false for repeated_errors with count < 3', () => {
      expect(
        shouldReflect({ type: 'repeated_errors', errorPattern: 'timeout', count: 2 }),
      ).toBe(false);
    });

    it('returns true for cron_schedule', () => {
      expect(
        shouldReflect({ type: 'cron_schedule', schedule: '0 2 * * *' }),
      ).toBe(true);
    });

    it('returns true for user_request', () => {
      expect(
        shouldReflect({ type: 'user_request', prompt: 'reflect on your performance' }),
      ).toBe(true);
    });

    it('returns false for task_completed when reflectionOnComplete is off', () => {
      const config: ReflectionConfig = { ...DEFAULT_REFLECTION_CONFIG, reflectionOnComplete: false };
      expect(
        shouldReflect({ type: 'task_completed', errorCount: 0, toolUseCount: 5 }, config),
      ).toBe(false);
    });

    it('returns true for task_completed with errors when reflectionOnComplete is on', () => {
      const config: ReflectionConfig = { ...DEFAULT_REFLECTION_CONFIG, reflectionOnComplete: true };
      expect(
        shouldReflect({ type: 'task_completed', errorCount: 1, toolUseCount: 5 }, config),
      ).toBe(true);
    });

    it('returns true for task_completed with high tool use when reflectionOnComplete is on', () => {
      const config: ReflectionConfig = { ...DEFAULT_REFLECTION_CONFIG, reflectionOnComplete: true };
      expect(
        shouldReflect({ type: 'task_completed', errorCount: 0, toolUseCount: 20 }, config),
      ).toBe(true);
    });
  });

  describe('parseReflectionOutput', () => {
    it('parses structured reflection output', () => {
      const output = [
        '## Success Patterns',
        '- Used sub-agents for parallel exploration',
        '- Read config files before making changes',
        '',
        '## Anti-Patterns',
        '- Called Shell without validating command',
        '- Made assumptions about file structure',
        '',
        '## Optimization Opportunities',
        '- Cache file tree results for repeated queries',
        '',
        '## Skill Suggestions',
        '- config-review: Review and validate configuration files before changes',
        '- safe-shell: Always dry-run shell commands before execution',
      ].join('\n');

      const parsed = parseReflectionOutput(output);

      expect(parsed.successPatterns).toHaveLength(2);
      expect(parsed.antiPatterns).toHaveLength(2);
      expect(parsed.optimizations).toHaveLength(1);
      expect(parsed.skillSuggestions).toHaveLength(2);
      expect(parsed.skillSuggestions[0].name).toBe('config-review');
    });

    it('handles empty output', () => {
      const parsed = parseReflectionOutput('');
      expect(parsed.successPatterns).toHaveLength(0);
      expect(parsed.antiPatterns).toHaveLength(0);
    });

    it('handles partial output', () => {
      const output = '## Anti-Patterns\n- Something bad\n- Another bad thing';
      const parsed = parseReflectionOutput(output);
      expect(parsed.antiPatterns).toHaveLength(2);
      expect(parsed.successPatterns).toHaveLength(0);
    });

    it('handles skill suggestions without colons', () => {
      const output = '## Skill Suggestions\n- A new skill idea';
      const parsed = parseReflectionOutput(output);
      expect(parsed.skillSuggestions).toHaveLength(1);
      expect(parsed.skillSuggestions[0].name).toBe('A new skill idea');
    });
  });
});

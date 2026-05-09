import { describe, it, expect } from 'bun:test';
import { CronScheduler, parseInterval } from '../../../storage/cronScheduler';

describe('CronScheduler', () => {
  describe('parseInterval', () => {
    it('parses simple intervals', () => {
      expect(parseInterval('1m')).toBe(60_000);
      expect(parseInterval('5m')).toBe(300_000);
      expect(parseInterval('1h')).toBe(3_600_000);
      expect(parseInterval('1d')).toBe(86_400_000);
    });

    it('parses named intervals', () => {
      expect(parseInterval('daily')).toBe(86_400_000);
      expect(parseInterval('hourly')).toBe(3_600_000);
    });

    it('parses numeric intervals', () => {
      expect(parseInterval('30m')).toBe(1_800_000);
      expect(parseInterval('6h')).toBe(21_600_000);
      expect(parseInterval('2d')).toBe(172_800_000);
    });

    it('defaults to 1 day for unknown schedules', () => {
      expect(parseInterval('0 2 * * *')).toBe(86_400_000);
      expect(parseInterval('unknown')).toBe(86_400_000);
    });
  });

  describe('start/stop', () => {
    it('can start and stop without error', () => {
      const scheduler = new CronScheduler({
        cwd: '/tmp',
        parentContext: {
          cwd: '/tmp',
          abortController: new AbortController(),
          messages: [],
          getAppState: () => ({ permissionContext: { mode: 'default' as const, allowRules: [], denyRules: [], askRules: [] }, messages: [], tasks: {} }),
          setAppState: () => {},
        },
        intervalMs: 1000,
      });

      scheduler.start();
      scheduler.stop();
    });
  });
});

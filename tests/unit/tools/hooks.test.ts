import { describe, it, expect, beforeEach } from 'bun:test';
import {
  registerHooks,
  clearHooks,
  getRegisteredHooks,
  executeBeforeHooks,
  executeAfterHooks,
  type HookContext,
  type BeforeHookResult,
  type AfterHookResult,
} from '../../../tools/hooks';

function makeHookCtx(overrides?: Partial<HookContext>): HookContext {
  return {
    toolName: 'TestTool',
    input: { path: '/test/file.txt' },
    context: {} as any,
    sessionId: 'sess-1',
    toolUseId: 'use-1',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('Hook System', () => {
  beforeEach(() => {
    clearHooks();
  });

  describe('registerHooks / getRegisteredHooks', () => {
    it('starts with no hooks', () => {
      const hooks = getRegisteredHooks();
      expect(hooks.beforeToolCall).toBeUndefined();
      expect(hooks.afterToolCall).toBeUndefined();
    });

    it('registers beforeToolCall hook', () => {
      const fn = async () => ({ proceed: true });
      registerHooks({ beforeToolCall: fn });
      expect(getRegisteredHooks().beforeToolCall).toBe(fn);
    });

    it('registers afterToolCall hook', () => {
      const fn = async () => ({});
      registerHooks({ afterToolCall: fn });
      expect(getRegisteredHooks().afterToolCall).toBe(fn);
    });

    it('merges hooks on multiple registrations', () => {
      const fn1 = async () => ({ proceed: true });
      const fn2 = async () => ({});
      registerHooks({ beforeToolCall: fn1 });
      registerHooks({ afterToolCall: fn2 });
      expect(getRegisteredHooks().beforeToolCall).toBe(fn1);
      expect(getRegisteredHooks().afterToolCall).toBe(fn2);
    });
  });

  describe('clearHooks', () => {
    it('removes all registered hooks', () => {
      registerHooks({
        beforeToolCall: async () => ({ proceed: true }),
        afterToolCall: async () => ({}),
      });
      clearHooks();
      expect(getRegisteredHooks().beforeToolCall).toBeUndefined();
      expect(getRegisteredHooks().afterToolCall).toBeUndefined();
    });
  });

  describe('executeBeforeHooks', () => {
    it('returns proceed=true when no hooks registered', async () => {
      const result = await executeBeforeHooks(makeHookCtx());
      expect(result.proceed).toBe(true);
    });

    it('calls registered hook with context', async () => {
      let receivedCtx: HookContext | null = null;
      registerHooks({
        beforeToolCall: async (ctx) => {
          receivedCtx = ctx;
          return { proceed: true };
        },
      });

      const ctx = makeHookCtx({ toolName: 'Shell' });
      await executeBeforeHooks(ctx);
      expect(receivedCtx).not.toBeNull();
      expect(receivedCtx!.toolName).toBe('Shell');
    });

    it('can block execution', async () => {
      registerHooks({
        beforeToolCall: async () => ({ proceed: false, reason: 'blocked' }),
      });

      const result = await executeBeforeHooks(makeHookCtx());
      expect(result.proceed).toBe(false);
      expect(result.reason).toBe('blocked');
    });

    it('can modify input', async () => {
      registerHooks({
        beforeToolCall: async () => ({
          proceed: true,
          modifiedInput: { path: '/modified/path.txt' },
        }),
      });

      const result = await executeBeforeHooks(makeHookCtx());
      expect(result.modifiedInput).toEqual({ path: '/modified/path.txt' });
    });

    it('returns proceed=true on hook error (does not block)', async () => {
      registerHooks({
        beforeToolCall: async () => { throw new Error('hook crash'); },
      });

      const result = await executeBeforeHooks(makeHookCtx());
      expect(result.proceed).toBe(true);
    });
  });

  describe('executeAfterHooks', () => {
    it('returns empty result when no hooks registered', async () => {
      const result = await executeAfterHooks(makeHookCtx(), { data: 'ok' });
      expect(result.replaceResult).toBeUndefined();
    });

    it('calls registered hook with context and result', async () => {
      let receivedResult: unknown = null;
      registerHooks({
        afterToolCall: async (_ctx, result) => {
          receivedResult = result;
          return {};
        },
      });

      await executeAfterHooks(makeHookCtx(), { data: 'test-result' });
      expect(receivedResult).toEqual({ data: 'test-result' });
    });

    it('calls hook with error when tool fails', async () => {
      let receivedError: Error | undefined;
      registerHooks({
        afterToolCall: async (_ctx, _result, error) => {
          receivedError = error;
          return {};
        },
      });

      const error = new Error('tool failed');
      await executeAfterHooks(makeHookCtx(), undefined, error);
      expect(receivedError).toBe(error);
    });

    it('can replace result', async () => {
      registerHooks({
        afterToolCall: async () => ({
          replaceResult: true,
          newResult: { replaced: true },
        }),
      });

      const result = await executeAfterHooks(makeHookCtx(), { original: true });
      expect(result.replaceResult).toBe(true);
      expect(result.newResult).toEqual({ replaced: true });
    });

    it('returns empty on hook error (does not modify result)', async () => {
      registerHooks({
        afterToolCall: async () => { throw new Error('hook crash'); },
      });

      const result = await executeAfterHooks(makeHookCtx(), { data: 'ok' });
      expect(result.replaceResult).toBeUndefined();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { registerKnowledgeHook, resetKnowledgeHookCounters } from '../../../tools/knowledgeHook';
import { clearHooks, executeAfterHooks, type HookContext } from '../../../tools/hooks';
import { loadKnowledgeStore } from '../../../storage/knowledge';

function makeHookCtx(overrides?: Partial<HookContext>): HookContext {
  return {
    toolName: 'TestTool',
    input: { path: '/test' },
    context: {} as any,
    sessionId: 'sess-1',
    toolUseId: 'use-1',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('Knowledge Extraction Hook', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-hook-test-'));
    clearHooks();
    resetKnowledgeHookCounters();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    clearHooks();
  });

  describe('Error pattern extraction', () => {
    it('records anti-pattern for ENOENT errors', async () => {
      registerKnowledgeHook(tempDir);
      const error = new Error('ENOENT: no such file or directory, open \'/missing.txt\'');

      await executeAfterHooks(makeHookCtx({ toolName: 'Read' }), undefined, error);

      const store = await loadKnowledgeStore(tempDir);
      const entry = store.entries.find((e) => e.content.includes('File not found'));
      expect(entry).toBeDefined();
      expect(entry!.category).toBe('anti_pattern');
      expect(entry!.tags).toContain('read');
    });

    it('records anti-pattern for timeout errors', async () => {
      registerKnowledgeHook(tempDir);
      const error = new Error('Connection timeout after 30s');

      await executeAfterHooks(makeHookCtx({ toolName: 'GrpcClient' }), undefined, error);

      const store = await loadKnowledgeStore(tempDir);
      const entry = store.entries.find((e) => e.content.includes('Timeout'));
      expect(entry).toBeDefined();
    });

    it('records anti-pattern for gRPC failures', async () => {
      registerKnowledgeHook(tempDir);
      const error = new Error('gRPC call failed: UNAVAILABLE');

      await executeAfterHooks(makeHookCtx({ toolName: 'GrpcClient' }), undefined, error);

      const store = await loadKnowledgeStore(tempDir);
      const entry = store.entries.find((e) => e.content.includes('gRPC'));
      expect(entry).toBeDefined();
    });

    it('does not record knowledge for unknown error patterns', async () => {
      registerKnowledgeHook(tempDir);
      const error = new Error('Some unknown error');

      await executeAfterHooks(makeHookCtx(), undefined, error);

      const store = await loadKnowledgeStore(tempDir);
      expect(store.entries).toHaveLength(0);
    });

    it('records recurring errors after 3 failures', async () => {
      registerKnowledgeHook(tempDir);
      const error = new Error('Some recurring error');

      // Trigger 3 errors
      for (let i = 0; i < 3; i++) {
        await executeAfterHooks(makeHookCtx({ toolName: 'Shell' }), undefined, error);
      }

      const store = await loadKnowledgeStore(tempDir);
      const entry = store.entries.find((e) => e.content.includes('failed 3 times'));
      expect(entry).toBeDefined();
      expect(entry!.category).toBe('anti_pattern');
    });
  });

  describe('Success tracking', () => {
    it('records efficiency pattern after 15 uses', async () => {
      registerKnowledgeHook(tempDir);

      // Trigger 15 successful calls
      for (let i = 0; i < 15; i++) {
        await executeAfterHooks(makeHookCtx({ toolName: 'Read' }), { content: 'ok' });
      }

      const store = await loadKnowledgeStore(tempDir);
      const entry = store.entries.find((e) => e.content.includes('15+ times'));
      expect(entry).toBeDefined();
      expect(entry!.category).toBe('pattern');
    });

    it('does not record before 15 uses', async () => {
      registerKnowledgeHook(tempDir);

      for (let i = 0; i < 14; i++) {
        await executeAfterHooks(makeHookCtx({ toolName: 'Read' }), { content: 'ok' });
      }

      const store = await loadKnowledgeStore(tempDir);
      expect(store.entries).toHaveLength(0);
    });
  });

  describe('Hook error resilience', () => {
    it('does not throw on knowledge save failure', async () => {
      // Use a non-existent directory to trigger save failure
      registerKnowledgeHook('/nonexistent/path/that/should/not/exist');
      const error = new Error('ENOENT: no such file');

      // Should not throw
      await expect(
        executeAfterHooks(makeHookCtx(), undefined, error),
      ).resolves.toBeDefined();
    });
  });
});

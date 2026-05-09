import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { runAgent, type RunAgentParams } from '../../../../tools/agent/runAgent';
import { createInitialAppState } from '../../../../runtime/state';
import type { ToolUseContext } from '../../../../tools/Tool';

function createMockContext(): ToolUseContext {
  return {
    cwd: '/tmp/test',
    abortController: new AbortController(),
    messages: [],
    getAppState: () => createInitialAppState(),
    setAppState: () => {},
  };
}

describe('runAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No LLM configured', () => {
    it('returns no-LLM message when LLM is not configured', async () => {
      const params: RunAgentParams = {
        description: 'Test task',
        prompt: 'Do something',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);

      expect(result).toContain('No LLM configured');
    });

    it('includes agent name in no-LLM response', async () => {
      const params: RunAgentParams = {
        description: 'Test task',
        prompt: 'Do something',
        subagentType: 'explore',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);

      expect(result).toContain('explore');
    });

    it('includes description in no-LLM response', async () => {
      const params: RunAgentParams = {
        description: 'My custom task',
        prompt: 'Do something',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);

      expect(result).toContain('My custom task');
    });

    it('includes prompt length in no-LLM response', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Hello World'.repeat(10),
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);

      expect(result).toContain('110 characters');
    });

    it('defaults to general-purpose when no subagentType', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);

      expect(result).toContain('general-purpose');
    });
  });

  describe('Parameter handling', () => {
    it('accepts custom maxTurns', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        parentContext: createMockContext(),
        maxTurns: 3,
      };

      const result = await runAgent(params);
      expect(typeof result).toBe('string');
    });

    it('accepts custom canUseTool function', async () => {
      const customCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' });
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        parentContext: createMockContext(),
        canUseTool: customCanUseTool as any,
      };

      const result = await runAgent(params);
      expect(typeof result).toBe('string');
    });

    it('accepts onProgress callback', async () => {
      const onProgress = vi.fn();
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        parentContext: createMockContext(),
        onProgress,
      };

      const result = await runAgent(params);
      expect(typeof result).toBe('string');
    });

    it('handles empty subagentType (defaults to general-purpose)', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: '',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);
      expect(result).toContain('general-purpose');
    });

    it('handles unknown subagentType (defaults to general-purpose)', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'unknown-type',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);
      expect(result).toContain('general-purpose');
    });

    it('handles known subagentType explore', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'explore',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);
      expect(result).toContain('explore');
    });

    it('handles known subagentType plan', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'plan',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);
      expect(result).toContain('plan');
    });
  });

  describe('Context isolation', () => {
    it('creates subagent context with correct agentType', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'explore',
        parentContext: createMockContext(),
      };

      const result = await runAgent(params);
      expect(typeof result).toBe('string');
    });

    it('does not modify parent context', async () => {
      const parentContext = createMockContext();
      const originalMessages = [...parentContext.messages];

      await runAgent({
        description: 'Test',
        prompt: 'Test',
        parentContext,
      });

      expect(parentContext.messages).toEqual(originalMessages);
    });
  });

  describe('Concurrent calls', () => {
    it('handles multiple concurrent calls independently', async () => {
      const promises = [1, 2, 3].map((i) =>
        runAgent({
          description: `Task ${i}`,
          prompt: `Prompt ${i}`,
          subagentType: `type${i}`,
          parentContext: createMockContext(),
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toContain('Task 1');
      expect(results[1]).toContain('Task 2');
      expect(results[2]).toContain('Task 3');
    });
  });

  describe('Edge cases', () => {
    it('handles very long description', async () => {
      const longDesc = 'x'.repeat(10000);
      const result = await runAgent({
        description: longDesc,
        prompt: 'Test',
        parentContext: createMockContext(),
      });
      expect(typeof result).toBe('string');
    });

    it('handles very long prompt', async () => {
      const longPrompt = 'y'.repeat(50000);
      const result = await runAgent({
        description: 'Test',
        prompt: longPrompt,
        parentContext: createMockContext(),
      });
      expect(typeof result).toBe('string');
    });

    it('handles unicode in description and prompt', async () => {
      const result = await runAgent({
        description: '任务描述 - 代码审查',
        prompt: 'レビューしてください',
        parentContext: createMockContext(),
      });
      expect(typeof result).toBe('string');
    });
  });
});

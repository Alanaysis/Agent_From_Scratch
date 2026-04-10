import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { runAgent, type RunAgentParams } from '../../../../tools/agent/runAgent';

describe('runAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('returns subagent accepted message with default type', async () => {
      const params: RunAgentParams = {
        description: 'Test task',
        prompt: 'Do something',
      };

      const result = await runAgent(params);

      expect(result).toContain('Subagent "general-purpose"');
      expect(result).toContain('Description: Test task');
    });

    it('includes custom subagent type when provided', async () => {
      const params: RunAgentParams = {
        description: 'Code review task',
        prompt: 'Review this code',
        subagentType: 'code-reviewer',
      };

      const result = await runAgent(params);

      expect(result).toContain('Subagent "code-reviewer"');
    });

    it('includes prompt length in response', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Hello World'.repeat(10), // 110 characters (no spaces between repeats)
      };

      const result = await runAgent(params);

      expect(result).toContain('Prompt length: 110 characters');
    });

    it('includes educational runtime message', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
      };

      const result = await runAgent(params);

      expect(result).toContain('This educational runtime does not call a model yet');
    });
  });

  describe('Empty and Edge Case Inputs', () => {
    it('handles empty description', async () => {
      const params: RunAgentParams = {
        description: '',
        prompt: 'Test prompt',
      };

      const result = await runAgent(params);

      expect(result).toContain('Description: ');
    });

    it('handles empty prompt', async () => {
      const params: RunAgentParams = {
        description: 'Test description',
        prompt: '',
      };

      const result = await runAgent(params);

      expect(result).toContain('Prompt length: 0 characters');
    });

    it('handles very long description', async () => {
      const longDesc = 'x'.repeat(10000);
      const params: RunAgentParams = {
        description: longDesc,
        prompt: 'Test',
      };

      const result = await runAgent(params);

      expect(result).toContain('Description: ' + longDesc);
    });

    it('handles very long prompt', async () => {
      const longPrompt = 'y'.repeat(50000);
      const params: RunAgentParams = {
        description: 'Test',
        prompt: longPrompt,
      };

      const result = await runAgent(params);

      expect(result).toContain('Prompt length: 50000 characters');
    });

    it('handles multiline prompt', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Line 1\nLine 2\nLine 3',
      };

      const result = await runAgent(params);

      expect(result).toContain('Prompt length: 20 characters');
    });

    it('handles unicode in description and prompt', async () => {
      const params: RunAgentParams = {
        description: '任务描述 - 代码审查',
        prompt: 'レビューしてください',
      };

      const result = await runAgent(params);

      expect(result).toContain('Description: 任务描述 - 代码审查');
      expect(result).toContain('Prompt length: 10 characters');
    });

    it('handles special characters in prompt', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: '<script>alert("xss")</script> & <test>',
      };

      const result = await runAgent(params);

      expect(result).toContain('Prompt length: 38 characters');
    });
  });

  describe('Subagent Type Variations', () => {
    it('handles single-word subagent type', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'researcher',
      };

      const result = await runAgent(params);

      expect(result).toContain('Subagent "researcher"');
    });

    it('handles hyphenated subagent type', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'code-reviewer',
      };

      const result = await runAgent(params);

      expect(result).toContain('Subagent "code-reviewer"');
    });

    it('handles underscore in subagent type', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'data_analyst',
      };

      const result = await runAgent(params);

      expect(result).toContain('Subagent "data_analyst"');
    });

    it('handles camelCase subagent type', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'codeReviewer',
      };

      const result = await runAgent(params);

      expect(result).toContain('Subagent "codeReviewer"');
    });

    it('handles empty string as subagent type (keeps empty string)', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: '',
      };

      const result = await runAgent(params);

      // Empty string is passed through as-is
      expect(result).toContain('Subagent ""');
    });
  });

  describe('Response Structure', () => {
    it('returns response with four lines', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
      };

      const result = await runAgent(params);

      const lines = result.split('\n');
      expect(lines).toHaveLength(4);
    });

    it('first line contains subagent type and accepted message', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
        subagentType: 'tester',
      };

      const result = await runAgent(params);
      const firstLine = result.split('\n')[0];

      expect(firstLine).toContain('Subagent');
      expect(firstLine).toContain('"tester"');
      expect(firstLine).toContain('accepted');
    });

    it('second line contains description', async () => {
      const params: RunAgentParams = {
        description: 'My task description',
        prompt: 'Test',
      };

      const result = await runAgent(params);
      const lines = result.split('\n');

      expect(lines[1]).toContain('Description: My task description');
    });

    it('third line contains prompt length', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Hello'.repeat(5), // 20 chars including spaces if any
      };

      const result = await runAgent(params);
      const lines = result.split('\n');

      expect(lines[2]).toMatch(/Prompt length: \d+ characters/);
    });

    it('fourth line contains educational runtime message', async () => {
      const params: RunAgentParams = {
        description: 'Test',
        prompt: 'Test',
      };

      const result = await runAgent(params);
      const lines = result.split('\n');

      expect(lines[3]).toContain('educational runtime');
    });
  });

  describe('Concurrent Calls', () => {
    it('handles multiple concurrent calls independently', async () => {
      const promises = [1, 2, 3].map((i) =>
        runAgent({
          description: `Task ${i}`,
          prompt: `Prompt ${i}`,
          subagentType: `type${i}`,
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toContain('Task 1');
      expect(results[1]).toContain('Task 2');
      expect(results[2]).toContain('Task 3');
    });

    it('each call produces independent results', async () => {
      const results = await Promise.all([
        runAgent({ description: 'A', prompt: 'a', subagentType: 'x' }),
        runAgent({ description: 'B', prompt: 'b', subagentType: 'y' }),
        runAgent({ description: 'C', prompt: 'c', subagentType: 'z' }),
      ]);

      expect(results[0]).not.toContain('B');
      expect(results[1]).not.toContain('A');
    });
  });
});

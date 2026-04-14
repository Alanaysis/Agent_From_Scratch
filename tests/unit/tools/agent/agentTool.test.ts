import { describe, it, expect, beforeEach, vi } from 'bun:test';
import type { ToolUseContext, CanUseToolFn, AssistantMessage } from '../../../../runtime/messages';
import { AgentTool, type AgentInput } from '../../../../tools/agent/agentTool';
import { runAgent } from '../../../../tools/agent/runAgent';
import { createSubagentContext } from '../../../../tools/agent/subagentContext';

vi.mock('../../../../tools/agent/runAgent', () => ({
  runAgent: vi.fn(),
}));

vi.mock('../../../../tools/agent/subagentContext', () => ({
  createSubagentContext: vi.fn(),
}));

describe('AgentTool - Tool definition and validation', () => {
  it('has correct tool properties', () => {
    expect(AgentTool.name).toBe('Agent');
    expect(AgentTool.isReadOnly()).toBe(false);
    expect(AgentTool.isConcurrencySafe()).toBe(false);
  });

  it('description returns subagent launch description', async () => {
    const desc = await AgentTool.description();
    expect(desc).toBe('Launch a subagent');
  });

  it('inputSchema and outputSchema are null for dynamic schema', () => {
    expect(AgentTool.inputSchema).toBeNull();
    expect(AgentTool.outputSchema).toBeNull();
  });
});

describe('AgentTool - validateInput', () => {
  const createValidInput = (overrides?: Partial<AgentInput>): AgentInput => ({
    description: 'Test agent task',
    prompt: 'Please help me with this task',
    subagentType: 'default',
    ...overrides,
  });

  it('accepts valid input with required fields', async () => {
    const result = await AgentTool.validateInput(createValidInput());
    expect(result).toEqual({ result: true });
  });

  it('rejects empty description', async () => {
    const result = await AgentTool.validateInput({
      description: '',
      prompt: 'test prompt',
    } as AgentInput);
    expect(result.result).toBe(false);
    expect(result.message).toContain('Description is required');
  });

  it('rejects whitespace-only description', async () => {
    const result = await AgentTool.validateInput({
      description: '   ',
      prompt: 'test prompt',
    } as AgentInput);
    expect(result.result).toBe(false);
  });

  it('rejects empty prompt', async () => {
    const result = await AgentTool.validateInput({
      description: 'test description',
      prompt: '',
    } as AgentInput);
    expect(result.result).toBe(false);
    expect(result.message).toContain('Prompt is required');
  });

  it('rejects whitespace-only prompt', async () => {
    const result = await AgentTool.validateInput({
      description: 'test description',
      prompt: '   ',
    } as AgentInput);
    expect(result.result).toBe(false);
  });

  it('accepts input with subagentType override', async () => {
    const result = await AgentTool.validateInput(createValidInput({
      subagentType: 'researcher',
    }));
    expect(result).toEqual({ result: true });
  });

  it('handles unicode characters in description and prompt', async () => {
    const input: AgentInput = {
      description: '分析中文文档内容',
      prompt: '请帮助我处理这个任务，谢谢',
    };
    const result = await AgentTool.validateInput(input);
    expect(result).toEqual({ result: true });
  });

  it('handles special characters in input', async () => {
    const input: AgentInput = {
      description: 'Task with "quotes" and \'apostrophes\' & symbols!',
      prompt: 'Prompt with <html> tags and $variable$',
    };
    const result = await AgentTool.validateInput(input);
    expect(result).toEqual({ result: true });
  });

  it('handles very long description', async () => {
    const input: AgentInput = {
      description: 'x'.repeat(10000),
      prompt: 'test prompt',
    };
    const result = await AgentTool.validateInput(input);
    expect(result).toEqual({ result: true });
  });

  it('handles very long prompt', async () => {
    const input: AgentInput = {
      description: 'test description',
      prompt: 'x'.repeat(50000),
    };
    const result = await AgentTool.validateInput(input);
    expect(result).toEqual({ result: true });
  });

  it('handles multiline inputs', async () => {
    const input: AgentInput = {
      description: 'Task with\nmultiple\nlines',
      prompt: 'Prompt with\nseveral\nparagraphs',
    };
    const result = await AgentTool.validateInput(input);
    expect(result).toEqual({ result: true });
  });

  it('handles null-like values in subagentType', async () => {
    const input: AgentInput = {
      description: 'test description',
      prompt: 'test prompt',
      subagentType: undefined as any,
    };
    const result = await AgentTool.validateInput(input);
    expect(result).toEqual({ result: true });
  });

  it('handles empty string subagentType', async () => {
    const input: AgentInput = {
      description: 'test description',
      prompt: 'test prompt',
      subagentType: '',
    };
    const result = await AgentTool.validateInput(input);
    expect(result).toEqual({ result: true });
  });
});

describe('AgentTool - checkPermissions', () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ask behavior in default mode', async () => {
    const input: AgentInput = {
      description: 'Research task',
      prompt: 'Please analyze this',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'default' as const,
          allowRules: [],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('ask');
    expect(result.message).toContain('Agent launch requires confirmation');
    expect(result.message).toContain('Research task');
  });

  it('returns allow behavior in bypassPermissions mode', async () => {
    const input: AgentInput = {
      description: 'Quick task',
      prompt: 'Do this now',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'bypassPermissions' as const,
          allowRules: [],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('allow');
  });

  it('returns allow behavior in acceptEdits mode', async () => {
    const input: AgentInput = {
      description: 'Edit task',
      prompt: 'Make changes',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'acceptEdits' as const,
          allowRules: [],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('allow');
  });

  it('includes updatedInput in allow response', async () => {
    const input: AgentInput = {
      description: 'Test task',
      prompt: 'Test prompt',
      subagentType: 'custom',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'bypassPermissions' as const,
          allowRules: [],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('allow');
    if (result.updatedInput) {
      expect(result.updatedInput.description).toBe('Test task');
      expect(result.updatedInput.prompt).toBe('Test prompt');
    }
  });

  it('handles empty description in permission check', async () => {
    const input: AgentInput = {
      description: '',
      prompt: 'test prompt',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'default' as const,
          allowRules: [],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('ask');
  });

  it('handles unicode in description for permission check', async () => {
    const input: AgentInput = {
      description: '中文任务描述',
      prompt: '测试提示',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'default' as const,
          allowRules: [],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('ask');
  });

  it('handles special characters in description for permission check', async () => {
    const input: AgentInput = {
      description: 'Task with "special" & <chars>!',
      prompt: 'test',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'default' as const,
          allowRules: [],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('ask');
  });

  it('works with allowRules present', async () => {
    const input: AgentInput = {
      description: 'Test task',
      prompt: 'test prompt',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'default' as const,
          allowRules: ['ReadTool'],
          denyRules: [],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('ask'); // Agent tool not in allow rules, still asks
  });

  it('works with denyRules present', async () => {
    const input: AgentInput = {
      description: 'Test task',
      prompt: 'test prompt',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'default' as const,
          allowRules: [],
          denyRules: ['WriteTool'],
          askRules: [],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('ask'); // Not denied, but still asks in default mode
  });

  it('works with askRules present', async () => {
    const input: AgentInput = {
      description: 'Test task',
      prompt: 'test prompt',
    };

    mockContext = {
      getAppState: () => ({
        permissionContext: {
          mode: 'default' as const,
          allowRules: [],
          denyRules: [],
          askRules: ['*'],
        },
      }),
    };

    const result = await AgentTool.checkPermissions(input, mockContext);
    expect(result.behavior).toBe('ask'); // Already asks in default mode
  });
});

describe('AgentTool - call', () => {
  let mockContext: any;
  let mockCanUseTool: CanUseToolFn;
  let mockParentMessage: AssistantMessage;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createSubagentContext with correct params', async () => {
    const input: AgentInput = {
      description: 'Test task',
      prompt: 'test prompt',
      subagentType: 'researcher',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    (runAgent as any).mockResolvedValue('Subagent completed the task successfully.');

    const result = await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(createSubagentContext).toHaveBeenCalledWith(mockContext, {
      agentType: 'researcher',
    });
  });

  it('calls runAgent with correct params', async () => {
    const input: AgentInput = {
      description: 'Research task',
      prompt: 'Analyze this data thoroughly',
      subagentType: 'analyst',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    const expectedResult = 'Analysis complete. Found 3 key insights.';
    (runAgent as any).mockResolvedValue(expectedResult);

    await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(runAgent).toHaveBeenCalledWith({
      description: 'Research task',
      prompt: 'Analyze this data thoroughly',
      subagentType: 'analyst',
    });
  });

  it('returns correct result structure on success', async () => {
    const input: AgentInput = {
      description: 'Test agent',
      prompt: 'do work',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    (runAgent as any).mockResolvedValue('Task completed.');

    const result = await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(result).toEqual({
      data: {
        status: 'completed',
        result: 'Task completed.',
      },
    });
  });

  it('handles empty subagentType in call', async () => {
    const input: AgentInput = {
      description: 'Default agent task',
      prompt: 'use default type',
      subagentType: '',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    (runAgent as any).mockResolvedValue('Done.');

    await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(createSubagentContext).toHaveBeenCalledWith(mockContext, {
      agentType: '',
    });
  });

  it('passes through unicode content', async () => {
    const input: AgentInput = {
      description: '中文任务',
      prompt: '分析这些文档内容',
      subagentType: 'translator',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    (runAgent as any).mockResolvedValue('翻译完成。');

    const result = await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(result.data.result).toBe('翻译完成。');
  });

  it('handles very long subagent response', async () => {
    const input: AgentInput = {
      description: 'Long report task',
      prompt: 'Generate a comprehensive report',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    const longResult = 'x'.repeat(50000);
    (runAgent as any).mockResolvedValue(longResult);

    const result = await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(result.data.result.length).toBe(50000);
  });

  it('handles multiline subagent response', async () => {
    const input: AgentInput = {
      description: 'Report task',
      prompt: 'write report',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    const multilineResult = 'Line 1\nLine 2\nLine 3';
    (runAgent as any).mockResolvedValue(multilineResult);

    const result = await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(result.data.result).toBe(multilineResult);
  });

  it('handles special characters in subagent response', async () => {
    const input: AgentInput = {
      description: 'Parse task',
      prompt: 'parse data',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    const specialResult = '<html><body>Data & more</body></html>';
    (runAgent as any).mockResolvedValue(specialResult);

    const result = await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(result.data.result).toBe(specialResult);
  });

  it('concurrent calls are independent', async () => {
    const input1: AgentInput = {
      description: 'Task A',
      prompt: 'do A',
      subagentType: 'typeA',
    };

    const input2: AgentInput = {
      description: 'Task B',
      prompt: 'do B',
      subagentType: 'typeB',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    (runAgent as any).mockImplementation((params: any) =>
      Promise.resolve(`Result for ${params.description}`),
    );

    const [result1, result2] = await Promise.all([
      AgentTool.call(input1, mockContext, mockCanUseTool, mockParentMessage),
      AgentTool.call(input2, mockContext, mockCanUseTool, mockParentMessage),
    ]);

    expect(result1.data.result).toBe('Result for Task A');
    expect(result2.data.result).toBe('Result for Task B');
  });

  it('call signature matches Tool interface', async () => {
    const input: AgentInput = {
      description: 'Test',
      prompt: 'test',
    };

    mockContext = {} as any;
    mockCanUseTool = vi.fn();
    mockParentMessage = { id: 'msg-1', type: 'assistant', content: [] } as AssistantMessage;

    (runAgent as any).mockResolvedValue('result');

    const result = await AgentTool.call(
      input,
      mockContext,
      mockCanUseTool,
      mockParentMessage,
    );

    expect(typeof result.data).toBe('object');
    if (result.data) {
      expect(result.data.status).toBe('completed');
      expect(typeof result.data.result).toBe('string');
    }
  });

  it('isConcurrencySafe returns false for Agent tool', async () => {
    expect(AgentTool.isConcurrencySafe()).toBe(false);
  });

  it('isReadOnly returns false for Agent tool', async () => {
    expect(AgentTool.isReadOnly()).toBe(false);
  });
});

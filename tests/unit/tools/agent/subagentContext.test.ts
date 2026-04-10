import { describe, it, expect, beforeEach, vi } from 'bun:test';
import type { ToolUseContext } from '../../../../runtime/messages';
import { createSubagentContext } from '../../../../tools/agent/subagentContext';

const createMockContext = (overrides?: Partial<ToolUseContext>): ToolUseContext => ({
  sessionId: 'session-123',
  messages: [{ id: 'msg-1', type: 'user' as const, content: 'test' }],
  agentId: 'agent-default',
  agentType: undefined,
  abortController: new AbortController(),
  setAppState: vi.fn(),
  cwd: '/tmp',
  ...overrides,
});

describe('createSubagentContext - basic functionality', () => {
  it('creates context with default values when no overrides provided', () => {
    const parent = createMockContext();
    const result = createSubagentContext(parent);

    expect(result.sessionId).toBe('session-123');
    expect(result.agentType).toBeUndefined();
    expect(typeof result.abortController).toBe('object');
  });

  it('preserves parent messages when no override provided', () => {
    const parent = createMockContext({
      messages: [{ id: 'msg-1', type: 'user' as const, content: 'original' }],
    });

    const result = createSubagentContext(parent);

    expect(result.messages).toBe(parent.messages);
  });

  it('creates new AbortController when shareAbortController is false', () => {
    const parent = createMockContext({
      abortController: new AbortController(),
    });

    const result = createSubagentContext(parent, {
      agentType: 'researcher',
      shareAbortController: false,
    });

    expect(result.abortController).not.toBe(parent.abortController);
  });

  it('shares parent AbortController when shareAbortController is true', () => {
    const parent = createMockContext({
      abortController: new AbortController(),
    });

    const result = createSubagentContext(parent, {
      agentType: 'researcher',
      shareAbortController: true,
    });

    expect(result.abortController).toBe(parent.abortController);
  });

  it('creates new setAppState when shareSetAppState is false', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: 'researcher',
      shareSetAppState: false,
    });

    expect(result.setAppState).not.toBe(parent.setAppState);
  });

  it('shares parent setAppState when shareSetAppState is true', () => {
    const mockSetAppState = vi.fn();
    const parent = createMockContext({ setAppState: mockSetAppState });

    const result = createSubagentContext(parent, {
      agentType: 'researcher',
      shareSetAppState: true,
    });

    expect(result.setAppState).toBe(mockSetAppState);
  });
});

describe('createSubagentContext - agentId handling', () => {
  it('uses provided agentId override', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentId: 'custom-agent-123',
    });

    expect(result.agentId).toBe('custom-agent-123');
  });

  it('uses parent agentId when no override provided', () => {
    const parent = createMockContext({
      agentId: 'parent-agent-456',
    });

    const result = createSubagentContext(parent);

    expect(result.agentId).toBe('parent-agent-456');
  });

  it('creates new agentId when neither override nor parent has one', () => {
    const parent = createMockContext({
      agentId: undefined,
    } as any);

    const result = createSubagentContext(parent);

    expect(result.agentId).toBeDefined();
    expect(typeof result.agentId).toBe('string');
  });

  it('override takes precedence over parent agentId', () => {
    const parent = createMockContext({
      agentId: 'parent-id',
    });

    const result = createSubagentContext(parent, {
      agentId: 'override-id',
    });

    expect(result.agentId).toBe('override-id');
  });
});

describe('createSubagentContext - agentType handling', () => {
  it('sets agentType from override', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: 'researcher',
    });

    expect(result.agentType).toBe('researcher');
  });

  it('leaves agentType undefined when no override provided', () => {
    const parent = createMockContext({
      agentType: 'original-type',
    });

    const result = createSubagentContext(parent);

    expect(result.agentType).toBeUndefined();
  });

  it('handles empty string agentType', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: '',
    });

    expect(result.agentType).toBe('');
  });

  it('handles various agentType formats', () => {
    const types = ['single', 'hyphenated-type', 'underscore_type', 'camelCase'];

    for (const type of types) {
      const result = createSubagentContext(createMockContext(), {
        agentType: type,
      });
      expect(result.agentType).toBe(type);
    }
  });
});

describe('createSubagentContext - messages override', () => {
  it('uses provided messages override', () => {
    const parent = createMockContext();
    const customMessages = [{ id: 'custom-1', type: 'user' as const, content: 'custom' }];

    const result = createSubagentContext(parent, {
      messages: customMessages,
    });

    expect(result.messages).toBe(customMessages);
  });

  it('preserves parent messages when override is undefined', () => {
    const parent = createMockContext({
      messages: [{ id: 'parent-1', type: 'user' as const, content: 'parent' }],
    });

    const result = createSubagentContext(parent, {
      messages: undefined,
    } as any);

    expect(result.messages).toBe(parent.messages);
  });

  it('allows empty messages array override', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      messages: [],
    });

    expect(result.messages).toEqual([]);
  });
});

describe('createSubagentContext - abortController behavior', () => {
  it('creates new AbortController by default', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: 'test',
    });

    expect(result.abortController).toBeDefined();
    expect(result.abortController!.signal.aborted).toBe(false);
  });

  it('uses provided abortController override', () => {
    const customController = new AbortController();
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: 'test',
      abortController: customController,
    });

    expect(result.abortController).toBe(customController);
  });

  it('shares controller when shareAbortController is true and no override provided', () => {
    const parent = createMockContext({
      abortController: new AbortController(),
    });

    const result = createSubagentContext(parent, {
      agentType: 'test',
      shareAbortController: true,
    });

    expect(result.abortController).toBe(parent.abortController);
  });

  it('override takes precedence over shareAbortController setting', () => {
    const customController = new AbortController();
    const parent = createMockContext({
      abortController: new AbortController(),
    });

    const result = createSubagentContext(parent, {
      agentType: 'test',
      abortController: customController,
      shareAbortController: true,
    });

    expect(result.abortController).toBe(customController);
  });
});

describe('createSubagentContext - setAppState behavior', () => {
  it('creates no-op function when shareSetAppState is false and no override provided', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: 'test',
      shareSetAppState: false,
    });

    expect(typeof result.setAppState).toBe('function');
  });

  it('shares parent setAppState when shareSetAppState is true', () => {
    const mockSetAppState = vi.fn();
    const parent = createMockContext({ setAppState: mockSetAppState });

    const result = createSubagentContext(parent, {
      agentType: 'test',
      shareSetAppState: true,
    });

    expect(result.setAppState).toBe(mockSetAppState);
  });

  it('no-op function when shareSetAppState is false', () => {
    const parent = createMockContext({ setAppState: vi.fn() });

    const result = createSubagentContext(parent, {
      agentType: 'test',
      shareSetAppState: false,
    });

    // Should be a no-op function, not the parent's implementation
    expect(result.setAppState).not.toBe(parent.setAppState);
  });
});

describe('createSubagentContext - context immutability', () => {
  it('does not modify parent context', () => {
    const parent = createMockContext({
      agentId: 'parent-id',
      agentType: 'original-type',
    });

    const result = createSubagentContext(parent, {
      agentId: 'child-id',
      agentType: 'child-type',
    });

    expect(parent.agentId).toBe('parent-id');
    expect(parent.agentType).toBe('original-type');
  });

  it('returns new object reference', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, { agentType: 'test' });

    expect(result).not.toBe(parent);
  });
});

describe('createSubagentContext - edge cases', () => {
  it('handles undefined overrides object', () => {
    const parent = createMockContext();
    const result = createSubagentContext(parent, undefined as any);

    expect(typeof result.abortController).toBe('object');
  });

  it('handles partial override with only agentType', () => {
    const parent = createMockContext({
      agentId: 'parent-id',
    });

    const result = createSubagentContext(parent, {
      agentType: 'test-type',
    });

    expect(result.agentId).toBe('parent-id');
    expect(result.agentType).toBe('test-type');
  });

  it('handles partial override with only messages', () => {
    const parent = createMockContext();
    const customMessages = [{ id: 'custom-1', type: 'user' as const, content: 'custom' }];

    const result = createSubagentContext(parent, {
      messages: customMessages,
    });

    expect(result.messages).toBe(customMessages);
  });

  it('handles all override fields at once', () => {
    const parent = createMockContext({
      agentId: 'parent-id',
      abortController: new AbortController(),
      setAppState: vi.fn(),
    });

    const customMessages = [{ id: 'custom-1', type: 'user' as const, content: 'custom' }];
    const customAbortController = new AbortController();

    const result = createSubagentContext(parent, {
      agentId: 'child-id',
      agentType: 'researcher',
      messages: customMessages,
      abortController: customAbortController,
      shareAbortController: false,
      shareSetAppState: true,
    });

    expect(result.agentId).toBe('child-id');
    expect(result.agentType).toBe('researcher');
    expect(result.messages).toBe(customMessages);
    expect(result.abortController).toBe(customAbortController);
  });

  it('handles unicode in agentType', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: '研究员-agent',
    });

    expect(result.agentType).toBe('研究员-agent');
  });

  it('handles very long agentType string', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, {
      agentType: 'x'.repeat(1000),
    });

    expect(result.agentType).toBe('x'.repeat(1000));
  });
});

describe('createSubagentContext - integration with ToolUseContext', () => {
  it('produces valid ToolUseContext object structure', () => {
    const parent = createMockContext();

    const result = createSubagentContext(parent, { agentType: 'test' });

    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('agentId');
    expect(result).toHaveProperty('abortController');
    expect(typeof result.setAppState).toBe('function');
  });

  it('maintains all required ToolUseContext properties', () => {
    const parent = createMockContext({
      cwd: '/custom/path',
    });

    const result = createSubagentContext(parent, { agentType: 'test' });

    expect(result.cwd).toBe('/custom/path');
  });

  it('preserves sessionId across context creation', () => {
    const parent = createMockContext({ sessionId: 'unique-session-xyz' });

    const result = createSubagentContext(parent, { agentType: 'test' });

    expect(result.sessionId).toBe('unique-session-xyz');
  });
});

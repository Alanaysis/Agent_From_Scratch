import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { canUseTool } from '../../../permissions/engine';
import type { ToolUseContext, PermissionDecision } from '../../../tools/Tool';

describe('Permission Engine', () => {
  const basePermissionContext = {
    mode: 'default' as const,
    allowRules: [],
    denyRules: [],
    askRules: [],
  };

  const mockContext: ToolUseContext = {
    cwd: '/tmp/test-dir',
    abortController: new AbortController(),
    messages: [],
    getAppState: vi.fn(() => ({ permissionContext: basePermissionContext })),
    setAppState: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mock ReadTool for testing
  const mockReadTool = {
    name: 'Read',
    isReadOnly: () => true,
    validateInput: async (input: unknown) => ({ result: true }),
  };

  // Mock WriteTool for testing
  const mockWriteTool = {
    name: 'Write',
    isReadOnly: () => false,
    validateInput: async (input: unknown) => ({ result: true }),
  };

  describe('bypassPermissions mode', () => {
    it('allows all tools in bypassPermissions mode', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'bypassPermissions' as const, allowRules: [], denyRules: [], askRules: [] } })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/test.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('allows read tools in bypassPermissions mode', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'bypassPermissions' as const, allowRules: [], denyRules: [], askRules: [] } })),
      };

      const result = await canUseTool(
        mockReadTool as any,
        { path: '/test.txt' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });
  });

  describe('acceptEdits mode', () => {
    it('allows all tools in acceptEdits mode', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'acceptEdits' as const, allowRules: [], denyRules: [], askRules: [] } })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/test.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });
  });

  describe('default mode - read-only tools', () => {
    it('allows read-only tools by default', async () => {
      const result = await canUseTool(
        mockReadTool as any,
        { path: '/test.txt' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });
  });

  describe('default mode - mutating tools', () => {
    it('asks for confirmation on mutating tools by default', async () => {
      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/test.txt', content: 'hello' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('ask');
    });
  });

  describe('input validation failures', () => {
    it('denies tools with invalid input', async () => {
      const toolWithValidation = {
        name: 'TestTool',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: false, message: 'Invalid input' }),
      };

      const result = await canUseTool(
        toolWithValidation as any,
        { invalid: true },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('deny');
      if (result.behavior === 'deny') {
        expect(result.message).toContain('Invalid input');
      }
    });
  });

  describe('deny rules', () => {
    it('denies tools matching deny rules (exact pattern match)', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default' as const,
            allowRules: [],
            denyRules: [{ toolName: 'Write', pattern: '/protected/file.txt' }],
            askRules: [],
          },
        })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/protected/file.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('deny');
    });

    it('allows tools not matching deny rules', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default' as const,
            allowRules: [],
            denyRules: [{ toolName: 'Write', pattern: '/protected/file.txt' }],
            askRules: [],
          },
        })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/tmp/file.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      // Should fall through to default ask behavior for mutating tools
      expect(result.behavior).toBe('ask');
    });
  });

  describe('allow rules', () => {
    it('allows tools matching allow rules (exact pattern match)', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default' as const,
            allowRules: [{ toolName: 'Write', pattern: '/allowed/file.txt' }],
            denyRules: [],
            askRules: [],
          },
        })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/allowed/file.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('asks for tools not matching allow rules', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default' as const,
            allowRules: [{ toolName: 'Write', pattern: '/allowed/file.txt' }],
            denyRules: [],
            askRules: [],
          },
        })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/tmp/file.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      // Should fall through to default behavior (ask for mutating tools)
      expect(result.behavior).toBe('ask');
    });
  });

  describe('ask rules', () => {
    it('asks for tools matching ask rules (exact pattern match)', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default' as const,
            allowRules: [],
            denyRules: [],
            askRules: [{ toolName: 'Write', pattern: '/review/file.txt' }],
          },
        })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/review/file.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('ask');
    });
  });

  describe('tool-specific permission checks', () => {
    it('uses tool.checkPermissions when available', async () => {
      const customTool = {
        name: 'CustomTool',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
        checkPermissions: async (_input: unknown, _context: ToolUseContext): Promise<PermissionDecision> => ({
          behavior: 'allow',
          message: 'Custom permission granted',
        }),
      };

      const result = await canUseTool(
        customTool as any,
        { data: 'test' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('allows tools with custom checkPermissions in default mode', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default' as const,
            allowRules: [],
            denyRules: [],
            askRules: []
          }
        })),
      };

      const customTool = {
        name: 'CustomTool',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
        checkPermissions: async (_input: unknown, _context: ToolUseContext): Promise<PermissionDecision> => ({
          behavior: 'allow',
        }),
      };

      const result = await canUseTool(
        customTool as any,
        { data: 'test' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });
  });

  describe('permission rule matching', () => {
    it('matches rules by exact tool name and pattern', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default',
            allowRules: [{ toolName: 'Write', pattern: '/specific/path.txt' }],
            denyRules: [],
            askRules: [],
          },
        })),
      };

      // Should match - exact path
      const result1 = await canUseTool(
        mockWriteTool as any,
        { path: '/specific/path.txt', content: 'hello' },
        context,
        null as any,
        ''
      );
      expect(result1.behavior).toBe('allow');

      // Should not match - different path
      const result2 = await canUseTool(
        mockWriteTool as any,
        { path: '/other/path.txt', content: 'hello' },
        context,
        null as any,
        ''
      );
      expect(result2.behavior).toBe('ask'); // Falls through to default behavior
    });

    it('matches rules by tool name only (no pattern)', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({
          permissionContext: {
            mode: 'default',
            allowRules: [{ toolName: 'Write' }], // No pattern - matches all Write operations
            denyRules: [],
            askRules: [],
          },
        })),
      };

      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/any/path.txt', content: 'hello' },
        context,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });
  });

  describe('updatedInput in responses', () => {
    it('includes updatedInput in allow behavior', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'bypassPermissions' } })),
      };

      const input = { path: '/test.txt', content: 'hello' };
      const result = await canUseTool(
        mockWriteTool as any,
        input,
        context,
        null as any,
        ''
      );

      if (result.behavior === 'allow') {
        expect(result.updatedInput).toBe(input);
      }
    });

    it('includes updatedInput in ask behavior', async () => {
      const result = await canUseTool(
        mockWriteTool as any,
        { path: '/test.txt', content: 'hello' },
        mockContext,
        null as any,
        ''
      );

      if (result.behavior === 'ask') {
        expect(result.updatedInput).toEqual({ path: '/test.txt', content: 'hello' });
      }
    });
  });

  describe('error handling in validation', () => {
    it('handles validation that returns false with message', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: false, message: 'Path required' }),
      };

      const result = await canUseTool(
        tool as any,
        {},
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('deny');
    });
  });
});

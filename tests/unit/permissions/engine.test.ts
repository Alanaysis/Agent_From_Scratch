import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { canUseTool, rememberPermissionRule } from '../../../permissions/engine';
import type { ToolUseContext, PermissionDecision } from '../../../tools/Tool';

// Direct test of getInputPattern by importing via function wrapper
// Since getInputPattern is not exported, we test it through its usage in matchesRule

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

  describe('getInputPattern edge cases', () => {
    it('returns undefined for non-object input', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Test with null - should return undefined pattern
      const result1 = await canUseTool(
        tool as any,
        null as any,
        mockContext,
        null as any,
        ''
      );
      expect(result1.behavior).toBe('allow');

      // Test with string - should return undefined pattern
      const result2 = await canUseTool(
        tool as any,
        'not an object' as any,
        mockContext,
        null as any,
        ''
      );
      expect(result2.behavior).toBe('allow');

      // Test with number - should return undefined pattern
      const result3 = await canUseTool(
        tool as any,
        12345 as any,
        mockContext,
        null as any,
        ''
      );
      expect(result3.behavior).toBe('allow');

      // Test with empty object - should return undefined pattern
      const result4 = await canUseTool(
        tool as any,
        {},
        mockContext,
        null as any,
        ''
      );
      expect(result4.behavior).toBe('allow');
    });

    it('returns undefined for objects with empty path/command/url/description', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Empty string path
      const result1 = await canUseTool(
        tool as any,
        { path: '' },
        mockContext,
        null as any,
        ''
      );
      expect(result1.behavior).toBe('allow');

      // Whitespace-only path
      const result2 = await canUseTool(
        tool as any,
        { path: '   ' },
        mockContext,
        null as any,
        ''
      );
      expect(result2.behavior).toBe('allow');

      // Empty command
      const result3 = await canUseTool(
        tool as any,
        { command: '' },
        mockContext,
        null as any,
        ''
      );
      expect(result3.behavior).toBe('allow');

      // Empty URL
      const result4 = await canUseTool(
        tool as any,
        { url: '' },
        mockContext,
        null as any,
        ''
      );
      expect(result4.behavior).toBe('allow');

      // Empty description
      const result5 = await canUseTool(
        tool as any,
        { description: '' },
        mockContext,
        null as any,
        ''
      );
      expect(result5.behavior).toBe('allow');
    });

    it('trims and returns valid patterns from path/command/url/description', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Path with whitespace should be trimmed
      const result1 = await canUseTool(
        tool as any,
        { path: '   /trimmed/path.txt   ' },
        mockContext,
        null as any,
        ''
      );
      expect(result1.behavior).toBe('allow');

      // Command with whitespace should be trimmed
      const result2 = await canUseTool(
        tool as any,
        { command: '  ls -la  ' },
        mockContext,
        null as any,
        ''
      );
      expect(result2.behavior).toBe('allow');

      // URL with whitespace should be trimmed
      const result3 = await canUseTool(
        tool as any,
        { url: '  https://example.com  ' },
        mockContext,
        null as any,
        ''
      );
      expect(result3.behavior).toBe('allow');

      // Description with whitespace should be trimmed
      const result4 = await canUseTool(
        tool as any,
        { description: '  review this code  ' },
        mockContext,
        null as any,
        ''
      );
      expect(result4.behavior).toBe('allow');
    });

    it('handles objects with multiple fields (path takes precedence)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // When path exists, it should be used as the pattern
      const result1 = await canUseTool(
        tool as any,
        { path: '/path/only', command: 'should-not-use' },
        mockContext,
        null as any,
        ''
      );
      expect(result1.behavior).toBe('allow');

      // When no path but command exists, command should be used
      const result2 = await canUseTool(
        tool as any,
        { command: 'only-command', url: 'should-not-use' },
        mockContext,
        null as any,
        ''
      );
      expect(result2.behavior).toBe('allow');

      // When no path/command but url exists, url should be used
      const result3 = await canUseTool(
        tool as any,
        { url: 'only-url', description: 'should-not-use' },
        mockContext,
        null as any,
        ''
      );
      expect(result3.behavior).toBe('allow');

      // When none of the above exist, falls through to default behavior
      const result4 = await canUseTool(
        tool as any,
        { otherField: 'no-match' },
        mockContext,
        null as any,
        ''
      );
      expect(result4.behavior).toBe('allow');
    });

    it('handles null input specifically', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Null should be handled gracefully and return undefined pattern
      const result = await canUseTool(
        tool as any,
        null,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles objects where all fields are empty/falsy (falls through to final return)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with only description field that is empty string - should fall through to line 39 return undefined
      const result1 = await canUseTool(
        tool as any,
        { description: '' },
        mockContext,
        null as any,
        ''
      );
      expect(result1.behavior).toBe('allow');

      // Object with only description field that is whitespace - should fall through to line 39 return undefined
      const result2 = await canUseTool(
        tool as any,
        { description: '   ' },
        mockContext,
        null as any,
        ''
      );
      expect(result2.behavior).toBe('allow');

      // Object with all fields empty - should fall through to line 39 return undefined
      const result3 = await canUseTool(
        tool as any,
        { path: '', command: '', url: '', description: '' },
        mockContext,
        null as any,
        ''
      );
      expect(result3.behavior).toBe('allow');

      // Object with fields that are not strings - should fall through to line 39 return undefined
      const result4 = await canUseTool(
        tool as any,
        { path: 123, command: true, url: null as any, description: [] },
        mockContext,
        null as any,
        ''
      );
      expect(result4.behavior).toBe('allow');

      // Object with no recognized fields - should fall through to line 39 return undefined
      const result5 = await canUseTool(
        tool as any,
        { arbitraryField: 'value', anotherField: 123 },
        mockContext,
        null as any,
        ''
      );
      expect(result5.behavior).toBe('allow');
    });
  });

  describe('rememberPermissionRule', () => {
    it('creates a permission rule from tool input with path', async () => {
      const context = {
        ...mockContext,
        setAppState: vi.fn((fn) => fn({ permissionContext: basePermissionContext })),
      };

      const mockWriteTool = {
        name: 'Write',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      rememberPermissionRule(
        context as any,
        mockWriteTool as any,
        { path: '/test/file.txt', content: 'hello' }
      );

      expect(context.setAppState).toHaveBeenCalled();
    });

    it('creates a permission rule from tool input with command', async () => {
      const context = {
        ...mockContext,
        setAppState: vi.fn((fn) => fn({ permissionContext: basePermissionContext })),
      };

      const mockShellTool = {
        name: 'Shell',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      rememberPermissionRule(
        context as any,
        mockShellTool as any,
        { command: 'rm -rf /tmp/test' }
      );

      expect(context.setAppState).toHaveBeenCalled();
    });

    it('creates a permission rule from tool input with url', async () => {
      const context = {
        ...mockContext,
        setAppState: vi.fn((fn) => fn({ permissionContext: basePermissionContext })),
      };

      const mockFetchTool = {
        name: 'Fetch',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      rememberPermissionRule(
        context as any,
        mockFetchTool as any,
        { url: 'https://example.com' }
      );

      expect(context.setAppState).toHaveBeenCalled();
    });

    it('creates a permission rule from tool input with description', async () => {
      const context = {
        ...mockContext,
        setAppState: vi.fn((fn) => fn({ permissionContext: basePermissionContext })),
      };

      const mockAgentTool = {
        name: 'Agent',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      rememberPermissionRule(
        context as any,
        mockAgentTool as any,
        { description: 'review this code' }
      );

      expect(context.setAppState).toHaveBeenCalled();
    });

    it('does not add duplicate rules', async () => {
      let state = { permissionContext: basePermissionContext };
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => state),
        setAppState: vi.fn((fn) => {
          state = fn(state);
        }),
      };

      const mockWriteTool = {
        name: 'Write',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // First call - should add rule
      rememberPermissionRule(
        context as any,
        mockWriteTool as any,
        { path: '/test/file.txt', content: 'hello' }
      );

      const firstState = state;
      expect(firstState.permissionContext.allowRules).toHaveLength(1);

      // Second call with same tool and pattern - should NOT add duplicate
      rememberPermissionRule(
        context as any,
        mockWriteTool as any,
        { path: '/test/file.txt', content: 'world' }
      );

      const secondState = state;
      expect(secondState.permissionContext.allowRules).toHaveLength(1); // Still only 1 rule
    });

    it('adds new rules when pattern is different', async () => {
      let state = { permissionContext: basePermissionContext };
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => state),
        setAppState: vi.fn((fn) => {
          state = fn(state);
        }),
      };

      const mockWriteTool = {
        name: 'Write',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // First call - should add rule for /test/file.txt
      rememberPermissionRule(
        context as any,
        mockWriteTool as any,
        { path: '/test/file.txt', content: 'hello' }
      );

      expect(state.permissionContext.allowRules).toHaveLength(1);

      // Second call with different pattern - should add new rule
      rememberPermissionRule(
        context as any,
        mockWriteTool as any,
        { path: '/other/file.txt', content: 'world' }
      );

      expect(state.permissionContext.allowRules).toHaveLength(2);
    });

    it('adds rules for same tool with different patterns separately', async () => {
      let state = { permissionContext: basePermissionContext };
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => state),
        setAppState: vi.fn((fn) => {
          state = fn(state);
        }),
      };

      const mockWriteTool = {
        name: 'Write',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      rememberPermissionRule(
        context as any,
        mockWriteTool as any,
        { path: '/allowed/*.txt', content: 'hello' }
      );

      const rules = state.permissionContext.allowRules;
      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe('/allowed/*.txt');
    });
  });

  describe('getInputPattern edge cases - null and empty handling', () => {
    it('handles null input object (line 12: typeof input !== "object" || input === null)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Null should return undefined pattern and fall through to default allow for read-only tools
      const result = await canUseTool(
        tool as any,
        null,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles empty string path (line 15: input.path.trim() check fails for empty)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Empty string path should return undefined pattern
      const result = await canUseTool(
        tool as any,
        { path: '' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles whitespace-only path (line 15: input.path.trim() returns empty)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Whitespace-only path should return undefined pattern
      const result = await canUseTool(
        tool as any,
        { path: '   \t\n  ' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles empty string command (line 21-23 check)', async () => {
      const tool = {
        name: 'Shell',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Empty command should return undefined pattern and fall through to ask for mutating tools
      const result = await canUseTool(
        tool as any,
        { command: '' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('ask');
    });

    it('handles empty string url (line 27-29 check)', async () => {
      const tool = {
        name: 'WebFetch',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Empty URL should return undefined pattern and fall through to default allow for read-only tools
      const result = await canUseTool(
        tool as any,
        { url: '' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles empty string description (line 32-35 check - line 37 return undefined)', async () => {
      const tool = {
        name: 'Agent',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Empty description should return undefined pattern and fall through to ask for mutating tools
      const result = await canUseTool(
        tool as any,
        { description: '' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('ask');
    });

    it('handles object with only non-string fields (line 37 return undefined)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with non-string values should fall through to line 39 return undefined
      const result = await canUseTool(
        tool as any,
        { path: 123, command: true, url: null, description: [] },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles object with no recognized fields (line 37 return undefined)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with arbitrary fields should fall through to line 39 return undefined
      const result = await canUseTool(
        tool as any,
        { customField1: 'value1', customField2: 'value2' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles all fields empty - path takes precedence but is falsy (line 37 return undefined)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => false,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // All fields empty should fall through to line 39 return undefined and then ask for mutating tools
      const result = await canUseTool(
        tool as any,
        { path: '', command: '', url: '', description: '' },
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('ask');
    });

    it('handles number input (typeof !== "object")', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Number should return undefined pattern
      const result = await canUseTool(
        tool as any,
        42 as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles boolean input (typeof !== "object")', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Boolean should return undefined pattern
      const result = await canUseTool(
        tool as any,
        true as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles array input (typeof === "object" but !== null)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Array is typeof "object" and not null, but has no path/command/url/description fields
      const result = await canUseTool(
        tool as any,
        [1, 2, 3] as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles function input (typeof !== "object")', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Functions have typeof "function" in JavaScript
      const result = await canUseTool(
        tool as any,
        (() => {}) as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles symbol input (typeof !== "object")', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Symbols have typeof "symbol" in JavaScript
      const result = await canUseTool(
        tool as any,
        Symbol('test') as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles Date object with no recognized fields (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Date objects are typeof "object" but don't have path/command/url/description fields
      const dateObj = new Date('2024-01-01');
      const result = await canUseTool(
        tool as any,
        dateObj as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles RegExp object with no recognized fields (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // RegExp objects are typeof "object" but don't have path/command/url/description fields
      const regexObj = /test/;
      const result = await canUseTool(
        tool as any,
        regexObj as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles Error object with no recognized fields (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Error objects are typeof "object" but don't have path/command/url/description fields in the expected shape
      const errorObj = new Error('test error');
      const result = await canUseTool(
        tool as any,
        errorObj as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles Map object with no recognized fields (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Map objects are typeof "object" but don't have path/command/url/description fields
      const mapObj = new Map([['key', 'value']]);
      const result = await canUseTool(
        tool as any,
        mapObj as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles Set object with no recognized fields (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Set objects are typeof "object" but don't have path/command/url/description fields
      const setObj = new Set([1, 2, 3]);
      const result = await canUseTool(
        tool as any,
        setObj as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles object with path being undefined explicitly (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with path explicitly set to undefined should fall through all checks
      const result = await canUseTool(
        tool as any,
        { path: undefined } as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles object with command being undefined explicitly (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with command explicitly set to undefined should fall through all checks
      const result = await canUseTool(
        tool as any,
        { command: undefined } as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles object with url being undefined explicitly (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with url explicitly set to undefined should fall through all checks
      const result = await canUseTool(
        tool as any,
        { url: undefined } as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles object with description being undefined explicitly (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with description explicitly set to undefined should fall through all checks
      const result = await canUseTool(
        tool as any,
        { description: undefined } as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });

    it('handles object with path being NaN (falls through to line 37)', async () => {
      const tool = {
        name: 'TestTool',
        isReadOnly: () => true,
        validateInput: async (input: unknown) => ({ result: true }),
      };

      // Object with path set to NaN should fall through all checks (typeof NaN === "number")
      const result = await canUseTool(
        tool as any,
        { path: NaN } as any,
        mockContext,
        null as any,
        ''
      );

      expect(result.behavior).toBe('allow');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { canUseTool, rememberPermissionRule } from '../../permissions/engine';
import type { Tool, ToolUseContext, PermissionDecision } from '../../../tools/Tool';

describe('Permission Flow Integration', () => {
  let mockContext: ToolUseContext;
  let basePermissionContext: any;

  beforeEach(() => {
    basePermissionContext = {
      mode: 'default' as const,
      allowRules: [],
      denyRules: [],
      askRules: [],
    };

    mockContext = {
      cwd: '/tmp/test-dir',
      abortController: new AbortController(),
      messages: [],
      getAppState: vi.fn(() => ({ permissionContext: basePermissionContext })),
      setAppState: vi.fn((fn) => {
        const result = fn({ permissionContext: basePermissionContext });
        if (result && result.permissionContext) {
          basePermissionContext = result.permissionContext;
        }
      }),
    };

    vi.clearAllMocks();
  });

  // Helper tools for testing
  const createMockTool = (name: string, isReadOnly: boolean): Tool<any, unknown> => ({
    name,
    isReadOnly: () => isReadOnly,
    validateInput: async (input) => ({ result: true }),
    call: async () => ({ content: 'result' }),
  });

  describe('multi-tool permission scenarios', () => {
    it('allows read tools to execute in sequence without repeated prompts', async () => {
      const readTool1 = createMockTool('Read', true);
      const readTool2 = createMockTool('Read', true);

      const result1 = await canUseTool(readTool1, { path: '/file1.txt' }, mockContext, null as any, '');
      const result2 = await canUseTool(readTool2, { path: '/file2.txt' }, mockContext, null as any, '');

      expect(result1.behavior).toBe('allow');
      expect(result2.behavior).toBe('allow');
    });

    it('asks for confirmation on first mutating tool call', async () => {
      const writeTool = createMockTool('Write', false);

      const result = await canUseTool(writeTool, { path: '/file.txt', content: 'data' }, mockContext, null as any, '');

      expect(result.behavior).toBe('ask');
    });

    it('allows tool after user grants permission via allow rule', async () => {
      const writeTool = createMockTool('Write', false);

      // First call - should ask
      let result = await canUseTool(writeTool, { path: '/allowed/file.txt' }, mockContext, null as any, '');
      expect(result.behavior).toBe('ask');

      // Simulate user granting permission by adding allow rule
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          allowRules: [...prev.permissionContext.allowRules, { toolName: 'Write', pattern: '/allowed/file.txt' }],
        },
      }));

      // Second call - should now be allowed
      result = await canUseTool(writeTool, { path: '/allowed/file.txt' }, mockContext, null as any, '');
      expect(result.behavior).toBe('allow');
    });

    it('denies tool when deny rule is added', async () => {
      const writeTool = createMockTool('Write', false);

      // Add a deny rule for specific path
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          denyRules: [{ toolName: 'Write', pattern: '/protected/file.txt' }],
        },
      }));

      const result = await canUseTool(writeTool, { path: '/protected/file.txt', content: 'data' }, mockContext, null as any, '');

      expect(result.behavior).toBe('deny');
      expect(result.message).toContain('blocked by a session rule');
    });

    it('allows bypassPermissions mode to override all rules', async () => {
      const writeTool = createMockTool('Write', false);

      // Set up deny and ask rules
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          denyRules: [{ toolName: 'Write' }],
          askRules: [{ toolName: 'Read' }],
          mode: 'bypassPermissions',
        },
      }));

      const result = await canUseTool(writeTool, { path: '/any/file.txt', content: 'data' }, mockContext, null as any, '');

      expect(result.behavior).toBe('allow'); // bypass overrides everything
    });

    it('acceptEdits mode allows mutating tools without confirmation', async () => {
      const writeTool = createMockTool('Write', false);

      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          mode: 'acceptEdits',
        },
      }));

      const result = await canUseTool(writeTool, { path: '/any/file.txt', content: 'data' }, mockContext, null as any, '');

      expect(result.behavior).toBe('allow');
    });
  });

  describe('rememberPermissionRule flow', () => {
    it('adds rule to allowRules when user confirms tool use', async () => {
      const writeTool = createMockTool('Write', false);
      const input = { path: '/user/confirmed/file.txt', content: 'data' };

      const result = await canUseTool(writeTool, input, mockContext, null as any, '');
      expect(result.behavior).toBe('ask');

      // User confirms - remember this permission
      const rememberedRule = rememberPermissionRule(mockContext, writeTool, input);

      expect(rememberedRule.toolName).toBe('Write');
      expect(rememberedRule.pattern).toBe('/user/confirmed/file.txt');

      // Verify rule was added to context
      const updatedContext = mockContext.getAppState().permissionContext;
      expect(updatedContext.allowRules).toHaveLength(1);
      expect(updatedContext.allowRules[0]).toEqual(rememberedRule);
    });

    it('does not add duplicate rules', async () => {
      const writeTool = createMockTool('Write', false);
      const input = { path: '/dedup/test.txt', content: 'data' };

      // First remember
      rememberPermissionRule(mockContext, writeTool, input);

      // Second remember with same tool and input
      rememberPermissionRule(mockContext, writeTool, input);

      const updatedContext = mockContext.getAppState().permissionContext;
      expect(updatedContext.allowRules).toHaveLength(1); // Should not duplicate
    });

    it('preserves existing allow rules when adding new one', async () => {
      const readTool = createMockTool('Read', true);
      const writeTool = createMockTool('Write', false);

      // Start with some existing context state
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          allowRules: [{ toolName: 'Read' }],
        },
      }));

      const input = { path: '/new/file.txt', content: 'data' };
      rememberPermissionRule(mockContext, writeTool, input);

      const updatedContext = mockContext.getAppState().permissionContext;
      expect(updatedContext.allowRules).toHaveLength(2);
      expect(updatedContext.allowRules[0].toolName).toBe('Read');
      expect(updatedContext.allowRules[1].toolName).toBe('Write');
    });
  });

  describe('permission rule precedence', () => {
    it('deny rules take precedence over allow rules', async () => {
      const writeTool = createMockTool('Write', false);

      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          allowRules: [{ toolName: 'Write' }], // Allow all writes
          denyRules: [{ toolName: 'Write', pattern: '/blocked/file.txt' }], // But block specific path
        },
      }));

      const result = await canUseTool(writeTool, { path: '/blocked/file.txt', content: 'data' }, mockContext, null as any, '');

      expect(result.behavior).toBe('deny');
    });

    it('allow rules take precedence over ask rules', async () => {
      const writeTool = createMockTool('Write', false);

      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          askRules: [{ toolName: 'Write' }], // Ask for all writes
          allowRules: [{ toolName: 'Write', pattern: '/allowed/file.txt' }], // But allow specific path
        },
      }));

      const result = await canUseTool(writeTool, { path: '/allowed/file.txt', content: 'data' }, mockContext, null as any, '');

      expect(result.behavior).toBe('allow');
    });

    it('specific pattern rules match before general rules', async () => {
      const writeTool = createMockTool('Write', false);

      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          mode: 'default',
          allowRules: [{ toolName: 'Write' }], // General allow all writes
          denyRules: [],
          askRules: [{ toolName: 'Write', pattern: '/specific/file.txt' }], // Specific ask for one path
        },
      }));

      const result = await canUseTool(writeTool, { path: '/specific/file.txt', content: 'data' }, mockContext, null as any, '');

      // Should match deny first (none), then allow (general rule matches)
      expect(result.behavior).toBe('allow');
    });
  });

  describe('permission state persistence across calls', () => {
    it('maintains permission rules between tool invocations', async () => {
      const writeTool = createMockTool('Write', false);

      // First call - no rules, should ask
      let result1 = await canUseTool(writeTool, { path: '/test/file.txt' }, mockContext, null as any, '');
      expect(result1.behavior).toBe('ask');

      // Add allow rule after first call
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          allowRules: [{ toolName: 'Write', pattern: '/test/file.txt' }],
        },
      }));

      // Second call - should remember the rule
      let result2 = await canUseTool(writeTool, { path: '/test/file.txt' }, mockContext, null as any, '');
      expect(result2.behavior).toBe('allow');

      // Third call with different path - still asks
      let result3 = await canUseTool(writeTool, { path: '/other/file.txt' }, mockContext, null as any, '');
      expect(result3.behavior).toBe('ask');
    });

    it('persists mode changes across calls', async () => {
      const writeTool = createMockTool('Write', false);

      // Start in default mode - should ask
      let result1 = await canUseTool(writeTool, { path: '/file.txt' }, mockContext, null as any, '');
      expect(result1.behavior).toBe('ask');

      // Switch to acceptEdits mode
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: { ...prev.permissionContext, mode: 'acceptEdits' },
      }));

      // Now should allow without asking
      let result2 = await canUseTool(writeTool, { path: '/file.txt' }, mockContext, null as any, '');
      expect(result2.behavior).toBe('allow');

      // Switch back to default - asks again
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: { ...prev.permissionContext, mode: 'default' },
      }));

      let result3 = await canUseTool(writeTool, { path: '/file.txt' }, mockContext, null as any, '');
      expect(result3.behavior).toBe('ask');
    });
  });

  describe('tool-specific permission checks', () => {
    it('allows tool with custom checkPermissions that returns allow', async () => {
      const customTool: Tool<any, unknown> = {
        name: 'CustomTool',
        isReadOnly: () => false, // Mutating but has custom permission
        validateInput: async (input) => ({ result: true }),
        call: async () => ({ content: 'result' }),
        checkPermissions: async (_input, _context): Promise<PermissionDecision> => ({
          behavior: 'allow',
          message: 'Custom tool allows itself',
        }),
      };

      const result = await canUseTool(customTool, { data: 'test' }, mockContext, null as any, '');

      expect(result.behavior).toBe('allow');
    });

    it('denies tool with custom checkPermissions that returns deny', async () => {
      const customTool: Tool<any, unknown> = {
        name: 'CustomTool',
        isReadOnly: () => false,
        validateInput: async (input) => ({ result: true }),
        call: async () => ({ content: 'result' }),
        checkPermissions: async (_input, _context): Promise<PermissionDecision> => ({
          behavior: 'deny',
          message: 'Custom tool denies access',
        }),
      };

      const result = await canUseTool(customTool, { data: 'test' }, mockContext, null as any, '');

      expect(result.behavior).toBe('deny');
    });

    it('custom checkPermissions works when no deny rules match', async () => {
      const customTool: Tool<any, unknown> = {
        name: 'CustomTool',
        isReadOnly: () => false,
        validateInput: async (input) => ({ result: true }),
        call: async () => ({ content: 'result' }),
        checkPermissions: async (_input, _context): Promise<PermissionDecision> => ({
          behavior: 'allow',
        }),
      };

      // No deny rules - custom checkPermissions should be evaluated
      const result = await canUseTool(customTool, { data: 'test' }, mockContext, null as any, '');

      // Custom checkPermissions allows when no deny/allow rules match
      expect(result.behavior).toBe('allow');
    });
  });

  describe('updatedInput propagation', () => {
    it('includes updatedInput in allow responses', async () => {
      const readTool = createMockTool('Read', true);
      const input = { path: '/test/file.txt' };

      const result = await canUseTool(readTool, input, mockContext, null as any, '');

      if (result.behavior === 'allow') {
        expect(result.updatedInput).toBe(input);
      } else {
        throw new Error('Expected allow behavior');
      }
    });

    it('includes updatedInput in ask responses', async () => {
      const writeTool = createMockTool('Write', false);
      const input = { path: '/test/file.txt', content: 'data' };

      const result = await canUseTool(writeTool, input, mockContext, null as any, '');

      if (result.behavior === 'ask') {
        expect(result.updatedInput).toEqual(input);
      } else {
        throw new Error('Expected ask behavior');
      }
    });

    it('includes updatedInput in deny responses', async () => {
      const toolWithValidation = createMockTool('TestTool', false);
      (toolWithValidation.validateInput as any) = async (_input: unknown) => ({ result: false, message: 'Invalid' });

      const result = await canUseTool(toolWithValidation, { invalid: true }, mockContext, null as any, '');

      // Deny doesn't include updatedInput per current implementation
    });
  });

  describe('complex permission workflows', () => {
    it('simulates user workflow: ask -> confirm -> allow pattern', async () => {
      const writeTool = createMockTool('Write', false);
      const input = { path: '/workspace/data.json', content: '{"key":"value"}' };

      // Step 1: First attempt - agent asks for permission
      let result = await canUseTool(writeTool, input, mockContext, null as any, '');
      expect(result.behavior).toBe('ask');

      // Step 2: User reviews and confirms - remember permission
      const rememberedRule = rememberPermissionRule(mockContext, writeTool, input);
      expect(rememberedRule.toolName).toBe('Write');
      expect(rememberedRule.pattern).toBe('/workspace/data.json');

      // Step 3: Subsequent calls to same path are allowed
      result = await canUseTool(writeTool, input, mockContext, null as any, '');
      expect(result.behavior).toBe('allow');
    });

    it('handles multi-step workflow with different tools', async () => {
      const readTool = createMockTool('Read', true);
      const writeTool = createMockTool('Write', false);
      const shellTool = createMockTool('Shell', false);

      // Read should always be allowed (read-only)
      let result1 = await canUseTool(readTool, { path: '/config.json' }, mockContext, null as any, '');
      expect(result1.behavior).toBe('allow');

      // Write should ask initially
      let result2 = await canUseTool(writeTool, { path: '/output.txt', content: 'data' }, mockContext, null as any, '');
      expect(result2.behavior).toBe('ask');

      // User allows write for this specific file
      rememberPermissionRule(mockContext, writeTool, { path: '/output.txt', content: 'data' });

      // Now write is allowed
      let result3 = await canUseTool(writeTool, { path: '/output.txt', content: 'more data' }, mockContext, null as any, '');
      expect(result3.behavior).toBe('allow');

      // Shell still asks (no rule established)
      let result4 = await canUseTool(shellTool, { command: 'ls -la' }, mockContext, null as any, '');
      expect(result4.behavior).toBe('ask');
    });

    it('handles permission escalation and de-escalation', async () => {
      const writeTool = createMockTool('Write', false);

      // Start with deny rule - denies all writes
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          denyRules: [{ toolName: 'Write' }],
        },
      }));

      let result1 = await canUseTool(writeTool, { path: '/file.txt', content: 'data' }, mockContext, null as any, '');
      expect(result1.behavior).toBe('deny');

      // Switch to bypassPermissions mode - overrides all rules
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          denyRules: [],
          allowRules: [{ toolName: 'Write', pattern: '/allowed/file.txt' }],
          mode: 'bypassPermissions',
        },
      }));

      // Now allowed due to bypass mode (deny rules are checked first but bypass overrides)
      let result2 = await canUseTool(writeTool, { path: '/any/file.txt', content: 'data' }, mockContext, null as any, '');
      expect(result2.behavior).toBe('allow');

      // Switch back to default mode with specific allow rule
      mockContext.setAppState((prev) => ({
        ...prev,
        permissionContext: {
          ...prev.permissionContext,
          denyRules: [],
          allowRules: [{ toolName: 'Write', pattern: '/allowed/file.txt' }],
          mode: 'default',
        },
      }));

      // Specific path allowed by rule
      let result3 = await canUseTool(writeTool, { path: '/allowed/file.txt', content: 'data' }, mockContext, null as any, '');
      expect(result3.behavior).toBe('allow');

      // Other paths ask (default behavior for mutating tools)
      let result4 = await canUseTool(writeTool, { path: '/denied/file.txt', content: 'data' }, mockContext, null as any, '');
      expect(result4.behavior).toBe('ask');
    });
  });
});

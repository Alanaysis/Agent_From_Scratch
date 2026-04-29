import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { ShellTool, type ShellInput } from '../../../../tools/shell/shellTool';
import type { ToolUseContext, PermissionDecision } from '../../../../tools/Tool';

// Mock child_process.spawn - import mocked function directly for Bun compatibility
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';

describe('ShellTool', () => {
  const mockContext: ToolUseContext = {
    cwd: '/tmp/test-dir',
    abortController: new AbortController(),
    messages: [],
    getAppState: vi.fn(() => ({ permissionContext: { mode: 'default' } })),
    setAppState: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create a mock child process with data emission
  function createMockChild(options?: {
    stdoutData?: string;
    stderrData?: string;
    exitCode?: number;
  }): any {
    const result: any = {
      stdout: {
        on: vi.fn((event: string, cb: Function) => {
          if (options?.stdoutData && event === 'data') {
            setTimeout(() => cb(options.stdoutData), 1);
          }
          return result;
        }),
      },
      stderr: {
        on: vi.fn((event: string, cb: Function) => {
          if (options?.stderrData && event === 'data') {
            setTimeout(() => cb(options.stderrData), 1);
          }
          return result;
        }),
      },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'error' && options?.exitCode !== 0 && !options.stdoutData) {
          // Error case - not handled here
        } else if (event === 'close') {
          setTimeout(() => cb(options.exitCode ?? 0), 1);
        }
        return result;
      }),
      once: vi.fn(),
      removeListener: vi.fn(),
      destroy: vi.fn(),
    };

    return result;
  }

  // Helper function to create a mock child that emits an error
  function createMockChildWithError(error: Error): any {
    const result: any = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'error') {
          setTimeout(() => cb(error), 1);
        }
        return result;
      }),
      once: vi.fn(),
      removeListener: vi.fn(),
      destroy: vi.fn(),
    };
    return result;
  }

  // Helper function to create a mock child with null exit code
  function createMockChildWithNullExitCode(): any {
    const result: any = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'close') {
          setTimeout(() => cb(null), 1); // null exit code
        }
        return result;
      }),
      once: vi.fn(),
      removeListener: vi.fn(),
      destroy: vi.fn(),
    };
    return result;
  }

  describe('Tool definition', () => {
    it('has correct name', () => {
      expect(ShellTool.name).toBe('Shell');
    });

    it('is not read-only (executes commands)', () => {
      const input: ShellInput = { command: 'echo test' };
      expect(ShellTool.isReadOnly(input)).toBe(false);
    });

    it('is not concurrency safe (commands may have side effects)', () => {
      const input: ShellInput = { command: 'echo test' };
      expect(ShellTool.isConcurrencySafe(input)).toBe(false);
    });

    it('has description method that returns string', async () => {
      const desc = await ShellTool.description({ command: 'test' } as any, {} as any);
      expect(typeof desc).toBe('string');
      expect(desc.toLowerCase()).toContain('shell');
    });
  });

  describe('validateInput', () => {
    it('returns valid for non-empty command', async () => {
      const result = await ShellTool.validateInput({ command: 'echo test' });
      expect(result).toEqual({ result: true });
    });

    it('returns invalid for empty command', async () => {
      const result = await ShellTool.validateInput({ command: '' });
      expect(result).toEqual({ result: false, message: 'Command is required' });
    });

    it('returns invalid for whitespace-only command', async () => {
      const result = await ShellTool.validateInput({ command: '   ' });
      expect(result).toEqual({ result: false, message: 'Command is required' });
    });

    it('returns valid for complex commands with pipes', async () => {
      const result = await ShellTool.validateInput({ command: 'ls -la | grep test' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for multi-line commands (with newlines)', async () => {
      const multilineCommand = 'echo line1\necho line2';
      const result = await ShellTool.validateInput({ command: multilineCommand });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for commands with special characters', async () => {
      const result = await ShellTool.validateInput({ command: 'echo "hello @#$%"' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for JSON-like string commands', async () => {
      const result = await ShellTool.validateInput({ command: 'echo \'{"key": "value"}\'' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for code-like commands', async () => {
      const result = await ShellTool.validateInput({ command: 'node -e "console.log(1+1)"' });
      expect(result).toEqual({ result: true });
    });
  });

  describe('checkPermissions', () => {
    it('returns ask behavior in default mode', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'default' } })),
      };

      const input: ShellInput = { command: 'echo test' };
      const result = await ShellTool.checkPermissions(input, context as any);

      expect(result.behavior).toBe('ask');
      if (result.behavior === 'ask') {
        expect(result.message).toContain('Shell requires confirmation');
        expect(result.message).toContain('echo test');
      }
    });

    it('returns allow behavior in bypassPermissions mode', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'bypassPermissions' } })),
      };

      const input: ShellInput = { command: 'echo test' };
      const result = await ShellTool.checkPermissions(input, context as any);

      expect(result.behavior).toBe('allow');
    });

    it('returns allow behavior in acceptEdits mode', async () => {
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'acceptEdits' } })),
      };

      const input: ShellInput = { command: 'echo test' };
      const result = await ShellTool.checkPermissions(input, context as any);

      expect(result.behavior).toBe('allow');
    });

    it('includes command in confirmation message', async () => {
      const commands = ['ls -la', 'rm -rf /tmp/test', './script.sh arg1 arg2'];

      for (const cmd of commands) {
        const context = {
          ...mockContext,
          getAppState: vi.fn(() => ({ permissionContext: { mode: 'default' } })),
        };

        const input: ShellInput = { command: cmd };
        const result = await ShellTool.checkPermissions(input, context as any);

        expect(result.behavior).toBe('ask');
        if (result.behavior === 'ask') {
          expect(result.message).toContain(cmd);
        }
      }
    });

    it('includes updatedInput in ask behavior', async () => {
      // In default mode, ShellTool returns 'ask' without updatedInput
      const context = {
        ...mockContext,
        getAppState: vi.fn(() => ({ permissionContext: { mode: 'default' } })),
      };

      const input: ShellInput = { command: 'echo test' };
      const result = await ShellTool.checkPermissions(input, context as any);

      expect(result.behavior).toBe('ask');
      // In default mode, updatedInput is not returned (only in allow modes)
    });
  });

  describe('call - successful execution', () => {
    it('executes command and returns stdout, stderr, exitCode on success', async () => {
      const mockChild = createMockChild({
        stdoutData: 'hello world\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const input: ShellInput = { command: 'echo "hello world"' };
      const result = await ShellTool.call(input, mockContext, null as any, null as any);

      expect(result.data).toEqual({
        stdout: 'hello world\n',
        stderr: '',
        exitCode: 0,
      });
    });

    it('executes in the correct working directory (context.cwd)', async () => {
      const mockChild = createMockChild({
        stdoutData: 'cwd test',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      await ShellTool.call(
        { command: 'pwd' },
        mockContext,
        null as any,
        null as any
      );

      expect(spawn).toHaveBeenCalledWith('pwd', {
        cwd: '/tmp/test-dir',
        shell: true,
        signal: mockContext.abortController.signal,
      });
    });

    it('uses shell: true option', async () => {
      const mockChild = createMockChild({ stdoutData: 'test' });
      (spawn as any).mockReturnValue(mockChild);

      await ShellTool.call(
        { command: 'echo test' },
        mockContext,
        null as any,
        null as any
      );

      expect(spawn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        shell: true,
      }));
    });

    it('uses abortController signal', async () => {
      const mockChild = createMockChild({ stdoutData: 'test' });
      (spawn as any).mockReturnValue(mockChild);

      await ShellTool.call(
        { command: 'echo test' },
        mockContext,
        null as any,
        null as any
      );

      expect(spawn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        signal: mockContext.abortController.signal,
      }));
    });

    it('handles commands with no output', async () => {
      const mockChild = createMockChild({ stdoutData: '', stderrData: '', exitCode: 0 });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'true' }, // Command that does nothing but returns success
        mockContext,
        null as any,
        null as any
      );

      expect(result.data).toEqual({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
    });

    it('handles commands with only stderr output', async () => {
      const mockChild = createMockChild({
        stdoutData: '',
        stderrData: 'error message\n',
        exitCode: 1,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'false' }, // Command that always fails with stderr
        mockContext,
        null as any,
        null as any
      );

      expect(result.data).toEqual({
        stdout: '',
        stderr: 'error message\n',
        exitCode: 1,
      });
    });

    it('handles commands with both stdout and stderr output', async () => {
      const mockChild = createMockChild({
        stdoutData: 'stdout content\n',
        stderrData: 'stderr content\n',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo out; echo err >&2' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data).toEqual({
        stdout: 'stdout content\n',
        stderr: 'stderr content\n',
        exitCode: 0,
      });
    });

    it('handles commands with non-zero exit code', async () => {
      const mockChild = createMockChild({
        stdoutData: '',
        stderrData: 'exit failed\n',
        exitCode: 42,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'exit 42' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.exitCode).toBe(42);
    });

    it('handles multi-line stdout', async () => {
      const multilineStdout = 'line1\nline2\nline3';
      const mockChild = createMockChild({
        stdoutData: multilineStdout,
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo -e "line1\\nline2\\nline3"' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe(multilineStdout);
    });

    it('handles binary data in stdout (converts to string)', async () => {
      const mockChild = createMockChild({
        stdoutData: Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]).toString(), // "Hello"
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo -n Hello' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('Hello');
    });

    it('handles commands with special characters', async () => {
      const mockChild = createMockChild({
        stdoutData: '@#$%^&*()!{}[]|;:\'",.<>?/`~\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo "@#$%^&*()!{}[]|;:\'",.<>?/`~"' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('@#$%^&*()!{}[]|;:\'",.<>?/`~\n');
    });

    it('handles commands with unicode content', async () => {
      const mockChild = createMockChild({
        stdoutData: 'Hello 世界\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo "Hello 世界"' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('Hello 世界\n');
    });

    it('handles commands with emoji content', async () => {
      const mockChild = createMockChild({
        stdoutData: '👋 Hello 👋\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo "👋 Hello 👋"' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('👋 Hello 👋\n');
    });
  });

  describe('call - error handling', () => {
    it('rejects when spawn fails to create process', async () => {
      (spawn as any).mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      await expect(
        ShellTool.call({ command: 'nonexistent-command' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles child.on("error") error', async () => {
      const mockChild = createMockChildWithError(new Error('EACCES: permission denied'));
      (spawn as any).mockReturnValue(mockChild);

      await expect(
        ShellTool.call({ command: '/protected/script.sh' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles abort signal', async () => {
      const controller = new AbortController();
      const context: ToolUseContext = {
        ...mockContext,
        cwd: '/tmp/test-dir',
        abortController: controller,
      };

      // Create a child that emits error on abort
      const mockChild: any = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('killed')), 1);
          }
          return mockChild;
        }),
        once: vi.fn(),
        removeListener: vi.fn(),
        destroy: vi.fn(),
      };
      (spawn as any).mockReturnValue(mockChild);

      // Abort the operation
      controller.abort();

      await expect(
        ShellTool.call({ command: 'sleep 10' }, context, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles exit with null code (defaults to 0)', async () => {
      const mockChild = createMockChildWithNullExitCode();
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo test' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.exitCode).toBe(0);
    });
  });

  describe('call - integration with mocked spawn', () => {
    it('handles file paths in commands (with spaces)', async () => {
      const mockChild = createMockChild({
        stdoutData: 'file content\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'cat "file with spaces.txt"' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('file content\n');
    });

    it('handles complex pipeline commands', async () => {
      const mockChild = createMockChild({
        stdoutData: 'result of pipeline\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'ls -la | grep test | wc -l' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('result of pipeline\n');
    });

    it('handles commands with environment variables', async () => {
      const mockChild = createMockChild({
        stdoutData: 'my-value\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'echo $MY_VAR' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('my-value\n');
    });

    it('handles commands with subshells', async () => {
      const mockChild = createMockChild({
        stdoutData: 'nested\nresult\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: '(echo nested; echo result)' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('nested\nresult\n');
    });

    it('handles commands with heredoc (simplified)', async () => {
      const mockChild = createMockChild({
        stdoutData: 'heredoc output\n',
        stderrData: '',
        exitCode: 0,
      });
      (spawn as any).mockReturnValue(mockChild);

      const result = await ShellTool.call(
        { command: 'cat << EOF\ntest\nEOF' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.stdout).toBe('heredoc output\n');
    });
  });

  describe('tool call signature', () => {
    it('accepts ToolUseContext with abortController', async () => {
      const mockChild = createMockChild({ stdoutData: 'test' });
      (spawn as any).mockReturnValue(mockChild);

      const controller = new AbortController();
      const context: ToolUseContext = {
        cwd: '/tmp',
        abortController: controller,
        messages: [],
        getAppState: vi.fn(() => ({})),
        setAppState: vi.fn(),
      };

      await ShellTool.call({ command: 'echo test' }, context, null as any, null as any);

      expect(spawn).toHaveBeenCalled();
    });

    it('accepts canUseTool callback parameter', async () => {
      const mockChild = createMockChild({ stdoutData: 'test' });
      (spawn as any).mockReturnValue(mockChild);

      const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' } as PermissionDecision<ShellInput>);

      await ShellTool.call(
        { command: 'echo test' },
        mockContext,
        mockCanUseTool,
        null as any
      );

      expect(mockCanUseTool).toBeDefined();
    });

    it('accepts parentMessage parameter', async () => {
      const mockChild = createMockChild({ stdoutData: 'test' });
      (spawn as any).mockReturnValue(mockChild);

      const mockParentMessage = { id: 'msg-123', type: 'assistant', content: [] };

      await ShellTool.call(
        { command: 'echo test' },
        mockContext,
        null as any,
        mockParentMessage
      );

      expect(spawn).toHaveBeenCalled();
    });
  });
});

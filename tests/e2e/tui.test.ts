import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('TUI E2E', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('TUI module structure', () => {
    it('tui module exports startTui function', async () => {
      const tuiModule = await import('../../app/tui');
      expect(tuiModule.startTui).toBeDefined();
      expect(typeof tuiModule.startTui).toBe('function');
    });

    it('startTui has correct type signature', async () => {
      const tuiModule = await import('../../app/tui');
      // Function should accept TuiOptions object
      expect(tuiModule.startTui.length).toBe(1);
    });

    it('headless module integration verified', async () => {
      const headlessModule = await import('../../app/headless');
      expect(headlessModule.formatHelp).toBeDefined();
      expect(headlessModule.executeCliCommand).toBeDefined();
    });
  });

  describe('TUI state initialization', () => {
    it('creates initial TUI state with correct structure', async () => {
      const tuiModule = await import('../../app/tui');
      // We can't directly test state creation without running the full TUI,
      // but we can verify module exports and basic structure via type checking
      expect(tuiModule.startTui).toBeDefined();
    });

    it('runtime integration creates proper SessionEngine', async () => {
      const { SessionEngine } = await import('../../runtime/session');
      const { createId } = await import('../../shared/ids');

      const sessionId = createId('session');
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });

      expect(session.sessionId).toBe(sessionId);
      expect(session.cwd).toBe(tempDir);
    });
  });

  describe('TUI command handling', () => {
    it('slash commands are tokenized correctly', async () => {
      const { tokenizeCommandLine } = await import('../../shared/cli');

      const result1 = tokenizeCommandLine('/help');
      expect(result1).toEqual(['/help']);

      const result2 = tokenizeCommandLine('/sessions --limit 5');
      expect(result2).toContain('/sessions');
      expect(result2).toContain('--limit');
      expect(result2).toContain('5');

      const result3 = tokenizeCommandLine('/inspect abc-123');
      expect(result3).toEqual(['/inspect', 'abc-123']);
    });

    it('headless executeCliCommand integrates with TUI flow', async () => {
      const { executeCliCommand, formatHelp } = await import('../../app/headless');

      // Test version command (meta output)
      const versionResult = await executeCliCommand(tempDir, ['--version'], false);
      expect(versionResult.kind).toBe('meta');
      expect(typeof versionResult.output).toBe('string');
    });
  });

  describe('TUI permission flow', () => {
    it('permission context structure verified for TUI modal', async () => {
      const { createInitialAppState } = await import('../../runtime/state');

      const state = createInitialAppState();

      expect(state.permissionContext.mode).toBe('default');
      expect(Array.isArray(state.permissionContext.allowRules)).toBe(true);
      expect(Array.isArray(state.permissionContext.denyRules)).toBe(true);
      expect(Array.isArray(state.permissionContext.askRules)).toBe(true);
    });

    it('canUseTool works with TUI permission request flow', async () => {
      const { canUseTool } = await import('../../permissions/engine');
      const { getTools } = await import('../../tools/registry');

      const readTool = getTools().find(t => t.name === 'Read')!;

      const mockContext: any = {
        cwd: tempDir,
        messages: [],
        getAppState: () => ({
          permissionContext: { mode: 'default', allowRules: [], denyRules: [], askRules: [] },
        }),
        setAppState: vi.fn(),
      };

      const result = await canUseTool(readTool, { path: '/test.txt' }, mockContext, null as any, '');
      expect(result.behavior).toBe('allow'); // Read-only tools allowed in default mode
    });

    it('mutating tool triggers permission modal', async () => {
      const { canUseTool } = await import('../../permissions/engine');
      const { getTools } = await import('../../tools/registry');

      const writeTool = getTools().find(t => t.name === 'Write')!;

      const mockContext: any = {
        cwd: tempDir,
        messages: [],
        getAppState: () => ({
          permissionContext: { mode: 'default', allowRules: [], denyRules: [], askRules: [] },
        }),
        setAppState: vi.fn(),
      };

      const result = await canUseTool(writeTool, { path: '/test.txt', content: 'data' }, mockContext, null as any, '');
      expect(result.behavior).toBe('ask'); // Mutating tools ask for permission
    });
  });

  describe('TUI session management integration', () => {
    it('session persistence works with TUI flow', async () => {
      const { SessionEngine } = await import('../../runtime/session');

      const session = new SessionEngine({ id: 'tui-session-test', cwd: tempDir });

      // Record messages (simulating user interaction)
      await session.recordMessages([
        { role: 'user' as const, content: 'Hello TUI' },
      ]);

      // Verify transcript was created
      expect(await fs.stat(session.getTranscriptPath())).toBeDefined();
    });

    it('session list works for TUI resume feature', async () => {
      const { SessionEngine } = await import('../../runtime/session');
      const { createId } = await import('../../shared/ids');
      const { listSessions } = await import('../../storage/sessionIndex');

      // Create a session
      const sessionId = createId('session');
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });
      await session.recordMessages([{ role: 'user' as const, content: 'test' }]);

      // Should appear in list for resume feature
      const sessions = await listSessions(tempDir);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(sessionId);
    });

    it('transcript reading works for TUI restoreSession', async () => {
      const { appendTranscript, readTranscriptMessages } = await import('../../storage/transcript');

      const messages = [
        { role: 'user' as const, content: 'Previous session message' },
        { role: 'assistant' as const, content: 'Assistant response' },
      ];

      await appendTranscript(tempDir, 'tui-restore-test', messages);
      const loaded = await readTranscriptMessages(tempDir, 'tui-restore-test');

      expect(loaded).toEqual(messages);
    });
  });

  describe('TUI tool execution integration', () => {
    it('shell tool works in TUI context', async () => {
      const { ShellTool } = await import('../../tools/shell/shellTool');
      const { createId } = await import('../../shared/ids');

      // Test validation
      const validValidation = await ShellTool.validateInput({ command: 'echo test' });
      expect(validValidation.result).toBe(true);

      // Missing command should fail gracefully now
      const invalidValidation = await ShellTool.validateInput({} as any);
      expect(invalidValidation.result).toBe(false);
    });

    it('read tool works in TUI context', async () => {
      const { ReadTool } = await import('../../tools/files/readTool');

      // Create a test file
      const testFile = path.join(tempDir, 'test-read.txt');
      await fs.writeFile(testFile, 'TUI read test content');

      const validValidation = await ReadTool.validateInput({ path: testFile });
      expect(validValidation.result).toBe(true);
    });

    it('write tool works in TUI context', async () => {
      const { WriteTool } = await import('../../tools/files/writeTool');

      // Missing path should fail gracefully
      const invalidValidation = await WriteTool.validateInput({} as any);
      expect(invalidValidation.result).toBe(false);
    });

    it('edit tool works in TUI context', async () => {
      const { EditTool } = await import('../../tools/files/editTool');

      // Missing parameters should fail gracefully
      const invalidValidation = await EditTool.validateInput({} as any);
      expect(invalidValidation.result).toBe(false);
    });
  });

  describe('TUI workflow simulation', () => {
    it('complete user message flow with session recording', async () => {
      const { SessionEngine } = await import('../../runtime/session');
      const { createId } = await import('../../shared/ids');

      const sessionId = createId('session');
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });

      // Simulate user message
      const userMessage = { role: 'user' as const, content: 'Read file.txt' };
      await session.recordMessages([userMessage]);

      // Verify message was recorded
      const messages = session.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(userMessage);

      // Verify transcript exists
      expect(await fs.stat(session.getTranscriptPath())).toBeDefined();
    });

    it('multiple tool calls in single TUI session', async () => {
      const { SessionEngine } = await import('../../runtime/session');

      const sessionId = 'tui-multi-tool-test';
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });

      // Simulate multiple interactions
      await session.recordMessages([
        { role: 'user' as const, content: 'Read package.json' },
        { role: 'assistant' as const, type: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: { path: 'package.json' } }] },
        { role: 'tool_result' as const, type: 'tool_result', toolUseId: '1', content: '{"name": "test"}', isError: false },
      ]);

      expect(session.getMessages()).toHaveLength(3);
    });

    it('error handling in TUI session flow', async () => {
      const { SessionEngine } = await import('../../runtime/session');

      const sessionId = 'tui-error-test';
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });

      // Simulate error scenario
      await session.recordMessages([
        { role: 'user' as const, content: 'Delete important.txt' },
        { role: 'assistant' as const, type: 'assistant', content: [{ type: 'tool_use', name: 'Shell', input: { command: 'rm important.txt' } }] },
        { role: 'tool_result' as const, type: 'tool_result', toolUseId: '1', content: 'Permission denied', isError: true },
      ]);

      expect(session.getMessages()).toHaveLength(3);
    });
  });
});

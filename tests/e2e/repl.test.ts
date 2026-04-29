import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('REPL E2E', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create isolated temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repl-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('REPL module structure', () => {
    it('repl module exports startRepl function', async () => {
      const replModule = await import('../../app/repl');
      expect(replModule.startRepl).toBeDefined();
      expect(typeof replModule.startRepl).toBe('function');
    });

    it('headless module exports formatHelp and executeCliCommand', async () => {
      const headlessModule = await import('../../app/headless');
      expect(headlessModule.formatHelp).toBeDefined();
      expect(headlessModule.executeCliCommand).toBeDefined();
    });

    it('runtime modules export expected functions', async () => {
      const sessionModule = await import('../../runtime/session');
      expect(sessionModule.SessionEngine).toBeDefined();

      const stateModule = await import('../../runtime/state');
      expect(stateModule.createInitialAppState).toBeDefined();
    });
  });

  describe('Session engine integration', () => {
    it('creates session with proper structure', async () => {
      const { SessionEngine } = await import('../../runtime/session');
      const { createId } = await import('../../shared/ids');

      const sessionId = createId('session');
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });

      expect(session.sessionId).toBe(sessionId);
      expect(session.cwd).toBe(tempDir);
    });

    it('session starts with empty messages', async () => {
      const { SessionEngine } = await import('../../runtime/session');

      const session = new SessionEngine({ id: 'test-sess', cwd: tempDir });
      // Messages are stored internally, verify via transcript file after save
      expect(session.getMessages()).toEqual([]);
    });

    it('session persists messages to disk via recordMessages', async () => {
      const { SessionEngine } = await import('../../runtime/session');

      const session = new SessionEngine({ id: 'test-persist', cwd: tempDir });

      // Record messages triggers persistence
      await session.recordMessages([
        { role: 'user' as const, content: 'Hello' },
      ]);

      // Transcript file should exist
      expect(await fs.stat(session.getTranscriptPath())).toBeDefined();
    });
  });

  describe('Message handling', () => {
    it('messages are stored with correct structure', async () => {
      const { SessionEngine } = await import('../../runtime/session');

      const session = new SessionEngine({ id: 'test-msgs', cwd: tempDir });

      // Add messages using the public API (simulating runtime flow)
      session.appendMessage({ role: 'user' as const, content: 'Hello' });
      session.appendMessage({ role: 'assistant' as const, content: 'Hi there!' });

      expect(session.getMessages()).toHaveLength(2);
    });

    it('transcript path is generated correctly', async () => {
      const { SessionEngine } = await import('../../runtime/session');
      const { getTranscriptPath } = await import('../../storage/transcript');

      const session = new SessionEngine({ id: 'test-transcript', cwd: tempDir });
      const expectedPath = getTranscriptPath(tempDir, session.sessionId);

      expect(expectedPath).toContain('.claude-code-lite');
      expect(expectedPath).toContain('transcripts');
      expect(expectedPath.slice(-6)).toBe('.jsonl');
    });
  });

  describe('Tool registry integration', () => {
    it('registry exports all known tools', async () => {
      const { getTools } = await import('../../tools/registry');
      const tools = getTools();

      expect(tools).toHaveLength(6); // Read, Write, Edit, Shell, WebFetch, Agent
      expect(tools.map(t => t.name)).toContain('Read');
      expect(tools.map(t => t.name)).toContain('Write');
      expect(tools.map(t => t.name)).toContain('Shell');
    });

    it('tools have required properties', async () => {
      const { getTools } = await import('../../tools/registry');
      const tools = getTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.isReadOnly).toBe('function');
        expect(typeof tool.validateInput).toBe('function');
        expect(typeof tool.call).toBe('function');
      }
    });

    it('Read tool validates input correctly', async () => {
      const tools = await import('../../tools/registry').then(m => m.getTools());
      const readTool = tools.find(t => t.name === 'Read');

      expect(readTool).toBeDefined();

      // Valid path
      const validValidation = await readTool!.validateInput({ path: '/some/path.txt' });
      expect(validValidation.result).toBe(true);

      // Missing path should fail
      const invalidValidation = await readTool!.validateInput({} as any);
      expect(invalidValidation.result).toBe(false);
    });

    it('Shell tool validates input correctly', async () => {
      const tools = await import('../../tools/registry').then(m => m.getTools());
      const shellTool = tools.find(t => t.name === 'Shell');

      expect(shellTool).toBeDefined();

      // Valid command
      const validValidation = await shellTool!.validateInput({ command: 'echo test' });
      expect(validValidation.result).toBe(true);

      // Missing command should fail
      const invalidValidation = await shellTool!.validateInput({} as any);
      expect(invalidValidation.result).toBe(false);
    });
  });

  describe('Permission engine integration', () => {
    it('permission context has correct structure', async () => {
      const { createInitialAppState } = await import('../../runtime/state');

      const state = createInitialAppState();

      expect(state.permissionContext.mode).toBe('default');
      expect(Array.isArray(state.permissionContext.allowRules)).toBe(true);
      expect(Array.isArray(state.permissionContext.denyRules)).toBe(true);
      expect(Array.isArray(state.permissionContext.askRules)).toBe(true);
    });

    it('canUseTool returns correct behavior for read-only tools', async () => {
      const { canUseTool } = await import('../../permissions/engine');
      const { getTools } = await import('../../tools/registry');

      const tools = getTools();
      const readTool = tools.find(t => t.name === 'Read')!;

      const mockContext: any = {
        cwd: tempDir,
        messages: [],
        getAppState: () => ({
          permissionContext: { mode: 'default', allowRules: [], denyRules: [], askRules: [] },
        }),
        setAppState: vi.fn(),
      };

      const result = await canUseTool(readTool, { path: '/test.txt' }, mockContext, null as any, '');
      expect(result.behavior).toBe('allow'); // Read-only tools are allowed in default mode
    });

    it('canUseTool asks for mutating tools in default mode', async () => {
      const { canUseTool } = await import('../../permissions/engine');
      const { getTools } = await import('../../tools/registry');

      const tools = getTools();
      const writeTool = tools.find(t => t.name === 'Write')!;

      const mockContext: any = {
        cwd: tempDir,
        messages: [],
        getAppState: () => ({
          permissionContext: { mode: 'default', allowRules: [], denyRules: [], askRules: [] },
        }),
        setAppState: vi.fn(),
      };

      const result = await canUseTool(writeTool, { path: '/test.txt', content: 'data' }, mockContext, null as any, '');
      expect(result.behavior).toBe('ask'); // Mutating tools ask in default mode
    });

    it('canUseTool allows in acceptEdits mode', async () => {
      const { canUseTool } = await import('../../permissions/engine');
      const { getTools } = await import('../../tools/registry');

      const tools = getTools();
      const writeTool = tools.find(t => t.name === 'Write')!;

      const mockContext: any = {
        cwd: tempDir,
        messages: [],
        getAppState: () => ({
          permissionContext: { mode: 'acceptEdits', allowRules: [], denyRules: [], askRules: [] },
        }),
        setAppState: vi.fn(),
      };

      const result = await canUseTool(writeTool, { path: '/test.txt', content: 'data' }, mockContext, null as any, '');
      expect(result.behavior).toBe('allow'); // acceptEdits bypasses asking
    });
  });

  describe('Storage integration', () => {
    it('session index tracks sessions', async () => {
      const { SessionEngine } = await import('../../runtime/session');
      const { createId } = await import('../../shared/ids');
      const { listSessions, deleteSessionInfo } = await import('../../storage/sessionIndex');

      // Create session and record messages to trigger persistence
      const sessionId = createId('session');
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });
      await session.recordMessages([{ role: 'user' as const, content: 'test' }]);

      // Should appear in list
      let sessions = await listSessions(tempDir);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(sessionId);

      // Clean up
      await deleteSessionInfo(tempDir, sessionId);
    });

    it('transcript persistence works end-to-end', async () => {
      const { appendTranscript, readTranscriptMessages } = await import('../../storage/transcript');

      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      // Append and read back
      await appendTranscript(tempDir, 'test-session', messages);
      const loaded = await readTranscriptMessages(tempDir, 'test-session');

      expect(loaded).toEqual(messages);
    });
  });
});

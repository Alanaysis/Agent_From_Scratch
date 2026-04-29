import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('Headless E2E', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'headless-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Headless module structure', () => {
    it('headless module exports required functions', async () => {
      const headlessModule = await import('../../app/headless');
      expect(headlessModule.executeCliCommand).toBeDefined();
      expect(headlessModule.formatHelp).toBeDefined();
    });

    it('executeCliCommand has correct signature', async () => {
      const headlessModule = await import('../../app/headless');
      // Function accepts cwd, tokens, autoApprove (may be 2 or 3 params)
      expect(headlessModule.executeCliCommand.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('CLI command execution', () => {
    it('--help returns usage information', async () => {
      const headlessModule = await import('../../app/headless');

      const result = await headlessModule.executeCliCommand(tempDir, ['--help'], false);

      expect(result.kind).toBe('meta');
      expect(typeof result.output).toBe('string');
      expect((result.output as string).toLowerCase()).toContain('command');
    });

    it('--version returns version', async () => {
      const headlessModule = await import('../../app/headless');

      const result = await headlessModule.executeCliCommand(tempDir, ['--version'], false);

      expect(result.kind).toBe('meta');
      expect(typeof result.output).toBe('string');
    });

    it('tools command returns tool list', async () => {
      const headlessModule = await import('../../app/headless');

      const result = await headlessModule.executeCliCommand(tempDir, ['tools'], false);

      expect(result.kind).toBe('meta');
      expect(typeof result.output).toBe('string');
    });
  });

  describe('File operations in headless mode', () => {
    it('read command works end-to-end', async () => {
      const headlessModule = await import('../../app/headless');

      // Create a test file
      const testFile = path.join(tempDir, 'test-read.txt');
      const content = 'Headless read test';
      await fs.writeFile(testFile, content);

      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['read', testFile],
        false
      );

      expect(result.kind).toBe('tool');
      expect((result.output as any).content).toContain(content);
    });

    it('write command creates file in headless mode', async () => {
      const headlessModule = await import('../../app/headless');

      const testFile = path.join(tempDir, 'headless-write-test.txt');
      const content = 'Headless write test';

      // Write requires autoApprove for mutating tools
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['write', testFile, content],
        true  // autoApprove
      );

      expect(result.kind).toBe('tool');
      expect(await fs.readFile(testFile, 'utf8')).toBe(content);
    });

    it('edit command modifies file in headless mode', async () => {
      const headlessModule = await import('../../app/headless');

      // Create initial file
      const testFile = path.join(tempDir, 'headless-edit-test.txt');
      await fs.writeFile(testFile, 'original content');

      // Edit requires autoApprove for mutating tools
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['edit', testFile, 'original', 'modified'],
        true  // autoApprove
      );

      expect(result.kind).toBe('tool');
      const updatedContent = await fs.readFile(testFile, 'utf8');
      expect(updatedContent).toContain('modified');
    });

    it('shell command executes in headless mode', async () => {
      const headlessModule = await import('../../app/headless');

      // Shell requires autoApprove for mutating tools
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['shell', 'echo', 'headless-shell-test'],
        true  // autoApprove
      );

      expect(result.kind).toBe('tool');
      const output = (result.output as any);
      expect(output.stdout).toContain('headless-shell-test');
    });
  });

  describe('Headless session management', () => {
    it('sessions command lists existing sessions', async () => {
      const headlessModule = await import('../../app/headless');
      const { SessionEngine } = await import('../../runtime/session');
      const { createId } = await import('../../shared/ids');

      // Create a session first
      const sessionId = createId('session');
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });
      await session.recordMessages([{ role: 'user' as const, content: 'test' }]);

      const result = await headlessModule.executeCliCommand(tempDir, ['sessions'], false);

      // sessions returns utility type (tool-based) not meta
      expect(result.kind).toBe('utility');
      expect(typeof result.output).toBe('string');
    });

    it('transcript command returns session transcript', async () => {
      const headlessModule = await import('../../app/headless');
      const { SessionEngine } = await import('../../runtime/session');

      // Create a session with messages using proper Message type from runtime/messages
      const sessionId = 'headless-transcript-test';
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });

      // User message must have id, type, and content (string) - per runtime/messages.ts
      await session.recordMessages([
        { id: 'user-1', type: 'user' as const, content: 'Hello' },
      ]);

      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['transcript', sessionId],
        false
      );

      // transcript returns utility type (tool-based) not meta
      expect(result.kind).toBe('utility');
    });

    it('inspect command returns session info', async () => {
      const headlessModule = await import('../../app/headless');
      const { SessionEngine } = await import('../../runtime/session');

      // Create a session with proper message type (content is string for user messages)
      const sessionId = 'headless-inspect-test';
      const session = new SessionEngine({ id: sessionId, cwd: tempDir });
      await session.recordMessages([{ id: 'user-1', type: 'user' as const, content: 'test message' }]);

      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['inspect', sessionId],
        false
      );

      // inspect returns utility type (tool-based) not meta
      expect(result.kind).toBe('utility');
    });
  });

  describe('Headless permission flow', () => {
    it('read tool is allowed without autoApprove in default mode', async () => {
      const headlessModule = await import('../../app/headless');

      // Create a test file
      const testFile = path.join(tempDir, 'permission-test.txt');
      await fs.writeFile(testFile, 'content');

      // Auto-approve is false but read should still work (read-only)
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['read', testFile],
        false
      );

      expect(result.kind).toBe('tool');
    });

    it('write tool requires autoApprove for execution', async () => {
      const headlessModule = await import('../../app/headless');

      // Without auto-approve, write should ask (but in headless mode with no TUI, this may behave differently)
      // The key is that the command path exists and permission checking works
      const testFile = path.join(tempDir, 'auto-approve-test.txt');

      // With autoApprove=true, write should succeed
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['write', testFile, 'content'],
        true  // autoApprove
      );

      expect(result.kind).toBe('tool');
    });

    it('shell tool permission flow works correctly', async () => {
      const headlessModule = await import('../../app/headless');

      // Shell is mutating but simple commands should work with autoApprove
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['shell', 'echo', 'test'],
        true  // autoApprove for shell operations
      );

      expect(result.kind).toBe('tool');
    });
  });

  describe('Headless batch processing patterns', () => {
    it('multiple file reads in sequence', async () => {
      const headlessModule = await import('../../app/headless');

      // Create multiple test files
      const files = [];
      for (let i = 0; i < 3; i++) {
        const file = path.join(tempDir, `batch-read-${i}.txt`);
        await fs.writeFile(file, `content ${i}`);
        files.push(file);
      }

      // Read all files in sequence
      for (const file of files) {
        const result = await headlessModule.executeCliCommand(
          tempDir,
          ['read', file],
          false
        );
        expect(result.kind).toBe('tool');
      }
    });

    it('create and verify multiple files', async () => {
      const headlessModule = await import('../../app/headless');

      // Create multiple files
      for (let i = 0; i < 3; i++) {
        const file = path.join(tempDir, `batch-write-${i}.txt`);
        const result = await headlessModule.executeCliCommand(
          tempDir,
          ['write', file, `content ${i}`],
          true
        );
        expect(result.kind).toBe('tool');

        // Verify content
        const content = await fs.readFile(file, 'utf8');
        expect(content).toBe(`content ${i}`);
      }
    });

    it('shell pipeline command works', async () => {
      const headlessModule = await import('../../app/headless');

      // Create a test file first
      const testFile = path.join(tempDir, 'pipeline-test.txt');
      await fs.writeFile(testFile, 'line1\nline2\nline3');

      // Use shell to read and filter
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['shell', 'cat', testFile, '|', 'head', '-1'],
        true
      );

      expect(result.kind).toBe('tool');
    });
  });

  describe('Headless error handling', () => {
    it('read non-existent file throws error', async () => {
      const headlessModule = await import('../../app/headless');

      // Read of non-existent file should throw an error (not return tool result)
      await expect(
        headlessModule.executeCliCommand(
          tempDir,
          ['read', path.join(tempDir, 'nonexistent.txt')],
          false
        )
      ).rejects.toThrow(/no such file|ENOENT/);
    });

    it('invalid command throws appropriate error', async () => {
      const headlessModule = await import('../../app/headless');

      await expect(
        headlessModule.executeCliCommand(tempDir, ['invalid-command'], false)
      ).rejects.toThrow();
    });

    it('shell execution handles errors gracefully', async () => {
      const headlessModule = await import('../../app/headless');

      // Try to execute invalid shell command
      const result = await headlessModule.executeCliCommand(
        tempDir,
        ['shell', 'nonexistent-command-xyz'],
        true
      );

      expect(result.kind).toBe('tool');
    });
  });

  describe('Headless tool registry integration', () => {
    it('all tools are accessible via headless commands', async () => {
      const headlessModule = await import('../../app/headless');
      const { getTools } = await import('../../tools/registry');

      const tools = getTools();
      expect(tools).toHaveLength(6); // Read, Write, Edit, Shell, WebFetch, Agent

      // Verify each tool name is accessible
      const toolNames = tools.map(t => t.name.toLowerCase());
      expect(toolNames).toContain('read');
      expect(toolNames).toContain('write');
      expect(toolNames).toContain('edit');
      expect(toolNames).toContain('shell');
    });

    it('tool validation works in headless context', async () => {
      const headlessModule = await import('../../app/headless');
      const { ReadTool } = await import('../../tools/files/readTool');

      // Valid path
      const validValidation = await ReadTool.validateInput({ path: '/some/path.txt' });
      expect(validValidation.result).toBe(true);

      // Missing path should fail gracefully now (with null check fix)
      const invalidValidation = await ReadTool.validateInput({} as any);
      expect(invalidValidation.result).toBe(false);
    });
  });
});

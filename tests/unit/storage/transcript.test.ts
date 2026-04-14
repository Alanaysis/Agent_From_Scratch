import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { appendTranscript, readTranscriptMessages, deleteTranscript, getTranscriptPath } from '../../../storage/transcript';
import type { Message } from '../../../runtime/messages';

describe('Storage Transcript', () => {
  let tempDir: string;
  let sessionId: string;

  beforeEach(async () => {
    // Create a temporary directory for test isolation
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcript-test-'));
    sessionId = `test-session-${Date.now()}`;
  });

  afterEach(async () => {
    // Clean up temp directory after each test
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getTranscriptPath', () => {
    it('generates correct path with cwd and sessionId', () => {
      const testCwd = '/fake/cwd';
      const testSessionId = 'abc123';
      const expectedPath = path.join(testCwd, '.claude-code-lite', 'transcripts', `${testSessionId}.jsonl`);

      expect(getTranscriptPath(testCwd, testSessionId)).toBe(expectedPath);
    });

    it('handles paths with trailing slashes', () => {
      const result = getTranscriptPath('/fake/cwd/', sessionId);
      expect(result).toContain('.claude-code-lite');
      expect(result).toContain(`/${sessionId}.jsonl`);
    });

    it('includes .jsonl extension', () => {
      const result = getTranscriptPath('/test', 'session123');
      expect(result.slice(-6)).toBe('.jsonl');
    });
  });

  describe('appendTranscript', () => {
    it('creates transcript directory if it does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'new', 'nested', 'dir');
      await appendTranscript(nonExistentDir, sessionId, []);

      // Directory should be created recursively
      const dirExists = await fs.stat(path.join(nonExistentDir, '.claude-code-lite')).then(
        () => true,
        () => false
      );
      expect(dirExists).toBe(true);
    });

    it('appends messages as JSONL format (one JSON per line)', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      await appendTranscript(tempDir, sessionId, messages);

      const filePath = getTranscriptPath(tempDir, sessionId);
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(messages[0]);
      expect(JSON.parse(lines[1])).toEqual(messages[1]);
    });

    it('handles empty message array', async () => {
      await appendTranscript(tempDir, sessionId, []);

      const filePath = getTranscriptPath(tempDir, sessionId);
      const content = await fs.readFile(filePath, 'utf8');

      // File should either be empty or contain just a newline
      expect(content === '' || content === '\n').toBe(true);
    });

    it('appends multiple times correctly', async () => {
      const messages1: Message[] = [{ role: 'user', content: 'First' }];
      await appendTranscript(tempDir, sessionId, messages1);

      const messages2: Message[] = [{ role: 'assistant', content: 'Second' }];
      await appendTranscript(tempDir, sessionId, messages2);

      const filePath = getTranscriptPath(tempDir, sessionId);
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);
    });

    it('handles complex message objects with all fields', async () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: 'Analyze this file',
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: 'Sure, I can do that.',
          toolsUsed: ['Read'],
        },
      ];

      await appendTranscript(tempDir, sessionId, messages);

      const filePath = getTranscriptPath(tempDir, sessionId);
      const loadedMessages = await readTranscriptMessages(tempDir, sessionId);

      expect(loadedMessages).toEqual(messages);
    });
  });

  describe('readTranscriptMessages', () => {
    it('reads messages correctly after append', async () => {
      const originalMessages: Message[] = [
        { role: 'user', content: 'Test message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Test message 2' },
      ];

      await appendTranscript(tempDir, sessionId, originalMessages);
      const loadedMessages = await readTranscriptMessages(tempDir, sessionId);

      expect(loadedMessages).toEqual(originalMessages);
    });

    it('handles non-existent transcript file gracefully', async () => {
      // Read from a session that was never written to
      const unknownSessionId = `non-existent-${Date.now()}`;

      try {
        await readTranscriptMessages(tempDir, unknownSessionId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Expect ENOENT or similar file not found error
        expect(error.code).toBe('ENOENT') || expect(error.message).toContain('no such file');
      }
    });

    it('filters out empty lines when reading', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Only one' }];
      await appendTranscript(tempDir, sessionId, messages);

      // Manually add some blank lines to the file
      const filePath = getTranscriptPath(tempDir, sessionId);
      await fs.appendFile(filePath, '\n\n', 'utf8');

      const loadedMessages = await readTranscriptMessages(tempDir, sessionId);
      expect(loadedMessages).toHaveLength(1);
    });

    it('handles messages with special characters in content', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello\nWorld\tTabbed' },
        { role: 'assistant', content: 'Unicode: \u00e9\u00fc\u00f1' },
      ];

      await appendTranscript(tempDir, sessionId, messages);
      const loadedMessages = await readTranscriptMessages(tempDir, sessionId);

      expect(loadedMessages).toEqual(messages);
    });
  });

  describe('deleteTranscript', () => {
    it('deletes transcript file successfully', async () => {
      const messages: Message[] = [{ role: 'user', content: 'To be deleted' }];
      await appendTranscript(tempDir, sessionId, messages);

      // Verify file exists before deletion
      const filePath = getTranscriptPath(tempDir, sessionId);
      let fileExists = await fs.stat(filePath).then(() => true, () => false);
      expect(fileExists).toBe(true);

      // Delete the transcript
      await deleteTranscript(tempDir, sessionId);

      // Verify file is gone
      fileExists = await fs.stat(filePath).then(() => true, () => false);
      expect(fileExists).toBe(false);
    });

    it('handles deletion of non-existent transcript (no error)', async () => {
      const unknownSessionId = `non-existent-${Date.now()}`;

      // Should not throw even if file doesn't exist
      await expect(deleteTranscript(tempDir, unknownSessionId)).resolves.toBeUndefined();
    });

    it('does not delete other transcripts', async () => {
      const session1 = `session-1-${Date.now()}`;
      const session2 = `session-2-${Date.now()}`;

      await appendTranscript(tempDir, session1, [{ role: 'user', content: 'Session 1' }]);
      await appendTranscript(tempDir, session2, [{ role: 'user', content: 'Session 2' }]);

      await deleteTranscript(tempDir, session1);

      // Session 2 should still exist
      const messages = await readTranscriptMessages(tempDir, session2);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Session 2');
    });
  });

  describe('end-to-end transcript workflow', () => {
    it('complete cycle: append -> read -> delete', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Start session' },
        { role: 'assistant', content: 'Ready to help' },
        { role: 'user', content: 'End session' },
      ];

      // Append
      await appendTranscript(tempDir, sessionId, messages);

      // Read back
      const loaded = await readTranscriptMessages(tempDir, sessionId);
      expect(loaded).toEqual(messages);

      // Delete
      await deleteTranscript(tempDir, sessionId);

      // Verify deletion
      try {
        await readTranscriptMessages(tempDir, sessionId);
        expect.fail('Should have thrown after deletion');
      } catch {
        // Expected - file should be gone
      }
    });

    it('handles large number of messages', async () => {
      const messages: Message[] = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      await appendTranscript(tempDir, sessionId, messages);
      const loaded = await readTranscriptMessages(tempDir, sessionId);

      expect(loaded).toHaveLength(100);
      expect(loaded).toEqual(messages);
    });
  });
});

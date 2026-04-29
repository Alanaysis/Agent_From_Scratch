import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  readSessionInfo,
  updateSessionInfo,
  listSessions,
  deleteSessionInfo,
  type SessionInfo,
} from '../../../storage/sessionIndex';

describe('sessionIndex', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-index-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('readSessionInfo', () => {
    it('returns parsed session info when file exists', async () => {
      const sessionId = 'test-session-123';
      const expectedInfo: SessionInfo = {
        id: sessionId,
        title: 'Test Session',
        summary: 'A test session',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 5,
      };

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`),
        JSON.stringify(expectedInfo)
      );

      const result = await readSessionInfo(tempDir, sessionId);

      expect(result).toEqual(expectedInfo);
    });

    it('returns null when session file does not exist', async () => {
      const result = await readSessionInfo(tempDir, 'non-existent-session');
      expect(result).toBeNull();
    });

    it('returns null when sessions directory does not exist', async () => {
      const result = await readSessionInfo(tempDir, 'any-session');
      expect(result).toBeNull();
    });

    it('handles malformed JSON gracefully', async () => {
      const sessionId = 'malformed-session';
      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`),
        '{ invalid json }'
      );

      const result = await readSessionInfo(tempDir, sessionId);
      expect(result).toBeNull();
    });
  });

  describe('updateSessionInfo', () => {
    it('creates new session info file when none exists', async () => {
      const sessionId = 'new-session';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'Hello' },
        { id: '2', type: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.id).toBe(sessionId);
      expect(result.title).toContain('Hello');
      expect(result.messageCount).toBe(2);
      expect(result.status).toBe('ready');
    });

    it('preserves createdAt when updating existing session', async () => {
      const sessionId = 'existing-session';
      const previousInfo: SessionInfo = {
        id: sessionId,
        title: 'Previous Title',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`),
        JSON.stringify(previousInfo)
      );

      const messages: any[] = [
        { id: '1', type: 'user', content: 'New message' },
      ];

      await updateSessionInfo(tempDir, sessionId, messages);

      // Read back and verify createdAt is preserved
      const updated = await readSessionInfo(tempDir, sessionId)!;
      expect(updated.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('updates updatedAt on each update', async () => {
      const sessionId = 'update-test';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'Test' },
      ];

      await updateSessionInfo(tempDir, sessionId, messages);
      const firstUpdate = await readSessionInfo(tempDir, sessionId)!;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await updateSessionInfo(tempDir, sessionId, messages);
      const secondUpdate = await readSessionInfo(tempDir, sessionId)!;

      expect(secondUpdate.updatedAt >= firstUpdate.updatedAt).toBe(true);
    });

    it('derives session title from first user message', async () => {
      const sessionId = 'title-test';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'First prompt here' },
        { id: '2', type: 'user', content: 'Second prompt' },
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.title).toContain('First prompt');
    });

    it('sets status to ready when no errors', async () => {
      const sessionId = 'ready-status';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'Test' },
        { id: '2', type: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: {} }] },
        { id: '3', type: 'tool_result', toolUseId: '1', content: '{"data": "result"}' },
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.status).toBe('ready');
    });

    it('sets status to needs_attention when error exists', async () => {
      const sessionId = 'error-status';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'Test' },
        { id: '2', type: 'assistant', content: [{ type: 'tool_use', name: 'Shell', input: {} }] },
        { id: '3', type: 'tool_result', toolUseId: '1', content: '{"error": "Command failed"}', isError: true },
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.status).toBe('needs_attention');
    });

    it('tracks tool use count', async () => {
      const sessionId = 'tool-count';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'Test' },
        { id: '2', type: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: {} }] },
        { id: '3', type: 'assistant', content: [{ type: 'text', text: 'Result' }] },
        { id: '4', type: 'assistant', content: [
          { type: 'tool_use', name: 'Shell', input: {} },
          { type: 'tool_use', name: 'Write', input: {} },
        ]},
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.toolUseCount).toBe(3);
    });

    it('tracks error count', async () => {
      const sessionId = 'error-count';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'Test' },
        { id: '2', type: 'tool_result', toolUseId: '1', content: '{"error": "err1"}', isError: true },
        { id: '3', type: 'tool_result', toolUseId: '2', content: '{"error": "err2"}', isError: true },
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.errorCount).toBe(2);
    });

    it('stores first and last prompts', async () => {
      const sessionId = 'prompts';
      const messages: any[] = [
        { id: '1', type: 'user', content: 'First prompt' },
        { id: '2', type: 'assistant', content: [{ type: 'text', text: 'Response' }] },
        { id: '3', type: 'user', content: 'Last prompt here' },
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.firstPrompt).toContain('First prompt');
      expect(result.lastPrompt).toContain('Last prompt');
    });

    it('respects configured provider and model from env', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      const originalModel = process.env.CCL_LLM_MODEL;

      try {
        process.env.CCL_LLM_PROVIDER = 'test-provider';
        process.env.CCL_LLM_MODEL = 'test-model-v1';

        const sessionId = 'env-test';
        const messages: any[] = [
          { id: '1', type: 'user', content: 'Test' },
        ];

        const result = await updateSessionInfo(tempDir, sessionId, messages);

        expect(result.provider).toBe('test-provider');
        expect(result.model).toBe('test-model-v1');
      } finally {
        // Restore original env vars
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        if (originalModel !== undefined) {
          process.env.CCL_LLM_MODEL = originalModel;
        } else {
          delete process.env.CCL_LLM_MODEL;
        }
      }
    });

    it('preserves provider and model from previous session', async () => {
      const sessionId = 'preserve-test';
      const previousInfo: SessionInfo = {
        id: sessionId,
        provider: 'previous-provider',
        model: 'previous-model',
      };

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`),
        JSON.stringify(previousInfo)
      );

      // Clear env vars to test preservation
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      const originalModel = process.env.CCL_LLM_MODEL;
      delete process.env.CCL_LLM_PROVIDER;
      delete process.env.CCL_LLM_MODEL;

      try {
        const messages: any[] = [
          { id: '1', type: 'user', content: 'Test' },
        ];

        await updateSessionInfo(tempDir, sessionId, messages);
        const updated = await readSessionInfo(tempDir, sessionId)!;

        expect(updated.provider).toBe('previous-provider');
        expect(updated.model).toBe('previous-model');
      } finally {
        // Restore original env vars
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        if (originalModel !== undefined) {
          process.env.CCL_LLM_MODEL = originalModel;
        } else {
          delete process.env.CCL_LLM_MODEL;
        }
      }
    });

    it('summarizes long prompts to 120 characters', async () => {
      const sessionId = 'summary-test';
      const longPrompt = 'x'.repeat(200);
      const messages: any[] = [
        { id: '1', type: 'user', content: longPrompt },
      ];

      const result = await updateSessionInfo(tempDir, sessionId, messages);

      expect(result.firstPrompt?.length).toBeLessThanOrEqual(120);
    });

    it('creates sessions directory if missing', async () => {
      // Don't create the directory - let the function do it
      const newTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-dir-test-'));

      try {
        const sessionId = 'auto-create';
        const messages: any[] = [
          { id: '1', type: 'user', content: 'Test' },
        ];

        await updateSessionInfo(newTempDir, sessionId, messages);

        // Verify directory was created
        const dirExists = await fs.stat(path.join(newTempDir, '.claude-code-lite', 'sessions'))
          .then(() => true)
          .catch(() => false);

        expect(dirExists).toBe(true);

        await fs.rm(newTempDir, { recursive: true, force: true });
      } catch (e) {
        await fs.rm(newTempDir, { recursive: true, force: true });
        throw e;
      }
    });
  });

  describe('listSessions', () => {
    it('returns empty array when no sessions exist', async () => {
      const result = await listSessions(tempDir);
      expect(result).toEqual([]);
    });

    it('lists only .json files from sessions directory', async () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      const notASessionId = 'not-a-session-txt'; // Should be ignored

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId1}.json`),
        JSON.stringify({ id: sessionId1 })
      );
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId2}.json`),
        JSON.stringify({ id: sessionId2 })
      );
      // Create a non-json file that should be ignored
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${notASessionId}.txt`),
        'should be ignored'
      );

      const result = await listSessions(tempDir);

      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toContain(sessionId1);
      expect(result.map(s => s.id)).toContain(sessionId2);
    });

    it('includes sessions from transcript files when metadata missing', async () => {
      const sessionId = 'transcript-only';

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'transcripts'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'transcripts', `${sessionId}.jsonl`),
        JSON.stringify({ id: '1', type: 'user', content: 'Hello' }) + '\n'
      );

      const result = await listSessions(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(sessionId);
      expect(result[0].title).toContain('Hello');
    });

    it('sorts sessions by updatedAt (newest first)', async () => {
      const sessionOld = 'old-session';
      const sessionNew = 'new-session';

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });

      // Create old session first
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionOld}.json`),
        JSON.stringify({ id: sessionOld, updatedAt: '2024-01-01T00:00:00.000Z' })
      );

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionNew}.json`),
        JSON.stringify({ id: sessionNew, updatedAt: '2024-12-31T23:59:59.999Z' })
      );

      const result = await listSessions(tempDir);

      expect(result[0].id).toBe(sessionNew);
      expect(result[1].id).toBe(sessionOld);
    });

    it('sorts needs_attention sessions before ready ones', async () => {
      const readySession = 'ready-session';
      const attentionSession = 'attention-session';

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });

      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${readySession}.json`),
        JSON.stringify({ id: readySession, status: 'ready', updatedAt: '2024-12-31T23:59:59.999Z' })
      );

      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${attentionSession}.json`),
        JSON.stringify({ id: attentionSession, status: 'needs_attention', updatedAt: '2024-01-01T00:00:00.000Z' })
      );

      const result = await listSessions(tempDir);

      expect(result[0].id).toBe(attentionSession);
      expect(result[1].id).toBe(readySession);
    });

    it('handles missing sessions directory gracefully', async () => {
      // Don't create the directory
      const newTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-sessions-dir-'));

      try {
        const result = await listSessions(newTempDir);
        expect(result).toEqual([]);

        await fs.rm(newTempDir, { recursive: true, force: true });
      } catch (e) {
        await fs.rm(newTempDir, { recursive: true, force: true });
        throw e;
      }
    });

    it('handles missing transcripts directory gracefully', async () => {
      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      // Don't create transcripts dir

      const result = await listSessions(tempDir);
      expect(result).toEqual([]);
    });

    it('handles malformed transcript entries gracefully', async () => {
      const sessionId = 'malformed-transcript';

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'transcripts'), { recursive: true });
      // Write malformed JSON in transcript
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'transcripts', `${sessionId}.jsonl`),
        '{ invalid json }\n' + JSON.stringify({ id: '1', type: 'user', content: 'Valid line' })
      );

      const result = await listSessions(tempDir);

      // Should still include the session, just without title from malformed entry
      expect(result).toHaveLength(1);
    });

    it('uses transcript mtime when no updatedAt in metadata', async () => {
      const sessionId = 'mtime-test';

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      // Create session with minimal info (no updatedAt)
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`),
        JSON.stringify({ id: sessionId })
      );

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'transcripts'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'transcripts', `${sessionId}.jsonl`),
        JSON.stringify({ id: '1', type: 'user', content: 'Test' }) + '\n'
      );

      const result = await listSessions(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].updatedAt).toBeDefined();
    });
  });

  describe('deleteSessionInfo', () => {
    it('deletes session info file when it exists', async () => {
      const sessionId = 'to-delete';
      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`),
        JSON.stringify({ id: sessionId })
      );

      await deleteSessionInfo(tempDir, sessionId);

      const exists = await fs.stat(path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`))
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(false);
    });

    it('does not throw when file does not exist (force: true)', async () => {
      const sessionId = 'non-existent';

      // Should not throw even though file doesn't exist
      await expect(deleteSessionInfo(tempDir, sessionId)).resolves.toBeUndefined();
    });

    it('deletes only session info, not transcript', async () => {
      const sessionId = 'partial-delete';

      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'sessions'), { recursive: true });
      await fs.mkdir(path.join(tempDir, '.claude-code-lite', 'transcripts'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`),
        JSON.stringify({ id: sessionId })
      );
      const transcriptPath = path.join(tempDir, '.claude-code-lite', 'transcripts', `${sessionId}.jsonl`);
      await fs.writeFile(transcriptPath, JSON.stringify({ id: '1' }));

      await deleteSessionInfo(tempDir, sessionId);

      // Session info should be gone
      const sessionExists = await fs.stat(path.join(tempDir, '.claude-code-lite', 'sessions', `${sessionId}.json`))
        .then(() => true)
        .catch(() => false);

      // Transcript should still exist (only session info is deleted)
      const transcriptExists = await fs.stat(transcriptPath)
        .then(() => true)
        .catch(() => false);

      expect(sessionExists).toBe(false);
      expect(transcriptExists).toBe(true);
    });
  });

  describe('integration: full session lifecycle', () => {
    it('complete cycle: create, update, list, delete', async () => {
      const sessionId = 'lifecycle-test';

      // Create
      const messages: any[] = [
        { id: '1', type: 'user', content: 'Initial prompt' },
        { id: '2', type: 'assistant', content: [{ type: 'text', text: 'Response' }] },
      ];

      let result = await updateSessionInfo(tempDir, sessionId, messages);
      expect(result.id).toBe(sessionId);

      // List should find it
      const sessions = await listSessions(tempDir);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(sessionId);

      // Update again (messageCount reflects total messages array length)
      result = await updateSessionInfo(tempDir, sessionId, messages);
      expect(result.messageCount).toBe(2);

      // Delete
      await deleteSessionInfo(tempDir, sessionId);

      // Should no longer appear in list
      const afterDelete = await listSessions(tempDir);
      expect(afterDelete).toHaveLength(0);
    });
  });
});

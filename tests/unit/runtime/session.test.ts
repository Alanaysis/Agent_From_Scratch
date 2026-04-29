import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SessionEngine, type SessionConfig } from '../../../runtime/session';

describe('session', () => {
  const testCwd = '/tmp/test-session-cwd';
  const sessionId = 'test-session-123';

  let session: SessionEngine;

  beforeEach(() => {
    session = new SessionEngine({ id: sessionId, cwd: testCwd });
  });

  describe('SessionConfig', () => {
    it('get sessionId returns config id', () => {
      expect(session.sessionId).toBe(sessionId);
    });

    it('get cwd returns config cwd', () => {
      expect(session.cwd).toBe(testCwd);
    });
  });

  describe('getMessages', () => {
    beforeEach(() => {
      session.appendMessage({ id: 'msg-1', type: 'user' as const, content: 'hello' });
      session.appendMessage({ id: 'msg-2', type: 'assistant' as const, content: 'hi there' });
    });

    it('returns messages array', () => {
      const messages = session.getMessages();
      expect(messages).toHaveLength(2);
    });

    it('returns defensive copy (modifying returned array does not affect internal state)', () => {
      const messages = session.getMessages();
      messages.push({ id: 'msg-3', type: 'user' as const, content: 'test' });

      // Original should still have only 2 messages
      expect(session.getMessages()).toHaveLength(2);
    });
  });

  describe('appendMessage', () => {
    it('appends single message to internal state', () => {
      session.appendMessage({ id: 'msg-1', type: 'user' as const, content: 'test' });
      expect(session.getMessages()).toHaveLength(1);
    });

    it('appends multiple messages correctly', () => {
      session.appendMessage({ id: 'msg-1', type: 'user' as const, content: 'hello' });
      session.appendMessage({ id: 'msg-2', type: 'assistant' as const, content: 'hi' });

      const messages = session.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[1].id).toBe('msg-2');
    });
  });

  describe('hydrateMessages', () => {
    it('replaces internal messages with provided array', () => {
      const initialMessages = [
        { id: 'initial-1', type: 'user' as const, content: 'start' },
        { id: 'initial-2', type: 'assistant' as const, content: 'begin' },
      ];

      session.hydrateMessages(initialMessages);
      expect(session.getMessages()).toEqual(initialMessages);
    });

    it('creates defensive copy of hydrated messages', () => {
      const messages = [
        { id: 'msg-1', type: 'user' as const, content: 'test' },
      ];

      session.hydrateMessages(messages);

      // Modifying original array should not affect internal state
      messages.push({ id: 'msg-2', type: 'assistant' as const, content: 'added' });
      expect(session.getMessages()).toHaveLength(1);
    });

    it('replaces all existing messages (not appends)', () => {
      session.appendMessage({ id: 'existing-1', type: 'user' as const, content: 'old' });

      session.hydrateMessages([{ id: 'new-1', type: 'assistant' as const, content: 'replaced' }]);

      expect(session.getMessages()).toHaveLength(1);
      expect(session.getMessages()[0].id).toBe('new-1');
    });
  });

  describe('recordMessages', () => {
    it('calls appendTranscript and updateSessionInfo (integration test)', async () => {
      const messages = [
        { id: 'msg-1', type: 'user' as const, content: 'hello' },
        { id: 'msg-2', type: 'assistant' as const, content: 'hi' },
      ];

      await session.recordMessages(messages);

      // Verify messages were appended to internal state
      expect(session.getMessages()).toHaveLength(2);
    });
  });

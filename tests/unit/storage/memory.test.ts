import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  loadMemory,
  saveMemory,
  rebuildMemoryFromKnowledge,
  getMemoryForSystemPrompt,
} from '../../../storage/memory';
import { addKnowledge } from '../../../storage/knowledge';

const TEST_DIR = join('/tmp', 'memory-test-' + Date.now());

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.irg'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('Memory', () => {
  describe('loadMemory', () => {
    it('returns empty string when no memory file exists', async () => {
      const memory = await loadMemory(TEST_DIR);
      expect(memory).toBe('');
    });

    it('loads existing memory content', async () => {
      await saveMemory(TEST_DIR, 'Test memory content');
      const memory = await loadMemory(TEST_DIR);
      expect(memory).toBe('Test memory content');
    });
  });

  describe('saveMemory', () => {
    it('saves memory content to file', async () => {
      await saveMemory(TEST_DIR, 'Saved memory');
      const memory = await loadMemory(TEST_DIR);
      expect(memory).toBe('Saved memory');
    });

    it('truncates content exceeding 3575 character limit', async () => {
      const longContent = 'x'.repeat(4000);
      await saveMemory(TEST_DIR, longContent);
      const memory = await loadMemory(TEST_DIR);
      expect(memory.length).toBeLessThanOrEqual(3575);
    });

    it('creates directory if it does not exist', async () => {
      const newDir = join(TEST_DIR, 'new-subdir');
      await mkdir(newDir, { recursive: true });
      await saveMemory(newDir, 'Test');
      const memory = await loadMemory(newDir);
      expect(memory).toBe('Test');
    });
  });

  describe('rebuildMemoryFromKnowledge', () => {
    it('rebuilds memory from knowledge store', async () => {
      await addKnowledge(TEST_DIR, 'fact', 'TypeScript project', 'user_explicit', ['typescript']);
      await addKnowledge(TEST_DIR, 'anti_pattern', 'Avoid any type', 'agent_reflection', ['typescript']);

      const memory = await rebuildMemoryFromKnowledge(TEST_DIR);
      expect(memory).toContain('PERSISTENT KNOWLEDGE');
      expect(memory).toContain('TypeScript project');
      expect(memory).toContain('Avoid any type');
    });

    it('returns empty string when no knowledge', async () => {
      const memory = await rebuildMemoryFromKnowledge(TEST_DIR);
      expect(memory).toBe('');
    });
  });

  describe('getMemoryForSystemPrompt', () => {
    it('returns existing memory if available', async () => {
      await saveMemory(TEST_DIR, 'Existing memory');
      const memory = await getMemoryForSystemPrompt(TEST_DIR);
      expect(memory).toBe('Existing memory');
    });

    it('rebuilds from knowledge when no memory file', async () => {
      await addKnowledge(TEST_DIR, 'fact', 'Auto-rebuilt fact', 'user_explicit');
      const memory = await getMemoryForSystemPrompt(TEST_DIR);
      expect(memory).toContain('Auto-rebuilt fact');
    });
  });
});

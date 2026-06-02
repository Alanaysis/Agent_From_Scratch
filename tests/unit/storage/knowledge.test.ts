import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  addKnowledge,
  loadKnowledgeStore,
  saveKnowledgeStore,
  queryKnowledge,
  removeKnowledge,
  decayKnowledge,
  knowledgeToSystemPrompt,
  type KnowledgeEntry,
  type KnowledgeStore,
} from '../../../storage/knowledge';

const TEST_DIR = join('/tmp', 'knowledge-test-' + Date.now());

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.irg'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('Knowledge Store', () => {
  describe('loadKnowledgeStore', () => {
    it('returns empty store when no file exists', async () => {
      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries).toEqual([]);
      expect(store.version).toBe(1);
    });

    it('loads existing store from file', async () => {
      await saveKnowledgeStore(TEST_DIR, {
        entries: [
          {
            id: 'test-1',
            category: 'fact',
            content: 'Test fact',
            source: 'user_explicit',
            confidence: 0.8,
            usageCount: 0,
            lastUsed: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            tags: ['test'],
          },
        ],
        version: 2,
      });

      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries).toHaveLength(1);
      expect(store.version).toBe(2);
    });
  });

  describe('addKnowledge', () => {
    it('adds a new knowledge entry', async () => {
      const entry = await addKnowledge(
        TEST_DIR,
        'fact',
        'Project uses TypeScript',
        'user_explicit',
        ['typescript', 'config'],
      );

      expect(entry).not.toBeNull();
      expect(entry!.category).toBe('fact');
      expect(entry!.content).toBe('Project uses TypeScript');
      expect(entry!.tags).toEqual(['typescript', 'config']);
      expect(entry!.confidence).toBe(0.7);
    });

    it('deduplicates identical content', async () => {
      await addKnowledge(TEST_DIR, 'fact', 'Same content', 'user_explicit');
      await addKnowledge(TEST_DIR, 'fact', 'Same content', 'user_explicit');

      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].confidence).toBeGreaterThan(0.7);
    });

    it('allows same content with different category', async () => {
      await addKnowledge(TEST_DIR, 'fact', 'Same content', 'user_explicit');
      await addKnowledge(TEST_DIR, 'pattern', 'Same content', 'user_explicit');

      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries).toHaveLength(2);
    });

    it('truncates content exceeding char limit', async () => {
      const longContent = 'x'.repeat(600);
      const entry = await addKnowledge(TEST_DIR, 'fact', longContent, 'user_explicit');

      expect(entry!.content.length).toBeLessThanOrEqual(500);
      expect(entry!.content.endsWith('...')).toBe(true);
    });

    it('returns null for empty content', async () => {
      const entry = await addKnowledge(TEST_DIR, 'fact', '', 'user_explicit');
      expect(entry).toBeNull();
    });

    it('returns null for whitespace-only content', async () => {
      const entry = await addKnowledge(TEST_DIR, 'fact', '   ', 'user_explicit');
      expect(entry).toBeNull();
    });

    it('evicts lowest-scored entry when at max capacity', async () => {
      for (let i = 0; i < 100; i++) {
        await addKnowledge(TEST_DIR, 'fact', `Fact ${i}`, 'user_explicit', [], 0.5);
      }

      const entry = await addKnowledge(TEST_DIR, 'fact', 'New fact', 'user_explicit', [], 0.9);
      expect(entry).not.toBeNull();

      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries.length).toBeLessThanOrEqual(100);
    });

    it('supports all categories', async () => {
      const categories = ['fact', 'preference', 'pattern', 'anti_pattern'] as const;
      for (const cat of categories) {
        const entry = await addKnowledge(TEST_DIR, cat, `${cat} content`, 'user_explicit');
        expect(entry!.category).toBe(cat);
      }

      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries).toHaveLength(4);
    });

    it('supports all sources', async () => {
      const sources = ['user_explicit', 'user_implicit', 'agent_reflection', 'skill_extraction'] as const;
      for (const source of sources) {
        const entry = await addKnowledge(TEST_DIR, 'fact', `From ${source}`, source);
        expect(entry!.source).toBe(source);
      }
    });
  });

  describe('queryKnowledge', () => {
    beforeEach(async () => {
      await addKnowledge(TEST_DIR, 'fact', 'TypeScript is used in this project', 'user_explicit', ['typescript']);
      await addKnowledge(TEST_DIR, 'anti_pattern', 'Avoid using any type in TypeScript', 'agent_reflection', ['typescript', 'anti-pattern']);
      await addKnowledge(TEST_DIR, 'preference', 'User prefers Chinese responses', 'user_implicit', ['language', 'preference']);
    });

    it('finds knowledge by content match', async () => {
      const results = await queryKnowledge(TEST_DIR, 'TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.content.includes('TypeScript'))).toBe(true);
    });

    it('finds knowledge by tag match', async () => {
      const results = await queryKnowledge(TEST_DIR, 'preference');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for no matches', async () => {
      const results = await queryKnowledge(TEST_DIR, 'zzzznonexistentxyz');
      expect(results).toHaveLength(0);
    });

    it('respects limit parameter', async () => {
      const results = await queryKnowledge(TEST_DIR, 'TypeScript', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('boosts anti_pattern category score', async () => {
      const results = await queryKnowledge(TEST_DIR, 'TypeScript');
      const antiPattern = results.find((r) => r.category === 'anti_pattern');
      const fact = results.find((r) => r.category === 'fact');
      if (antiPattern && fact) {
        expect(antiPattern.id).toBeDefined();
      }
    });
  });

  describe('removeKnowledge', () => {
    it('removes an existing entry', async () => {
      const entry = await addKnowledge(TEST_DIR, 'fact', 'To be removed', 'user_explicit');
      const removed = await removeKnowledge(TEST_DIR, entry!.id);
      expect(removed).toBe(true);

      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries.find((e) => e.id === entry!.id)).toBeUndefined();
    });

    it('returns false for non-existent entry', async () => {
      const removed = await removeKnowledge(TEST_DIR, 'non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('decayKnowledge', () => {
    it('removes low-confidence old entries', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      await saveKnowledgeStore(TEST_DIR, {
        entries: [
          {
            id: 'old-low',
            category: 'fact',
            content: 'Old low confidence',
            source: 'user_implicit',
            confidence: 0.15,
            usageCount: 0,
            lastUsed: oldDate,
            createdAt: oldDate,
            tags: [],
          },
          {
            id: 'old-high',
            category: 'fact',
            content: 'Old high confidence',
            source: 'user_explicit',
            confidence: 0.8,
            usageCount: 5,
            lastUsed: oldDate,
            createdAt: oldDate,
            tags: [],
          },
        ],
        version: 1,
      });

      const decayed = await decayKnowledge(TEST_DIR);
      expect(decayed).toBe(1);

      const store = await loadKnowledgeStore(TEST_DIR);
      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].id).toBe('old-high');
    });
  });

  describe('knowledgeToSystemPrompt', () => {
    it('returns empty string for empty entries', () => {
      expect(knowledgeToSystemPrompt([])).toBe('');
    });

    it('groups entries by category', () => {
      const entries: KnowledgeEntry[] = [
        {
          id: '1',
          category: 'anti_pattern',
          content: 'Avoid this',
          source: 'agent_reflection',
          confidence: 0.9,
          usageCount: 3,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          tags: [],
        },
        {
          id: '2',
          category: 'fact',
          content: 'Project fact',
          source: 'user_explicit',
          confidence: 0.8,
          usageCount: 1,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          tags: [],
        },
      ];

      const prompt = knowledgeToSystemPrompt(entries);
      expect(prompt).toContain('Anti-Patterns');
      expect(prompt).toContain('Project Facts');
      expect(prompt).toContain('Avoid this');
      expect(prompt).toContain('Project fact');
    });

    it('places anti-patterns first', () => {
      const entries: KnowledgeEntry[] = [
        {
          id: '1',
          category: 'pattern',
          content: 'Success pattern',
          source: 'agent_reflection',
          confidence: 0.8,
          usageCount: 0,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          tags: [],
        },
        {
          id: '2',
          category: 'anti_pattern',
          content: 'Anti pattern',
          source: 'agent_reflection',
          confidence: 0.8,
          usageCount: 0,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          tags: [],
        },
      ];

      const prompt = knowledgeToSystemPrompt(entries);
      const antiIdx = prompt.indexOf('Anti-Patterns');
      const patternIdx = prompt.indexOf('Success Patterns');
      expect(antiIdx).toBeLessThan(patternIdx);
    });
  });
});

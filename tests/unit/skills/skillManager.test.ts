import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  createSkill,
  readSkill,
  patchSkill,
  listUserSkills,
  deprecateSkill,
  deleteSkill,
  recordSkillUsage,
} from '../../../skills/skillManager';

const TEST_DIR = join('/tmp', 'skill-mgr-test-' + Date.now());

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.claude-code-lite', 'skills'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('SkillManager', () => {
  describe('createSkill', () => {
    it('creates a new skill file', async () => {
      const skill = await createSkill(
        TEST_DIR,
        'test-skill',
        '# Test Skill\n\nDo something useful.',
        ['test', 'skill'],
      );

      expect(skill.name).toBe('test-skill');
      expect(skill.trigger).toEqual(['test', 'skill']);
      expect(skill.content).toContain('Test Skill');
      expect(skill.frontmatter.version).toBe(1);
    });

    it('sanitizes skill name', async () => {
      const skill = await createSkill(
        TEST_DIR,
        'My Cool Skill!!!',
        'Content',
        ['trigger'],
      );

      expect(skill.name).toBe('my-cool-skill');
    });

    it('records evolution history', async () => {
      const skill = await createSkill(
        TEST_DIR,
        'evolved-skill',
        'Content',
        ['evolved'],
        undefined,
        'auto',
      );

      expect(skill.frontmatter.evolutionHistory).toHaveLength(1);
      expect(skill.frontmatter.evolutionHistory![0].changeType).toBe('created');
      expect(skill.frontmatter.evolutionHistory![0].trigger).toBe('auto');
    });

    it('supports allowedTools', async () => {
      const skill = await createSkill(
        TEST_DIR,
        'restricted-skill',
        'Content',
        ['restricted'],
        ['Read', 'SearchFiles'],
      );

      expect(skill.frontmatter.allowedTools).toEqual(['Read', 'SearchFiles']);
    });
  });

  describe('readSkill', () => {
    it('reads an existing skill', async () => {
      await createSkill(TEST_DIR, 'readable', 'Content', ['read']);
      const skill = await readSkill(TEST_DIR, 'readable');

      expect(skill).not.toBeNull();
      expect(skill!.name).toBe('readable');
    });

    it('returns null for non-existent skill', async () => {
      const skill = await readSkill(TEST_DIR, 'non-existent');
      expect(skill).toBeNull();
    });

    it('is case-insensitive', async () => {
      await createSkill(TEST_DIR, 'Case-Test', 'Content', ['case']);
      const skill = await readSkill(TEST_DIR, 'case-test');
      expect(skill).not.toBeNull();
    });
  });

  describe('patchSkill', () => {
    it('patches content of existing skill', async () => {
      await createSkill(TEST_DIR, 'patchable', 'Original content', ['patch']);

      const patched = await patchSkill(
        TEST_DIR,
        'patchable',
        { content: 'Updated content' },
        'Updated for better results',
        'auto',
      );

      expect(patched).not.toBeNull();
      expect(patched!.content).toBe('Updated content');
      expect(patched!.frontmatter.version).toBe(2);
    });

    it('records patch in evolution history', async () => {
      await createSkill(TEST_DIR, 'history-skill', 'Original', ['history']);

      const patched = await patchSkill(
        TEST_DIR,
        'history-skill',
        { content: 'Patched' },
        'Bug fix',
        'user',
      );

      expect(patched!.frontmatter.evolutionHistory).toHaveLength(2);
      expect(patched!.frontmatter.evolutionHistory![1].changeType).toBe('patched');
      expect(patched!.frontmatter.evolutionHistory![1].trigger).toBe('user');
    });

    it('returns null for non-existent skill', async () => {
      const result = await patchSkill(TEST_DIR, 'no-skill', { content: 'x' }, 'test');
      expect(result).toBeNull();
    });
  });

  describe('listUserSkills', () => {
    it('lists all user skills', async () => {
      await createSkill(TEST_DIR, 'skill-a', 'A', ['a']);
      await createSkill(TEST_DIR, 'skill-b', 'B', ['b']);

      const skills = await listUserSkills(TEST_DIR);
      expect(skills).toHaveLength(2);
    });

    it('returns empty array when no skills', async () => {
      const skills = await listUserSkills(TEST_DIR);
      expect(skills).toEqual([]);
    });
  });

  describe('deprecateSkill', () => {
    it('marks skill as deprecated', async () => {
      await createSkill(TEST_DIR, 'deprecate-me', 'Content', ['dep']);

      const result = await deprecateSkill(TEST_DIR, 'deprecate-me', 'No longer needed');
      expect(result).toBe(true);

      const skill = await readSkill(TEST_DIR, 'deprecate-me');
      expect(skill!.content).toContain('DEPRECATED');
      expect(skill!.content).toContain('No longer needed');
    });

    it('returns false for non-existent skill', async () => {
      const result = await deprecateSkill(TEST_DIR, 'no-skill', 'reason');
      expect(result).toBe(false);
    });
  });

  describe('deleteSkill', () => {
    it('deletes an existing skill', async () => {
      await createSkill(TEST_DIR, 'delete-me', 'Content', ['del']);

      const result = await deleteSkill(TEST_DIR, 'delete-me');
      expect(result).toBe(true);

      const skill = await readSkill(TEST_DIR, 'delete-me');
      expect(skill).toBeNull();
    });

    it('returns true even for non-existent skill', async () => {
      const result = await deleteSkill(TEST_DIR, 'no-skill');
      expect(result).toBe(true);
    });
  });

  describe('recordSkillUsage', () => {
    it('increments usage count', async () => {
      await createSkill(TEST_DIR, 'usage-skill', 'Content', ['usage']);

      await recordSkillUsage(TEST_DIR, 'usage-skill', true);
      await recordSkillUsage(TEST_DIR, 'usage-skill', true);
      await recordSkillUsage(TEST_DIR, 'usage-skill', false);

      const skill = await readSkill(TEST_DIR, 'usage-skill');
      expect(skill!.frontmatter.usageCount).toBe(3);
      expect(skill!.frontmatter.successCount).toBe(2);
      expect(skill!.frontmatter.failCount).toBe(1);
    });
  });
});

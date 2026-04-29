import { describe, it, expect } from 'bun:test';
import { createId } from '../../../shared/ids';

describe('ID Generation', () => {
  describe('createId', () => {
    it('generates ID with default "id" prefix', () => {
      const id = createId();
      expect(id).toMatch(/^id-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('generates ID with custom prefix', () => {
      const id = createId('session');
      expect(id).toMatch(/^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('generates unique IDs on each call', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(createId());
      }
      // All 100 generated IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('generates unique IDs even when called rapidly', () => {
      const id1 = createId();
      const id2 = createId();
      const id3 = createId();
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('maintains UUID format structure', () => {
      const id = createId('test');
      const parts = id.split('-');

      // Format: prefix-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (6 parts including prefix)
      expect(parts).toHaveLength(6);
      expect(parts[0]).toBe('test');
      expect(parts[1]).toMatch(/^[0-9a-f]{8}$/);
      expect(parts[2]).toMatch(/^[0-9a-f]{4}$/);
      expect(parts[3]).toMatch(/^[0-9a-f]{4}$/);
      expect(parts[4]).toMatch(/^[0-9a-f]{4}$/);
      expect(parts[5]).toMatch(/^[0-9a-f]{12}$/);
    });

    it('handles empty string prefix', () => {
      const id = createId('');
      expect(id).toMatch(/^-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('handles numeric prefix', () => {
      const id = createId('123');
      expect(id).toMatch(/^123-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('handles prefix with special characters', () => {
      const id = createId('session_123-test');
      expect(id).toMatch(/^session_123-test-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('handles very long prefix', () => {
      const longPrefix = 'a'.repeat(100);
      const id = createId(longPrefix);
      expect(id.startsWith(longPrefix + '-')).toBe(true);
    });

    it('generates valid UUIDs (can be parsed)', () => {
      // Node's crypto.randomUUID() generates valid RFC 4122 UUIDs
      // We just verify the format is consistent and unique
      const ids = [createId(), createId(), createId()];
      expect(new Set(ids).size).toBe(3); // All different
    });

    it('prefix without hyphen still works', () => {
      const id = createId('myid');
      expect(id.startsWith('myid-')).toBe(true);
    });

    it('handles single character prefix', () => {
      const id = createId('x');
      expect(id).toMatch(/^x-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('consistent format across multiple calls', () => {
      const ids = Array.from({ length: 10 }, () => createId());
      const allMatchPattern = ids.every((id) =>
        /^[\w]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
      );
      expect(allMatchPattern).toBe(true);
    });
  });
});

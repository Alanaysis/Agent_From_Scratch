import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { resolvePathSafe } from '../../../shared/fs';

describe('resolvePathSafe', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pathsafe-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('valid paths within cwd', () => {
    it('resolves simple relative path', () => {
      const result = resolvePathSafe('file.txt', tempDir);
      expect(result).toBe(path.resolve(tempDir, 'file.txt'));
    });

    it('resolves nested relative path', () => {
      const result = resolvePathSafe('src/utils/file.ts', tempDir);
      expect(result).toBe(path.resolve(tempDir, 'src/utils/file.ts'));
    });

    it('resolves current directory reference', () => {
      const result = resolvePathSafe('./file.txt', tempDir);
      expect(result).toBe(path.resolve(tempDir, 'file.txt'));
    });

    it('resolves absolute path within allowed root', () => {
      const absPath = path.join(tempDir, 'file.txt');
      const result = resolvePathSafe(absPath, tempDir);
      expect(result).toBe(absPath);
    });
  });

  describe('path traversal prevention', () => {
    it('blocks parent directory traversal', () => {
      expect(() => resolvePathSafe('../file.txt', tempDir)).toThrow(
        'Path outside allowed scope',
      );
    });

    it('blocks deep parent traversal', () => {
      expect(() => resolvePathSafe('../../etc/passwd', tempDir)).toThrow(
        'Path outside allowed scope',
      );
    });

    it('blocks traversal from nested path', () => {
      const nestedCwd = path.join(tempDir, 'a', 'b', 'c');
      expect(() => resolvePathSafe('../../../file.txt', nestedCwd)).toThrow(
        'Path outside allowed scope',
      );
    });

    it('blocks absolute path outside allowed roots', () => {
      expect(() => resolvePathSafe('/etc/passwd', tempDir)).toThrow(
        'Path outside allowed scope',
      );
    });
  });

  describe('custom allowed roots', () => {
    it('allows path within custom root when cwd is inside root', () => {
      const customRoot = path.join(tempDir, 'allowed');
      const nestedCwd = path.join(customRoot, 'subdir');
      const result = resolvePathSafe('file.txt', nestedCwd, [customRoot]);
      expect(result).toBe(path.resolve(nestedCwd, 'file.txt'));
    });

    it('blocks path when cwd is outside custom root', () => {
      const customRoot = path.join(tempDir, 'allowed');
      expect(() => resolvePathSafe('file.txt', tempDir, [customRoot])).toThrow(
        'Path outside allowed scope',
      );
    });

    it('allows path within multiple roots', () => {
      const root1 = path.join(tempDir, 'src');
      const root2 = path.join(tempDir, 'lib');
      const result = resolvePathSafe('file.txt', root1, [root1, root2]);
      expect(result).toBe(path.resolve(root1, 'file.txt'));
    });

    it('blocks path outside all custom roots', () => {
      const root1 = path.join(tempDir, 'src');
      const root2 = path.join(tempDir, 'lib');
      expect(() =>
        resolvePathSafe('../../etc/passwd', root1, [root1, root2]),
      ).toThrow('Path outside allowed scope');
    });
  });

  describe('edge cases', () => {
    it('handles empty input path (resolves to cwd)', () => {
      const result = resolvePathSafe('', tempDir);
      expect(result).toBe(path.resolve(tempDir));
    });

    it('normalizes redundant separators', () => {
      const result = resolvePathSafe('src//utils///file.ts', tempDir);
      expect(result).toBe(path.resolve(tempDir, 'src/utils/file.ts'));
    });

    it('normalizes dot segments that stay within root', () => {
      const result = resolvePathSafe('src/../src/file.ts', tempDir);
      expect(result).toBe(path.resolve(tempDir, 'src/file.ts'));
    });

    it('error message includes allowed roots', () => {
      try {
        resolvePathSafe('../file.txt', tempDir);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain('Path outside allowed scope');
        expect(e.message).toContain(tempDir);
      }
    });
  });
});

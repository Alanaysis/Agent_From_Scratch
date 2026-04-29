import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  createFileStateCache,
  resolvePathFromCwd,
  readTextFile,
  writeTextFile,
} from '../../../shared/fs';

describe('Filesystem Utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createFileStateCache', () => {
    it('creates empty Map cache by default', () => {
      const cache = createFileStateCache();
      expect(cache).toBeInstanceOf(Map);
      expect(cache.size).toBe(0);
    });

    it('returns a new instance each time (not shared)', () => {
      const cache1 = createFileStateCache();
      const cache2 = createFileStateCache();
      expect(cache1).not.toBe(cache2);
    });

    it('can store and retrieve string values', async () => {
      const cache: Map<string, string> = createFileStateCache();
      cache.set('/path/to/file.txt', 'file-content');
      expect(cache.get('/path/to/file.txt')).toBe('file-content');
    });

    it('returns undefined for non-existent keys', () => {
      const cache = createFileStateCache();
      expect(cache.get('/nonexistent/path')).toBeUndefined();
    });

    it('can delete entries', () => {
      const cache: Map<string, string> = createFileStateCache();
      cache.set('/path.txt', 'content');
      cache.delete('/path.txt');
      expect(cache.has('/path.txt')).toBe(false);
    });

    it('clears all entries with clear()', () => {
      const cache: Map<string, string> = createFileStateCache();
      cache.set('/a.txt', 'a');
      cache.set('/b.txt', 'b');
      expect(cache.size).toBe(2);
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('iterates over entries correctly', () => {
      const cache: Map<string, string> = createFileStateCache();
      cache.set('/file1.txt', 'content1');
      cache.set('/file2.txt', 'content2');

      const keys = Array.from(cache.keys());
      expect(keys).toContain('/file1.txt');
      expect(keys).toContain('/file2.txt');
    });
  });

  describe('resolvePathFromCwd', () => {
    it('resolves relative path to absolute using cwd', () => {
      const result = resolvePathFromCwd('/home/user/project', 'src/file.ts');
      expect(result).toBe(path.join('/home/user/project', 'src/file.ts'));
    });

    it('handles paths with trailing slashes in both arguments', () => {
      const result = resolvePathFromCwd('/home/user/project/', 'src/');
      expect(result).toContain('src');
    });

    it('returns absolute path if input is already absolute', () => {
      const absPath = '/absolute/path/to/file.txt';
      const result = resolvePathFromCwd('/cwd', absPath);
      // On Unix, absolute paths should remain unchanged or be normalized
      expect(result).toMatch(/\/absolute\/path\/to\/file\.txt$/);
    });

    it('handles parent directory references (..)', () => {
      const result = resolvePathFromCwd('/home/user/project', '../other/file.txt');
      expect(result).toContain('other/file.txt');
    });

    it('handles current directory reference (.)', () => {
      const result = resolvePathFromCwd('/home/user/project', './file.txt');
      expect(result.endsWith('file.txt')).toBe(true);
    });

    it('works with Windows-style paths on Unix (path.join normalizes)', () => {
      // path.resolve handles both styles, just tests that no error occurs
      const result = resolvePathFromCwd('/cwd', 'relative\\windows\\path');
      expect(typeof result).toBe('string');
    });

    it('handles empty relative path', () => {
      const result = resolvePathFromCwd('/home/user/project', '');
      expect(result).toBe('/home/user/project');
    });

    it('handles root path on Unix', () => {
      const result = resolvePathFromCwd('/', 'file.txt');
      expect(result).toBe('/file.txt');
    });
  });

  describe('readTextFile', () => {
    let testFilePath: string;

    beforeEach(async () => {
      testFilePath = path.join(tempDir, 'test-file.txt');
    });

    it('reads file content as UTF-8 string', async () => {
      const content = 'Hello, World!';
      await fs.writeFile(testFilePath, content, 'utf8');

      const result = await readTextFile(testFilePath);
      expect(result).toBe(content);
    });

    it('handles empty files', async () => {
      await fs.writeFile(testFilePath, '', 'utf8');
      const result = await readTextFile(testFilePath);
      expect(result).toBe('');
    });

    it('handles multiline content', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      await fs.writeFile(testFilePath, content, 'utf8');
      const result = await readTextFile(testFilePath);
      expect(result).toBe(content);
    });

    it('handles files with special characters', async () => {
      const content = 'Special: \n\t\r\\\"quotes\\\"\u00e9\u00fc';
      await fs.writeFile(testFilePath, content, 'utf8');
      const result = await readTextFile(testFilePath);
      expect(result).toBe(content);
    });

    it('handles unicode and emoji', async () => {
      const content = 'Unicode: \u4e2d\u6587 \ud55c\uc77c 🎉';
      await fs.writeFile(testFilePath, content, 'utf8');
      const result = await readTextFile(testFilePath);
      expect(result).toBe(content);
    });

    it('throws error for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');
      await expect(readTextFile(nonExistentPath)).rejects.toThrow();
    });

    it('handles large files', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB
      await fs.writeFile(testFilePath, largeContent, 'utf8');
      const result = await readTextFile(testFilePath);
      expect(result).toBe(largeContent);
    });

    it('preserves binary-like content encoded as string', async () => {
      // Note: This tests text mode reading, not actual binary files
      const content = 'Binary-like: \x00\x01\x02\xff\xfe';
      await fs.writeFile(testFilePath, content, 'utf8');
      const result = await readTextFile(testFilePath);
      expect(result).toBe(content);
    });
  });

  describe('writeTextFile', () => {
    it('creates file with provided content and returns byte length', async () => {
      const testPath = path.join(tempDir, 'created-file.txt');
      const content = 'Hello, World!';
      const bytesWritten = await writeTextFile(testPath, content);

      expect(bytesWritten).toBe(Buffer.byteLength(content, 'utf8'));

      // Verify file was created with correct content
      const readContent = await fs.readFile(testPath, 'utf8');
      expect(readContent).toBe(content);
    });

    it('creates parent directories if they do not exist', async () => {
      const nestedPath = path.join(tempDir, 'new', 'nested', 'dir', 'file.txt');
      await writeTextFile(nestedPath, 'content');

      // Verify file exists
      const stats = await fs.stat(nestedPath);
      expect(stats.isFile()).toBe(true);
    });

    it('overwrites existing files', async () => {
      const testPath = path.join(tempDir, 'overwrite.txt');
      await fs.writeFile(testPath, 'original content', 'utf8');

      await writeTextFile(testPath, 'new content');
      const readContent = await fs.readFile(testPath, 'utf8');
      expect(readContent).toBe('new content');
    });

    it('handles empty string content', async () => {
      const testPath = path.join(tempDir, 'empty.txt');
      const bytesWritten = await writeTextFile(testPath, '');

      expect(bytesWritten).toBe(0);

      const content = await fs.readFile(testPath, 'utf8');
      expect(content).toBe('');
    });

    it('handles multiline content', async () => {
      const testPath = path.join(tempDir, 'multiline.txt');
      const content = 'Line 1\nLine 2\nLine 3';
      await writeTextFile(testPath, content);

      const readContent = await fs.readFile(testPath, 'utf8');
      expect(readContent).toBe(content);
    });

    it('handles special characters correctly', async () => {
      const testPath = path.join(tempDir, 'special.txt');
      const content = 'Special: \n\t\r\\\"quotes\\\"\u00e9\u00fc';
      await writeTextFile(testPath, content);

      const readContent = await fs.readFile(testPath, 'utf8');
      expect(readContent).toBe(content);
    });

    it('handles unicode and emoji', async () => {
      const testPath = path.join(tempDir, 'unicode.txt');
      const content = 'Unicode: \u4e2d\u6587 \ud55c\uc77c 🎉';
      await writeTextFile(testPath, content);

      const readContent = await fs.readFile(testPath, 'utf8');
      expect(readContent).toBe(content);
    });

    it('returns correct byte length for unicode content', async () => {
      const testPath = path.join(tempDir, 'unicode-bytes.txt');
      // \u00e9 is 2 bytes in UTF-8
      const content = '\u00e9';
      const bytesWritten = await writeTextFile(testPath, content);

      expect(bytesWritten).toBe(2);

      const readContent = await fs.readFile(testPath, 'utf8');
      expect(readContent).toBe(content);
    });

    it('handles very large files', async () => {
      const testPath = path.join(tempDir, 'large.txt');
      const largeContent = 'x'.repeat(500000); // 500KB
      const bytesWritten = await writeTextFile(testPath, largeContent);

      expect(bytesWritten).toBe(Buffer.byteLength(largeContent, 'utf8'));

      const readContent = await fs.readFile(testPath, 'utf8');
      expect(readContent).toBe(largeContent);
    });

    it('handles files with null bytes in string', async () => {
      const testPath = path.join(tempDir, 'null-bytes.txt');
      const content = 'Start\x00Middle\x00End';
      await writeTextFile(testPath, content);

      // Read as buffer to verify exact bytes
      const bufferContent = await fs.readFile(testPath);
      expect(bufferContent.includes(Buffer.from('\x00'))).toBe(true);
    });
  });
});

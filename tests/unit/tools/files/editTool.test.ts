import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { EditTool, type EditInput } from '../../../../tools/files/editTool';
import { readTextFile, resolvePathFromCwd, writeTextFile } from '../../../../shared/fs';

vi.mock('../../../../shared/fs', () => ({
  readTextFile: vi.fn(),
  resolvePathFromCwd: vi.fn((cwd, path) => `${cwd}/${path}`),
  writeTextFile: vi.fn(),
}));

describe('EditTool', () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      cwd: '/tmp/test-dir',
      abortController: new AbortController(),
      messages: [],
      getAppState: vi.fn(() => ({ permissionContext: { mode: 'default' } })),
      setAppState: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('Tool definition', () => {
    it('has correct name', () => {
      expect(EditTool.name).toBe('Edit');
    });

    it('is not read-only (writes files)', () => {
      const input: EditInput = { path: 'test.txt', oldString: 'old', newString: 'new' };
      expect(EditTool.isReadOnly(input)).toBe(false);
    });

    it('is concurrency safe (edit operations can be concurrent)', () => {
      const input: EditInput = { path: 'test.txt', oldString: 'old', newString: 'new' };
      expect(EditTool.isConcurrencySafe(input)).toBe(true);
    });

    it('has description method that returns string', async () => {
      const desc = await EditTool.description();
      expect(typeof desc).toBe('string');
      expect(desc.toLowerCase()).toContain('edit');
    });
  });

  describe('validateInput', () => {
    it('returns valid for complete input with different strings', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: 'old', newString: 'new' });
      expect(result).toEqual({ result: true });
    });

    it('returns invalid for empty path', async () => {
      const result = await EditTool.validateInput({ path: '', oldString: 'old', newString: 'new' } as any);
      expect(result.result).toBe(false);
    });

    it('returns invalid for whitespace-only path', async () => {
      const result = await EditTool.validateInput({ path: '   ', oldString: 'old', newString: 'new' } as any);
      expect(result.result).toBe(false);
    });

    it('returns invalid when oldString equals newString', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: 'same', newString: 'same' });
      expect(result.result).toBe(false);
      expect(result.message).toContain('must differ');
    });

    it('returns invalid when both strings are empty but equal', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: '', newString: '' });
      expect(result.result).toBe(false);
    });

    it('returns valid for different empty strings (edge case - one is not empty)', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: '', newString: ' ' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for absolute path', async () => {
      const result = await EditTool.validateInput({ path: '/etc/hosts', oldString: 'old', newString: 'new' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for relative path with subdirectory', async () => {
      const result = await EditTool.validateInput({ path: 'src/components/Button.tsx', oldString: 'old', newString: 'new' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid when strings differ only in case', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: 'Old', newString: 'old' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for unicode strings that differ', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: '世界', newString: 'World' });
      expect(result).toEqual({ result: true });
    });

    it('returns invalid when both strings are identical with whitespace differences in content but same value', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: 'content\n', newString: 'content\n' });
      expect(result.result).toBe(false);
    });

    it('returns valid when strings differ by a single character', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: 'a', newString: 'b' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for multiline oldString and simple newString', async () => {
      const result = await EditTool.validateInput({
        path: 'test.txt',
        oldString: 'line1\nline2',
        newString: 'replacement'
      });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for simple oldString and multiline newString', async () => {
      const result = await EditTool.validateInput({
        path: 'test.txt',
        oldString: 'old',
        newString: 'line1\nline2\nline3'
      });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for regex-like patterns that differ', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: '/\\d+/', newString: '/[0-9]+/' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for JSON strings that differ', async () => {
      const result = await EditTool.validateInput({
        path: 'test.json',
        oldString: '{"key": "value"}',
        newString: '{"key": "new_value"}'
      });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for code strings that differ slightly', async () => {
      const result = await EditTool.validateInput({
        path: 'test.ts',
        oldString: 'const x: number = 1;',
        newString: 'const x: number = 2;'
      });
      expect(result).toEqual({ result: true });
    });

    it('returns valid when strings differ only by trailing/leading whitespace and are effectively same', async () => {
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: '  hello  ', newString: 'hello' });
      expect(result).toEqual({ result: true });
    });

    it('handles null path as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await EditTool.validateInput({ path: null, oldString: 'old', newString: 'new' });
      expect(result.result).toBe(false);
    });

    it('handles undefined path as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await EditTool.validateInput({ path: undefined, oldString: 'old', newString: 'new' });
      expect(result.result).toBe(false);
    });

    it('handles null oldString as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: null, newString: 'new' });
      expect(result.result).toBe(false);
    });

    it('handles undefined newString as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await EditTool.validateInput({ path: 'test.txt', oldString: 'old', newString: undefined });
      expect(result.result).toBe(false);
    });
  });

  describe('checkPermissions', () => {
    it('asks for confirmation in default mode', async () => {
      const input: EditInput = { path: 'test.txt', oldString: 'old', newString: 'new' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'default' } });

      const result = await EditTool.checkPermissions(input, mockContext);

      expect(result.behavior).toBe('ask');
    });

    it('includes path in confirmation message', async () => {
      const input: EditInput = { path: 'src/components/Button.tsx', oldString: 'old', newString: 'new' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'default' } });

      const result = await EditTool.checkPermissions(input, mockContext);

      if (result.behavior === 'ask') {
        expect(result.message).toContain('src/components/Button.tsx');
      } else {
        fail('Expected behavior to be ask');
      }
    });

    it('allows without confirmation in bypassPermissions mode', async () => {
      const input: EditInput = { path: 'test.txt', oldString: 'old', newString: 'new' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'bypassPermissions' } });

      const result = await EditTool.checkPermissions(input, mockContext);

      expect(result.behavior).toBe('allow');
    });

    it('allows without confirmation in acceptEdits mode', async () => {
      const input: EditInput = { path: 'test.txt', oldString: 'old', newString: 'new' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'acceptEdits' } });

      const result = await EditTool.checkPermissions(input, mockContext);

      expect(result.behavior).toBe('allow');
    });

    it('returns updatedInput when allowing', async () => {
      const input: EditInput = { path: 'test.txt', oldString: 'old', newString: 'new' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'acceptEdits' } });

      const result = await EditTool.checkPermissions(input, mockContext);

      if (result.behavior === 'allow') {
        expect(result.updatedInput).toEqual(input);
      } else {
        fail('Expected behavior to be allow');
      }
    });

    it('asks for all paths in default mode', async () => {
      const testCases = [
        { path: 'simple.txt' },
        { path: '/absolute/path/file.txt' },
        { path: 'nested/dir/file.json' },
        { path: '.gitignore' },
        { path: 'file with spaces.txt' },
      ];

      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'default' } });

      for (const testCase of testCases) {
        const result = await EditTool.checkPermissions(
          { ...testCase, oldString: 'old', newString: 'new' },
          mockContext
        );
        expect(result.behavior).toBe('ask');
      }
    });
  });

  describe('call - successful execution', () => {
    it('replaces string and returns applied: true on success', async () => {
      const content = 'Hello old world';
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/test.txt');

      const input: EditInput = { path: 'test.txt', oldString: 'old', newString: 'new' };
      const result = await EditTool.call(input, mockContext, null as any, null as any);

      expect(result.data).toEqual({ applied: true });
    });

    it('resolves path relative to cwd', async () => {
      (readTextFile as any).mockResolvedValue('old content with old string');
      (writeTextFile as any).mockResolvedValue(0);

      await EditTool.call(
        { path: 'subdir/file.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        null as any
      );

      expect(resolvePathFromCwd).toHaveBeenCalledWith('/tmp/test-dir', 'subdir/file.txt');
    });

    it('reads file before writing', async () => {
      (readTextFile as any).mockResolvedValue('Hello old world');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/output.txt');

      await EditTool.call(
        { path: 'output.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        null as any
      );

      expect(readTextFile).toHaveBeenCalledWith('/tmp/test-dir/output.txt');
    });

    it('writes updated content after replacement', async () => {
      (readTextFile as any).mockResolvedValue('Hello old world');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/output.txt');

      await EditTool.call(
        { path: 'output.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/output.txt', 'Hello new world');
    });

    it('handles single character replacement', async () => {
      (readTextFile as any).mockResolvedValue('abc');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/test.txt');

      await EditTool.call(
        { path: 'test.txt', oldString: 'b', newString: 'x' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/test.txt', 'axc');
    });

    it('handles multi-line replacement', async () => {
      const content = 'line1\nold\nline3';
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/multiline.txt');

      await EditTool.call(
        { path: 'multiline.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/multiline.txt', 'line1\nnew\nline3');
    });

    it('handles replacement in large files', async () => {
      const content = 'a'.repeat(50000) + 'old' + 'b'.repeat(50000);
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/large.txt');

      await EditTool.call(
        { path: 'large.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith(
        '/tmp/test-dir/large.txt',
        'a'.repeat(50000) + 'new' + 'b'.repeat(50000)
      );
    });

    it('handles unicode replacement', async () => {
      (readTextFile as any).mockResolvedValue('Hello 世界');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/unicode.txt');

      await EditTool.call(
        { path: 'unicode.txt', oldString: '世界', newString: 'World' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/unicode.txt', 'Hello World');
    });

    it('handles emoji replacement', async () => {
      (readTextFile as any).mockResolvedValue('Hello 👋 World');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/emoji.txt');

      await EditTool.call(
        { path: 'emoji.txt', oldString: '👋', newString: '🤠' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/emoji.txt', 'Hello 🤠 World');
    });

    it('handles JSON replacement', async () => {
      const content = '{"key": "old_value"}';
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/data.json');

      await EditTool.call(
        { path: 'data.json', oldString: '"old_value"', newString: '"new_value"' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/data.json', '{"key": "new_value"}');
    });

    it('handles code replacement', async () => {
      const content = 'function hello() {\n  console.log("old");\n}';
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/code.js');

      await EditTool.call(
        { path: 'code.js', oldString: '"old"', newString: '"new"' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith(
        '/tmp/test-dir/code.js',
        'function hello() {\n  console.log("new");\n}'
      );
    });

    it('handles markdown replacement', async () => {
      const content = '# Header\n\nThis is **old** text.';
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/readme.md');

      await EditTool.call(
        { path: 'readme.md', oldString: '**old**', newString: '**new**' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/readme.md', '# Header\n\nThis is **new** text.');
    });

    it('handles special character replacement', async () => {
      const content = 'value: @#$%^&*()';
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/special.txt');

      await EditTool.call(
        { path: 'special.txt', oldString: '@#$%', newString: '***' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/special.txt', 'value: ***^&*()');
    });

    it('handles YAML-like replacement', async () => {
      const content = `name: old_name\nversion: 1.0.0`;
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/config.yaml');

      await EditTool.call(
        { path: 'config.yaml', oldString: 'old_name', newString: 'new_name' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/config.yaml', `name: new_name\nversion: 1.0.0`);
    });

    it('handles TOML-like replacement', async () => {
      const content = `[package]\nname = "old_package"`;
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/Cargo.toml');

      await EditTool.call(
        { path: 'Cargo.toml', oldString: '"old_package"', newString: '"new_package"' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/Cargo.toml', `[package]\nname = "new_package"`);
    });

    it('handles XML-like replacement', async () => {
      const content = `<root>\n  <child>old_value</child>\n</root>`;
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/data.xml');

      await EditTool.call(
        { path: 'data.xml', oldString: 'old_value', newString: 'new_value' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/data.xml', `<root>\n  <child>new_value</child>\n</root>`);
    });

    it('handles HTML-like replacement', async () => {
      const content = `<!DOCTYPE html>\n<html><body>old_text</body></html>`;
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/index.html');

      await EditTool.call(
        { path: 'index.html', oldString: 'old_text', newString: 'new_text' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/index.html', `<!DOCTYPE html>\n<html><body>new_text</body></html>`);
    });

    it('preserves trailing newline after replacement', async () => {
      const content = 'old content\n';
      (readTextFile as any).mockResolvedValue(content);
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/newline.txt');

      await EditTool.call(
        { path: 'newline.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/newline.txt', 'new content\n');
    });

    it('handles replacement with empty string (deletion)', async () => {
      (readTextFile as any).mockResolvedValue('Hello old World');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/delete.txt');

      await EditTool.call(
        { path: 'delete.txt', oldString: 'old ', newString: '' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/delete.txt', 'Hello World');
    });

    it('handles replacement with newline (expansion)', async () => {
      (readTextFile as any).mockResolvedValue('single line old text');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/expand.txt');

      await EditTool.call(
        { path: 'expand.txt', oldString: 'old', newString: 'new\nline' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/expand.txt', 'single line new\nline text');
    });

    it('handles multiple occurrences - only replaces first', async () => {
      (readTextFile as any).mockResolvedValue('old old old');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/multiple.txt');

      await EditTool.call(
        { path: 'multiple.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/multiple.txt', 'new old old');
    });
  });

  describe('call - error handling', () => {
    it('throws when file is not found (string not in content)', async () => {
      (readTextFile as any).mockResolvedValue('Hello world');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/test.txt');

      await expect(
        EditTool.call({ path: 'test.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow('Could not find target string in test.txt');
    });

    it('throws with correct file path in error message', async () => {
      (readTextFile as any).mockResolvedValue('content without match');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/subdir/file.tsx');

      await expect(
        EditTool.call({ path: 'subdir/file.tsx', oldString: 'missing', newString: 'found' }, mockContext, null as any, null as any)
      ).rejects.toThrow('Could not find target string in subdir/file.tsx');
    });

    it('throws when readTextFile fails (file not found)', async () => {
      (readTextFile as any).mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        EditTool.call({ path: 'nonexistent.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when readTextFile fails (permission denied)', async () => {
      (readTextFile as any).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        EditTool.call({ path: '/protected/file.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws with error message when readTextFile fails', async () => {
      const expectedError = new Error('Custom error message');
      (readTextFile as any).mockRejectedValue(expectedError);

      await expect(
        EditTool.call({ path: 'test.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow(expectedError);
    });

    it('handles disk full error in writeTextFile', async () => {
      (readTextFile as any).mockResolvedValue('content with old string');
      (writeTextFile as any).mockRejectedValue(new Error('ENOSPC: no space left on device'));
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/large.txt');

      await expect(
        EditTool.call({ path: 'large.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles encoding error in readTextFile', async () => {
      (readTextFile as any).mockRejectedValue(new Error('Encoding error'));

      await expect(
        EditTool.call({ path: 'encoding-error.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles readonly filesystem error in writeTextFile', async () => {
      (readTextFile as any).mockResolvedValue('content with old string');
      (writeTextFile as any).mockRejectedValue(new Error('EROFS: read-only file system'));
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/readonly.txt');

      await expect(
        EditTool.call({ path: 'readonly.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles network error in readTextFile', async () => {
      (readTextFile as any).mockRejectedValue(new Error('ETIMEDOUT: connection timed out'));

      await expect(
        EditTool.call({ path: '/network/path/file.txt', oldString: 'old', newString: 'new' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles partial match - succeeds when substring exists', async () => {
      (readTextFile as any).mockResolvedValue('The old man and the sea');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/partial.txt');

      await EditTool.call(
        { path: 'partial.txt', oldString: 'old man', newString: 'young' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/partial.txt', 'The young and the sea');
    });

    it('handles regex special characters in search string - literal match only', async () => {
      (readTextFile as any).mockResolvedValue('price: $10.99');
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/special.txt');

      await EditTool.call(
        { path: 'special.txt', oldString: '$10.99', newString: '$20.00' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/special.txt', 'price: $20.00');
    });
  });

  describe('tool call signature', () => {
    it('accepts ToolUseContext with abortController', async () => {
      (readTextFile as any).mockResolvedValue('content with old string');
      (writeTextFile as any).mockResolvedValue(0);

      const controller = new AbortController();
      const context = {
        cwd: '/tmp',
        abortController: controller,
        messages: [],
        getAppState: () => ({ permissionContext: { mode: 'default' } }),
        setAppState: () => {},
      };

      await EditTool.call({ path: 'test.txt', oldString: 'old', newString: 'new' }, context, null as any, null as any);

      expect(readTextFile).toHaveBeenCalled();
    });

    it('accepts canUseTool callback parameter', async () => {
      (readTextFile as any).mockResolvedValue('content with old string');
      (writeTextFile as any).mockResolvedValue(0);

      const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' } as any);

      await EditTool.call(
        { path: 'test.txt', oldString: 'old', newString: 'new' },
        mockContext,
        mockCanUseTool,
        null as any
      );

      expect(mockCanUseTool).toBeDefined();
    });

    it('accepts parentMessage parameter', async () => {
      (readTextFile as any).mockResolvedValue('content with old string');
      (writeTextFile as any).mockResolvedValue(0);

      const mockParentMessage = { id: 'msg-123', type: 'assistant', content: [] };

      await EditTool.call(
        { path: 'test.txt', oldString: 'old', newString: 'new' },
        mockContext,
        null as any,
        mockParentMessage
      );

      expect(readTextFile).toHaveBeenCalled();
    });
  });
});

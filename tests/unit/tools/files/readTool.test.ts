import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { ReadTool, type ReadInput } from '../../../../tools/files/readTool';
import { readTextFile, resolvePathFromCwd } from '../../../../shared/fs';

vi.mock('../../../../shared/fs', () => ({
  readTextFile: vi.fn(),
  resolvePathFromCwd: vi.fn((cwd, path) => `${cwd}/${path}`),
}));

describe('ReadTool', () => {
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
      expect(ReadTool.name).toBe('Read');
    });

    it('is read-only (only reads files)', () => {
      const input: ReadInput = { path: 'test.txt' };
      expect(ReadTool.isReadOnly(input)).toBe(true);
    });

    it('is concurrency safe (read operations don\'t conflict)', () => {
      const input: ReadInput = { path: 'test.txt' };
      expect(ReadTool.isConcurrencySafe(input)).toBe(true);
    });

    it('has description method that returns string', async () => {
      const desc = await ReadTool.description();
      expect(typeof desc).toBe('string');
      expect(desc.toLowerCase()).toContain('read');
    });
  });

  describe('validateInput', () => {
    it('returns valid for complete input with file path', async () => {
      const result = await ReadTool.validateInput({ path: 'test.txt' });
      expect(result).toEqual({ result: true });
    });

    it('returns invalid for empty path', async () => {
      const result = await ReadTool.validateInput({ path: '' } as any);
      expect(result.result).toBe(false);
    });

    it('returns invalid for whitespace-only path', async () => {
      const result = await ReadTool.validateInput({ path: '   ' } as any);
      expect(result.result).toBe(false);
    });

    it('returns valid for absolute path', async () => {
      const result = await ReadTool.validateInput({ path: '/etc/hosts' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for relative path with subdirectory', async () => {
      const result = await ReadTool.validateInput({ path: 'src/components/Button.tsx' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for hidden file', async () => {
      const result = await ReadTool.validateInput({ path: '.gitignore' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for nested directory structure', async () => {
      const result = await ReadTool.validateInput({ path: 'a/b/c/d/e/file.txt' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for file with extension', async () => {
      const result = await ReadTool.validateInput({ path: 'file.min.js' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for file without extension', async () => {
      const result = await ReadTool.validateInput({ path: 'Makefile' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for file with multiple dots in name', async () => {
      const result = await ReadTool.validateInput({ path: 'file.name.with.dots.txt' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for path with query-like suffix (edge case)', async () => {
      const result = await ReadTool.validateInput({ path: 'file.txt?query=1' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for very long filename', async () => {
      const longName = 'a'.repeat(200) + '.txt';
      const result = await ReadTool.validateInput({ path: longName });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for file with spaces in name', async () => {
      const result = await ReadTool.validateInput({ path: 'file with spaces.txt' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for Unicode filename', async () => {
      const result = await ReadTool.validateInput({ path: '文件.txt' });
      expect(result).toEqual({ result: true });
    });

    it('returns valid for file starting with dot in subdirectory', async () => {
      const result = await ReadTool.validateInput({ path: 'src/.hidden/config.json' });
      expect(result).toEqual({ result: true });
    });

    it('handles null path as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await ReadTool.validateInput({ path: null });
      expect(result.result).toBe(false);
    });

    it('handles undefined path as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await ReadTool.validateInput({ path: undefined });
      expect(result.result).toBe(false);
    });
  });

  describe('checkPermissions', () => {
    it('allows without confirmation (read is safe)', async () => {
      const input: ReadInput = { path: 'test.txt' };
      const result = await ReadTool.checkPermissions(input, {} as any);

      expect(result.behavior).toBe('allow');
    });

    it('returns updatedInput when allowing', async () => {
      const input: ReadInput = { path: 'test.txt' };
      const result = await ReadTool.checkPermissions(input, {} as any);

      if (result.behavior === 'allow') {
        expect(result.updatedInput).toEqual(input);
      } else {
        fail('Expected behavior to be allow');
      }
    });

    it('allows all paths without confirmation', async () => {
      const testCases = [
        { path: 'simple.txt' },
        { path: '/absolute/path/file.txt' },
        { path: 'nested/dir/file.json' },
        { path: '.gitignore' },
        { path: 'file with spaces.txt' },
      ];

      for (const testCase of testCases) {
        const result = await ReadTool.checkPermissions(testCase, {} as any);
        expect(result.behavior).toBe('allow');
      }
    });
  });

  describe('call - successful execution', () => {
    it('reads file and returns content on success', async () => {
      const mockContent = 'Hello, World!';
      (readTextFile as any).mockResolvedValue(mockContent);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/test.txt');

      const input: ReadInput = { path: 'test.txt' };
      const result = await ReadTool.call(input, mockContext, null as any, null as any);

      expect(result.data).toEqual({ content: mockContent });
    });

    it('resolves path relative to cwd', async () => {
      (readTextFile as any).mockResolvedValue('content');

      await ReadTool.call(
        { path: 'subdir/file.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(resolvePathFromCwd).toHaveBeenCalledWith('/tmp/test-dir', 'subdir/file.txt');
    });

    it('reads file at resolved path', async () => {
      (readTextFile as any).mockResolvedValue('Hello World');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/output.txt');

      await ReadTool.call(
        { path: 'output.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(readTextFile).toHaveBeenCalledWith('/tmp/test-dir/output.txt');
    });

    it('returns content from file', async () => {
      const expectedContent = 'This is the file content';
      (readTextFile as any).mockResolvedValue(expectedContent);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/test.txt');

      const result = await ReadTool.call(
        { path: 'test.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(expectedContent);
    });

    it('handles empty file', async () => {
      (readTextFile as any).mockResolvedValue('');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/empty.txt');

      const result = await ReadTool.call(
        { path: 'empty.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe('');
    });

    it('handles single character file', async () => {
      (readTextFile as any).mockResolvedValue('X');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/single.txt');

      const result = await ReadTool.call(
        { path: 'single.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe('X');
    });

    it('handles large file', async () => {
      const content = 'a'.repeat(100000); // 100KB file
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/large.txt');

      const result = await ReadTool.call(
        { path: 'large.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles multi-line file', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/multiline.txt');

      const result = await ReadTool.call(
        { path: 'multiline.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles file with trailing newline', async () => {
      const content = 'content\n';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/trailing.txt');

      const result = await ReadTool.call(
        { path: 'trailing.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles file with leading newline', async () => {
      const content = '\ncontent';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/leading.txt');

      const result = await ReadTool.call(
        { path: 'leading.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles file with only newlines', async () => {
      const content = '\n\n\n';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/newlines.txt');

      const result = await ReadTool.call(
        { path: 'newlines.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles unicode content', async () => {
      const content = 'Hello 世界！👋 مرحبا';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/unicode.txt');

      const result = await ReadTool.call(
        { path: 'unicode.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles JSON content', async () => {
      const content = '{"key": "value", "number": 123}';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/data.json');

      const result = await ReadTool.call(
        { path: 'data.json' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles JavaScript code', async () => {
      const content = `function hello() {\n  console.log("Hello");\n}`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/code.js');

      const result = await ReadTool.call(
        { path: 'code.js' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles TypeScript code', async () => {
      const content = `interface User {\n  name: string;\n  age: number;\n}\n\nconst user: User = { name: "Alice", age: 30 };`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/typescript.ts');

      const result = await ReadTool.call(
        { path: 'typescript.ts' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles HTML content', async () => {
      const content = `<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body>Hello</body>\n</html>`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/index.html');

      const result = await ReadTool.call(
        { path: 'index.html' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles CSS content', async () => {
      const content = `.container {\n  display: flex;\n  justify-content: center;\n}\n\n.button {\n  padding: 10px;\n}`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/styles.css');

      const result = await ReadTool.call(
        { path: 'styles.css' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles YAML content', async () => {
      const content = `name: myapp\nversion: 1.0.0\ndepends:\n  - dep1\n  - dep2`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/config.yaml');

      const result = await ReadTool.call(
        { path: 'config.yaml' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles TOML content', async () => {
      const content = `[package]\nname = "myapp"\nversion = "1.0.0"\n\n[dependencies]\nrustc = "1.56"`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/Cargo.toml');

      const result = await ReadTool.call(
        { path: 'Cargo.toml' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles XML content', async () => {
      const content = `<?xml version="1.0"?>\n<root>\n  <item id="1">First</item>\n  <item id="2">Second</item>\n</root>`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/data.xml');

      const result = await ReadTool.call(
        { path: 'data.xml' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles markdown content', async () => {
      const content = `# Header\n\nThis is **bold** and this is *italic*.\n\n- Item 1\n- Item 2`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/readme.md');

      const result = await ReadTool.call(
        { path: 'readme.md' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles shell script content', async () => {
      const content = `#!/bin/bash\nset -e\n\necho "Hello"\nls -la`;
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/script.sh');

      const result = await ReadTool.call(
        { path: 'script.sh' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles binary-like content (as text)', async () => {
      const content = '\x00\x01\x02\x03binary data';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/binary.txt');

      const result = await ReadTool.call(
        { path: 'binary.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles content with tabs', async () => {
      const content = '\tindentation\twith\ttabs';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/tabs.txt');

      const result = await ReadTool.call(
        { path: 'tabs.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles content with mixed whitespace', async () => {
      const content = '  spaces\tand\tnewlines\n';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/whitespace.txt');

      const result = await ReadTool.call(
        { path: 'whitespace.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('preserves exact file content including special characters', async () => {
      const content = 'Special chars: @#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/special.txt');

      const result = await ReadTool.call(
        { path: 'special.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles very long single line', async () => {
      const content = 'a'.repeat(1000000) + '\n'; // 1MB line
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/longline.txt');

      const result = await ReadTool.call(
        { path: 'longline.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles content with carriage returns', async () => {
      const content = 'line1\r\nline2\r\nline3'; // Windows line endings
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/crlf.txt');

      const result = await ReadTool.call(
        { path: 'crlf.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });

    it('handles content with old Mac line endings', async () => {
      const content = 'line1\rline2\rline3'; // Old Mac line endings
      (readTextFile as any).mockResolvedValue(content);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/cr.txt');

      const result = await ReadTool.call(
        { path: 'cr.txt' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.content).toBe(content);
    });
  });

  describe('call - error handling', () => {
    it('throws when readTextFile fails (file not found)', async () => {
      (readTextFile as any).mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        ReadTool.call({ path: 'nonexistent.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when readTextFile fails (permission denied)', async () => {
      (readTextFile as any).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        ReadTool.call({ path: '/protected/file.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws with error message when readTextFile fails', async () => {
      const expectedError = new Error('Custom error message');
      (readTextFile as any).mockRejectedValue(expectedError);

      await expect(
        ReadTool.call({ path: 'test.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow(expectedError);
    });

    it('handles disk full error', async () => {
      (readTextFile as any).mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await expect(
        ReadTool.call({ path: '/full/disk/file.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles encoding error', async () => {
      (readTextFile as any).mockRejectedValue(new Error('Encoding error'));

      await expect(
        ReadTool.call({ path: 'encoding-error.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles network error for network paths', async () => {
      (readTextFile as any).mockRejectedValue(new Error('ETIMEDOUT: connection timed out'));

      await expect(
        ReadTool.call({ path: '/network/path/file.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles broken symlink error', async () => {
      (readTextFile as any).mockRejectedValue(new Error('ELOOP: too many symbolic links'));

      await expect(
        ReadTool.call({ path: 'broken-symlink.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles resource busy error', async () => {
      (readTextFile as any).mockRejectedValue(new Error('EBUSY: resource busy'));

      await expect(
        ReadTool.call({ path: 'busy.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles I/O error', async () => {
      (readTextFile as any).mockRejectedValue(new Error('EIO: input/output error'));

      await expect(
        ReadTool.call({ path: 'io-error.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('handles quota exceeded error', async () => {
      (readTextFile as any).mockRejectedValue(new Error('EDQUOT: disk quota exceeded'));

      await expect(
        ReadTool.call({ path: 'quota-exceeded.txt' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });
  });

  describe('tool call signature', () => {
    it('accepts ToolUseContext with abortController', async () => {
      (readTextFile as any).mockResolvedValue('content');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test.txt');

      const controller = new AbortController();
      const context = {
        cwd: '/tmp',
        abortController: controller,
        messages: [],
        getAppState: () => ({}),
        setAppState: () => {},
      };

      await ReadTool.call({ path: 'test.txt' }, context, null as any, null as any);

      expect(readTextFile).toHaveBeenCalled();
    });

    it('accepts canUseTool callback parameter', async () => {
      (readTextFile as any).mockResolvedValue('content');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test.txt');

      const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' } as any);

      await ReadTool.call(
        { path: 'test.txt' },
        mockContext,
        mockCanUseTool,
        null as any
      );

      expect(mockCanUseTool).toBeDefined();
    });

    it('accepts parentMessage parameter', async () => {
      (readTextFile as any).mockResolvedValue('content');
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test.txt');

      const mockParentMessage = { id: 'msg-123', type: 'assistant', content: [] };

      await ReadTool.call(
        { path: 'test.txt' },
        mockContext,
        null as any,
        mockParentMessage
      );

      expect(readTextFile).toHaveBeenCalled();
    });
  });
});

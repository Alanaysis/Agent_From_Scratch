import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { WriteTool } from '../../../../tools/files/writeTool.js';
import { writeTextFile, resolvePathFromCwd } from '../../../../shared/fs';

vi.mock('../../../../shared/fs', () => ({
  writeTextFile: vi.fn(),
  resolvePathFromCwd: vi.fn((cwd, path) => `${cwd}/${path}`),
}));

describe('WriteTool', () => {
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

  describe('description', () => {
    it('returns correct description', async () => {
      const desc = await WriteTool.description();
      expect(desc).toBe('Write a file');
    });
  });

  describe('isReadOnly', () => {
    it('returns false since write is not read-only', () => {
      expect(WriteTool.isReadOnly()).toBe(false);
    });
  });

  describe('isConcurrencySafe', () => {
    it('returns true for write operations', () => {
      expect(WriteTool.isConcurrencySafe()).toBe(true);
    });
  });

  describe('validateInput', () => {
    it('allows valid file path with content', async () => {
      const result = await WriteTool.validateInput({ path: 'test.txt', content: 'content' });
      expect(result).toEqual({ result: true });
    });

    it('rejects empty path', async () => {
      const result = await WriteTool.validateInput({ path: '', content: 'content' } as any);
      expect(result.result).toBe(false);
    });

    it('rejects whitespace-only path', async () => {
      const result = await WriteTool.validateInput({ path: '   ', content: 'content' } as any);
      expect(result.result).toBe(false);
    });

    it('allows CSS content', async () => {
      const content = '.class { color: red; }';
      const result = await WriteTool.validateInput({ path: 'styles.css', content });
      expect(result).toEqual({ result: true });
    });

    it('allows YAML content', async () => {
      const content = 'key: value\nlist:\n  - item1';
      const result = await WriteTool.validateInput({ path: 'config.yaml', content });
      expect(result).toEqual({ result: true });
    });

    it('allows TOML content', async () => {
      const content = '[package]\nname = "app"';
      const result = await WriteTool.validateInput({ path: 'Cargo.toml', content });
      expect(result).toEqual({ result: true });
    });

    it('allows XML content', async () => {
      const content = '<?xml version="1.0"?><root></root>';
      const result = await WriteTool.validateInput({ path: 'data.xml', content });
      expect(result).toEqual({ result: true });
    });

    it('allows markdown content', async () => {
      const content = '# Header\n\nContent';
      const result = await WriteTool.validateInput({ path: 'readme.md', content });
      expect(result).toEqual({ result: true });
    });

    it('allows shell script', async () => {
      const content = '#!/bin/bash\necho "Hello"';
      const result = await WriteTool.validateInput({ path: 'script.sh', content });
      expect(result).toEqual({ result: true });
    });

    it('allows content with special characters', async () => {
      const content = '@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const result = await WriteTool.validateInput({ path: 'test.txt', content });
      expect(result).toEqual({ result: true });
    });

    it('allows content with tabs and newlines', async () => {
      const content = '\tindent\n\tnested';
      const result = await WriteTool.validateInput({ path: 'test.txt', content });
      expect(result).toEqual({ result: true });
    });

    it('allows absolute paths in input', async () => {
      const result = await WriteTool.validateInput({ path: '/tmp/test.txt', content: 'content' });
      expect(result).toEqual({ result: true });
    });

    it('allows relative paths with subdirectories', async () => {
      const result = await WriteTool.validateInput({ path: 'src/components/Button.tsx', content: 'content' });
      expect(result).toEqual({ result: true });
    });

    it('allows hidden files in input', async () => {
      const result = await WriteTool.validateInput({ path: '.gitignore', content: '*.log' });
      expect(result).toEqual({ result: true });
    });

    it('allows very long filename with content', async () => {
      const longName = 'a'.repeat(200) + '.txt';
      const result = await WriteTool.validateInput({ path: longName, content: 'content' });
      expect(result).toEqual({ result: true });
    });

    it('allows file with spaces in name', async () => {
      const result = await WriteTool.validateInput({ path: 'file with spaces.txt', content: 'content' });
      expect(result).toEqual({ result: true });
    });

    it('allows Unicode filename', async () => {
      const result = await WriteTool.validateInput({ path: '文件.txt', content: 'content' });
      expect(result).toEqual({ result: true });
    });

    it('handles null path as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await WriteTool.validateInput({ path: null, content: 'content' });
      expect(result.result).toBe(false);
    });

    it('handles undefined path as invalid', async () => {
      // @ts-expect-error - testing edge case
      const result = await WriteTool.validateInput({ path: undefined, content: 'content' });
      expect(result.result).toBe(false);
    });

    it('handles null content (edge case)', async () => {
      // @ts-expect-error - testing edge case
      const result = await WriteTool.validateInput({ path: 'test.txt', content: null });
      expect(result.result).toBe(false);
    });

    it('handles undefined content (edge case)', async () => {
      // @ts-expect-error - testing edge case
      const result = await WriteTool.validateInput({ path: 'test.txt', content: undefined });
      expect(result.result).toBe(false);
    });
  });

  describe('checkPermissions', () => {
    it('asks for confirmation in default mode', async () => {
      const input = { path: 'test.txt', content: 'content' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'default' } });

      const result = await WriteTool.checkPermissions(input, mockContext);

      expect(result.behavior).toBe('ask');
    });

    it('includes file path in confirmation message', async () => {
      const input = { path: 'important.txt', content: 'secret' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'default' } });

      const result = await WriteTool.checkPermissions(input, mockContext);

      if (result.behavior === 'ask') {
        expect(result.message).toContain('important.txt');
        expect(result.message.toLowerCase()).toContain('write');
        expect(result.message.toLowerCase()).toContain('confirmation');
      } else {
        throw new Error('Expected behavior to be ask');
      }
    });

    it('allows without confirmation in non-default mode', async () => {
      const input = { path: 'test.txt', content: 'content' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'auto-approve' } });

      const result = await WriteTool.checkPermissions(input, mockContext);

      expect(result.behavior).toBe('allow');
    });

    it('returns updatedInput when allowing', async () => {
      const input = { path: 'test.txt', content: 'content' };
      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'auto-approve' } });

      const result = await WriteTool.checkPermissions(input, mockContext);

      if (result.behavior === 'allow') {
        expect(result.updatedInput).toEqual(input);
      } else {
        throw new Error('Expected behavior to be allow');
      }
    });

    it('asks for all file paths in default mode', async () => {
      const testCases = [
        { path: 'simple.txt' },
        { path: '/absolute/path/file.txt' },
        { path: 'nested/dir/file.json' },
        { path: '.gitignore' },
      ];

      (mockContext.getAppState as any).mockReturnValue({ permissionContext: { mode: 'default' } });

      for (const testCase of testCases) {
        const result = await WriteTool.checkPermissions(testCase, mockContext);
        expect(result.behavior).toBe('ask');
      }
    });
  });

  describe('call - successful execution', () => {
    it('writes file and returns bytes written on success', async () => {
      const content = 'Hello, World!';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/test.txt');

      const input = { path: 'test.txt', content };
      const result = await WriteTool.call(input, mockContext, null as any, null as any);

      expect(result.data).toEqual({ bytesWritten: content.length });
    });

    it('resolves path relative to cwd', async () => {
      (writeTextFile as any).mockResolvedValue(7);

      await WriteTool.call(
        { path: 'subdir/file.txt', content: 'content' },
        mockContext,
        null as any,
        null as any
      );

      expect(resolvePathFromCwd).toHaveBeenCalledWith('/tmp/test-dir', 'subdir/file.txt');
    });

    it('writes to resolved path', async () => {
      (writeTextFile as any).mockResolvedValue(13);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/output.txt');

      await WriteTool.call(
        { path: 'output.txt', content: 'Hello World' },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/output.txt', 'Hello World');
    });

    it('returns correct byte count for ASCII content', async () => {
      const content = 'Hello';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/test.txt');

      const result = await WriteTool.call(
        { path: 'test.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.bytesWritten).toBe(content.length);
    });

    it('returns correct byte count for empty file', async () => {
      (writeTextFile as any).mockResolvedValue(0);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/empty.txt');

      const result = await WriteTool.call(
        { path: 'empty.txt', content: '' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.bytesWritten).toBe(0);
    });

    it('returns correct byte count for single character', async () => {
      (writeTextFile as any).mockResolvedValue(1);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/single.txt');

      const result = await WriteTool.call(
        { path: 'single.txt', content: 'X' },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.bytesWritten).toBe(1);
    });

    it('returns correct byte count for multi-line file', async () => {
      const content = 'line1\nline2\nline3'; // 15 bytes including newlines
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/multiline.txt');

      const result = await WriteTool.call(
        { path: 'multiline.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.bytesWritten).toBe(content.length);
    });

    it('returns correct byte count for unicode content', async () => {
      const content = 'Hello 世界！'; // Unicode characters - JS counts code units
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/unicode.txt');

      const result = await WriteTool.call(
        { path: 'unicode.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.bytesWritten).toBe(content.length);
    });

    it('writes JSON content correctly', async () => {
      const content = '{"key": "value", "number": 123}';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/data.json');

      await WriteTool.call(
        { path: 'data.json', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/data.json', content);
    });

    it('writes JavaScript code correctly', async () => {
      const content = `function hello() {\n  console.log("Hello");\n}`;
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/code.js');

      await WriteTool.call(
        { path: 'code.js', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/code.js', content);
    });

    it('writes TypeScript code correctly', async () => {
      const content = `interface User {\n  name: string;\n}`;
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/typescript.ts');

      await WriteTool.call(
        { path: 'typescript.ts', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/typescript.ts', content);
    });

    it('writes HTML content correctly', async () => {
      const content = '<!DOCTYPE html><html><body>Hello</body></html>';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/index.html');

      await WriteTool.call(
        { path: 'index.html', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/index.html', content);
    });

    it('writes CSS content correctly', async () => {
      const content = `.container {\n  display: flex;\n}`;
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/styles.css');

      await WriteTool.call(
        { path: 'styles.css', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/styles.css', content);
    });

    it('writes YAML content correctly', async () => {
      const content = `name: myapp\nversion: 1.0.0`;
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/config.yaml');

      await WriteTool.call(
        { path: 'config.yaml', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/config.yaml', content);
    });

    it('writes TOML content correctly', async () => {
      const content = `[package]\nname = "myapp"`;
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/Cargo.toml');

      await WriteTool.call(
        { path: 'Cargo.toml', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/Cargo.toml', content);
    });

    it('writes XML content correctly', async () => {
      const content = '<?xml version="1.0"?><root></root>';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/data.xml');

      await WriteTool.call(
        { path: 'data.xml', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/data.xml', content);
    });

    it('writes markdown content correctly', async () => {
      const content = '# Header\n\nContent';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/readme.md');

      await WriteTool.call(
        { path: 'readme.md', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/readme.md', content);
    });

    it('writes shell script correctly', async () => {
      const content = '#!/bin/bash\necho "Hello"';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/script.sh');

      await WriteTool.call(
        { path: 'script.sh', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/script.sh', content);
    });

    it('handles very large file write', async () => {
      const content = 'a'.repeat(1000000); // 1MB
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/large.txt');

      const result = await WriteTool.call(
        { path: 'large.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(result.data.bytesWritten).toBe(content.length);
    });

    it('handles content with tabs', async () => {
      const content = '\tindentation\twith\ttabs';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/tabs.txt');

      await WriteTool.call(
        { path: 'tabs.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/tabs.txt', content);
    });

    it('handles content with carriage returns (Windows line endings)', async () => {
      const content = 'line1\r\nline2\r\n';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/crlf.txt');

      await WriteTool.call(
        { path: 'crlf.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/crlf.txt', content);
    });

    it('handles content with old Mac line endings (CR only)', async () => {
      const content = 'line1\rline2\r';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/cr.txt');

      await WriteTool.call(
        { path: 'cr.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/cr.txt', content);
    });

    it('preserves exact content including special characters', async () => {
      const content = 'Special chars: @#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/special.txt');

      await WriteTool.call(
        { path: 'special.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/special.txt', content);
    });

    it('handles binary-like content (as text)', async () => {
      const content = '\x00\x01\x02\x03binary data';
      (writeTextFile as any).mockResolvedValue(content.length);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test-dir/binary.txt');

      await WriteTool.call(
        { path: 'binary.txt', content },
        mockContext,
        null as any,
        null as any
      );

      expect(writeTextFile).toHaveBeenCalledWith('/tmp/test-dir/binary.txt', content);
    });
  });

  describe('call - error handling', () => {
    it('throws when writeTextFile fails (disk full)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await expect(
        WriteTool.call({ path: 'large.txt', content: 'a'.repeat(1000000) }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when writeTextFile fails (permission denied)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        WriteTool.call({ path: '/protected/file.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws with error message when writeTextFile fails', async () => {
      const expectedError = new Error('Custom error message');
      (writeTextFile as any).mockRejectedValue(expectedError);

      await expect(
        WriteTool.call({ path: 'test.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow(expectedError);
    });

    it('throws when writeTextFile fails (readonly filesystem)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('EROFS: read-only file system'));

      await expect(
        WriteTool.call({ path: 'readonly.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when writeTextFile fails (directory not found)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('ENOENT: no such directory'));

      await expect(
        WriteTool.call({ path: 'nonexistent/dir/file.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when writeTextFile fails (network error)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('ETIMEDOUT: connection timed out'));

      await expect(
        WriteTool.call({ path: '/network/path/file.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when writeTextFile fails (quota exceeded)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('EDQUOT: disk quota exceeded'));

      await expect(
        WriteTool.call({ path: 'quota.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when writeTextFile fails (I/O error)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('EIO: input/output error'));

      await expect(
        WriteTool.call({ path: 'io-error.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });

    it('throws when writeTextFile fails (resource busy)', async () => {
      (writeTextFile as any).mockRejectedValue(new Error('EBUSY: resource busy'));

      await expect(
        WriteTool.call({ path: 'busy.txt', content: 'content' }, mockContext, null as any, null as any)
      ).rejects.toThrow();
    });
  });

  describe('tool call signature', () => {
    it('accepts ToolUseContext with abortController', async () => {
      (writeTextFile as any).mockResolvedValue(7);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test.txt');

      const controller = new AbortController();
      const context = {
        cwd: '/tmp',
        abortController: controller,
        messages: [],
        getAppState: () => ({}),
        setAppState: () => {},
      };

      await WriteTool.call({ path: 'test.txt', content: 'content' }, context, null as any, null as any);

      expect(writeTextFile).toHaveBeenCalled();
    });

    it('accepts canUseTool callback parameter', async () => {
      (writeTextFile as any).mockResolvedValue(7);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test.txt');

      const mockCanUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' } as any);

      await WriteTool.call(
        { path: 'test.txt', content: 'content' },
        mockContext,
        mockCanUseTool,
        null as any
      );

      expect(mockCanUseTool).toBeDefined();
    });

    it('accepts parentMessage parameter', async () => {
      (writeTextFile as any).mockResolvedValue(7);
      (resolvePathFromCwd as any).mockReturnValue('/tmp/test.txt');

      const mockParentMessage = { id: 'msg-123', type: 'assistant', content: [] };

      await WriteTool.call(
        { path: 'test.txt', content: 'content' },
        mockContext,
        null as any,
        mockParentMessage
      );

      expect(writeTextFile).toHaveBeenCalled();
    });
  });
});

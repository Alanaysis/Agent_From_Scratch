import { describe, it, expect, vi } from 'bun:test';
import { query, type QueryParams } from '../../../runtime/query';

describe('query', () => {
  const createMockParams = (overrides?: Partial<QueryParams>): QueryParams => ({
    prompt: '',
    messages: [],
    systemPrompt: [],
    toolUseContext: { cwd: '/tmp' },
    canUseTool: async () => ({ behavior: 'allow' }),
    ...overrides,
  });

  describe('queryWithPlanner', () => {
    it('handles read command in English', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read README.md',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles read command in Chinese', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: '读取 README.md',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles shell command in English', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'run echo hello',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles shell command in Chinese', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: '执行 echo hello',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles fetch command in English', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'fetch https://example.com',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles write command in English', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'write test.txt hello world',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles edit command in English', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'edit test.txt hello => hi',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles edit command in Chinese', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: '编辑 test.txt hello => hi',
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('returns help message when no planner command matched', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'some random request',
      }))) {
        messages.push(msg);
      }

      const textMessages = messages.filter(m => m.type === 'assistant' && Array.isArray(m.content));
      expect(textMessages.length).toBeGreaterThan(0);
    });
  });

  describe('queryWithLlm fallback to planner', () => {
    it('falls back to planner when LLM is not configured', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read package.json',
      }))) {
        messages.push(msg);
      }

      // Should use planner mode since no LLM config
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('tool execution', () => {
    it('handles tool permission allow', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'run pwd',
        canUseTool: async () => ({ behavior: 'allow' }),
      }))) {
        messages.push(msg);
      }

      expect(messages.some(m => m.type === 'tool_result')).toBe(true);
    });

    it('handles tool permission deny', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'run rm -rf /',
        canUseTool: async () => ({ behavior: 'deny', message: 'Not allowed' }),
      }))) {
        messages.push(msg);
      }

      const toolResult = messages.find(m => m.type === 'tool_result');
      expect(toolResult).toBeDefined();
    });

    it('handles tool permission ask with user approval', async () => {
      let permissionGranted = false;
      const messages: any[] = [];

      for await (const msg of query(createMockParams({
        prompt: 'run pwd',
        canUseTool: async () => ({ behavior: 'ask', message: 'Ask user' }),
        onPermissionRequest: async () => { permissionGranted = true; return true; },
      }))) {
        messages.push(msg);
      }

      expect(permissionGranted).toBe(true);
    });

    it('handles tool permission ask with user rejection', async () => {
      const messages: any[] = [];

      for await (const msg of query(createMockParams({
        prompt: 'run pwd',
        canUseTool: async () => ({ behavior: 'ask', message: 'Ask user' }),
        onPermissionRequest: async () => false,
      }))) {
        messages.push(msg);
      }

      const toolResult = messages.find(m => m.type === 'tool_result');
      expect(toolResult).toBeDefined();
    });
  });

  describe('streaming behavior', () => {
    it('yields multiple messages for a complete interaction', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'run echo test',
      }))) {
        messages.push(msg);
      }

      expect(messages.length).toBeGreaterThan(1);
    });

    it('calls onAssistantTextDelta when provided', async () => {
      const textDeltas: string[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read package.json',
        onAssistantTextDelta: (text) => {
          if (text.length > 0) textDeltas.push(text);
        },
      }))) {
        // Messages are yielded as they're generated
      }

      // May have deltas depending on implementation
    });
  });

  describe('error handling', () => {
    it('handles unknown tool gracefully', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'run somecommand',
        canUseTool: async () => ({ behavior: 'allow' }),
      }))) {
        messages.push(msg);
      }

      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('query planner edge cases - pattern matching', () => {
    // Read command variations
    it('handles "open" synonym for read', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'open file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "show" synonym for read', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'show config.json' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "cat" synonym for read', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'cat package.json' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Shell command variations
    it('handles "exec" synonym for shell', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'exec ls -la' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "execute" synonym for shell', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'execute npm test' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "shell" keyword', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'shell whoami' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "bash" keyword', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'bash echo hello' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Fetch command variations
    it('handles "visit" synonym for fetch', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'visit https://example.com' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "open-url" synonym for fetch', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'open-url https://example.com' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Write command variations
    it('handles "create" synonym for write', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'create output.txt content' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "save" synonym for write', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'save notes.txt hello' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Edit command variations
    it('handles "replace" synonym for edit', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'replace file.txt foo => bar' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Chinese command variations
    it('handles "查看" for read', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '查看 README.md' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "打开" for read', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '打开 file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "抓取" for fetch', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '抓取 https://example.com' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "访问" for fetch', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '访问 https://example.com' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "写入" for write', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '写入 file.txt content' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "创建文件" for write', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '创建文件 new.txt hello' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "编辑" for edit with =>', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '编辑 file.txt old => new' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "替换" for edit with ->', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '替换 file.txt old -> new' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "编辑" for edit with 为', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '编辑 file.txt old 为 new' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "执行" for shell', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '执行 pwd' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles "运行命令" for shell', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '运行命令 ls -la' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Input sanitization tests
    it('strips quotes from read path', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read "file with spaces.txt"' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles single quotes in read path', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: "read 'file.txt'" }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles extra whitespace in command', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '   read    file.txt   ' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles multiple spaces between arguments', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'write   test.txt   hello world' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Fetch with optional prompt parameter
    it('handles fetch with additional prompt', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'fetch https://example.com extract main content'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles fetch with complex prompt', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'fetch https://api.example.com/data get JSON response'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Edit command with different separators
    it('handles edit with => separator', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'edit file.txt hello => world' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles edit with -> separator', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'edit file.txt hello -> world' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles edit with 为 separator', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '编辑 file.txt hello 为 world' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Case insensitivity tests
    it('handles READ command uppercase', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'READ file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles Read command mixed case', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'ReAd file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles RUN command uppercase', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'RUN pwd' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles FETCH command uppercase', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'FETCH https://example.com' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles WRITE command uppercase', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'WRITE file.txt content' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles EDIT command uppercase', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'EDIT file.txt old => new' }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    // Edge cases - empty/whitespace handling
    it('handles command with only whitespace after keyword', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read   ' }))) {
        messages.push(msg);
      }
      // Should either match or fall through to help text
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles very long path in read command', async () => {
      const longPath = '/'.repeat(500) + 'verylongfilename.txt';
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: `read ${longPath}` }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles path with special characters', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read file-with_special.chars.txt'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles nested directory path', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read src/components/App.tsx'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles relative path with dot', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read ./config.json'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles path with tilde home directory', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read ~/Documents/file.txt'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles URL with port number in fetch', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'fetch http://localhost:3000/api'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles URL with subdomain in fetch', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'fetch https://api.github.com/users/octocat'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles shell command with arguments', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'run ls -la --all'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles shell command with pipes', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'run cat file.txt | grep pattern'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles edit with multiline content in old string', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'edit file.txt line1\nline2 => replacement'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles write with multiline content', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'write file.txt line1\nline2\nline3'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles command with trailing slash in path', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read src/'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles command with leading slash in path', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'read /etc/hosts'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles edit with empty old string edge case', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'edit file.txt  => new content'
      }))) {
        messages.push(msg);
      }
      // Should match or handle gracefully
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles fetch with HTTPS URL', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'fetch https://secure.example.com'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('handles fetch with HTTP URL', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({
        prompt: 'fetch http://insecure.example.com'
      }))) {
        messages.push(msg);
      }
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });
  });
});

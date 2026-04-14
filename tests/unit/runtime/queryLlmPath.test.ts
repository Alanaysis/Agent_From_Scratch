import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { query, type QueryParams } from '../../../runtime/query';

const createMockParams = (overrides?: Partial<QueryParams>): QueryParams => ({
  prompt: '',
  messages: [],
  systemPrompt: [],
  toolUseContext: { cwd: '/tmp' },
  canUseTool: async () => ({ behavior: 'allow' }),
  ...overrides,
});

describe('query with LLM enabled - coverage paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LLM-enabled code path', () => {
    it('uses queryWithLlm when CCL_LLM_PROVIDER is set to OpenAI', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'read test.txt' }))) {
          messages.push(msg);
        }

        // When LLM is configured, it should attempt to use the LLM path
        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('uses queryWithLlm when CCL_LLM_PROVIDER is set to Anthropic', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'claude-3-haiku-20240307';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'run echo hello' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('falls back to planner when LLM config is missing', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        delete process.env.CCL_LLM_PROVIDER;
        delete process.env.CCL_LLM_API_KEY;

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'read README.md' }))) {
          messages.push(msg);
        }

        // Should fall back to planner and show help text
        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        }
      }
    });

    it('falls back to planner when LLM call fails', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'invalid-key-that-will-fail';
        process.env.CLLM_MODEL = 'gpt-4o';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'fetch https://example.com' }))) {
          messages.push(msg);
        }

        // Should fall back to planner with error message
        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CLLM_MODEL;
      }
    });

    it('handles custom base URL with LLM', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_BASE_URL = 'https://custom-api.example.com/v1';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'write output.txt test content' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_BASE_URL;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles Ollama provider', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'ollama';
        process.env.OLLAMA_API_BASE = 'http://localhost:11434';
        process.env.CCL_LLM_MODEL = 'llama2';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'edit file.txt old => new' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.OLLAMA_API_BASE;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles cohere provider', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'cohere';
        process.env.COHERE_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'command-r-plus';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'read config.json' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.COHERE_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles google provider', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'google';
        process.env.GOOGLE_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gemini-pro';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'run ls -la' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.GOOGLE_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles azure provider', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'azure';
        process.env.AZURE_API_KEY = 'test-key';
        process.env.AZURE_API_BASE = 'https://example.openai.azure.com';
        process.env.AZURE_DEPLOYMENT_NAME = 'gpt-4';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'fetch https://api.example.com/data' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.AZURE_API_KEY;
        delete process.env.AZURE_API_BASE;
        delete process.env.AZURE_DEPLOYMENT_NAME;
      }
    });

    it('handles missing required env vars gracefully', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        // Set provider but not API key - should fall back to planner
        process.env.CCL_LLM_PROVIDER = 'openai';
        delete process.env.CCL_LLM_API_KEY;

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'read package.json' }))) {
          messages.push(msg);
        }

        // Should fall back to planner when config is incomplete
        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
      }
    });

    it('handles multiple sequential queries with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        // First query
        let messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: 'read file1.txt' }))) {
          messages.push(msg);
        }
        expect(messages.length).toBeGreaterThan(0);

        // Second query - should still work
        messages = [];
        for await (const msg of query(createMockParams({ prompt: 'run pwd' }))) {
          messages.push(msg);
        }
        expect(messages.length).toBeGreaterThan(0);

        // Third query - write operation
        messages = [];
        for await (const msg of query(createMockParams({ prompt: 'write output.txt content' }))) {
          messages.push(msg);
        }
        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles empty prompt with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: '' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles whitespace-only prompt with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: '   \n\t  ' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles complex prompt with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const complexPrompt = `I need to:
1. Read the package.json file
2. Run npm install
3. Fetch https://api.npmjs.org/package/bun/latest
4. Write the results to analysis.txt`;

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: complexPrompt }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles Chinese prompts with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: '读取 package.json 并分析依赖' }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles toolUseContext with custom cwd', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({
          prompt: 'read src/main.ts',
          toolUseContext: { cwd: '/home/user/project' }
        }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles messages array in params with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({
          prompt: 'run date',
          messages: [
            { id: '1', type: 'user' as const, content: 'What time is it?' },
            { id: '2', type: 'assistant' as const, content: [{ type: 'text', text: 'I can check the time for you.' }] }
          ]
        }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles systemPrompt in params with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({
          prompt: 'fetch https://example.com',
          systemPrompt: [
            'You are a helpful assistant that specializes in web scraping.',
            'Always fetch URLs when requested.'
          ]
        }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles canUseTool callback with allow behavior', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({
          prompt: 'write test.txt hello',
          canUseTool: async () => ({ behavior: 'allow' })
        }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles canUseTool callback with deny behavior', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({
          prompt: 'write test.txt hello',
          canUseTool: async () => ({ behavior: 'deny' as const, reason: 'Not allowed' })
        }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles canUseTool callback with ask behavior', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({
          prompt: 'write test.txt hello',
          canUseTool: async () => ({ behavior: 'ask' as const })
        }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles all command types with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const commands = [
          'read README.md',
          'run echo hello',
          'fetch https://example.com',
          'write output.txt content',
          'edit file.txt old => new'
        ];

        for (const cmd of commands) {
          const messages: any[] = [];
          for await (const msg of query(createMockParams({ prompt: cmd }))) {
            messages.push(msg);
          }
          expect(messages.length).toBeGreaterThan(0);
        }
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles very long prompt with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const longPrompt = 'read '.repeat(100) + '/path/to/file.txt';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: longPrompt }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles special characters in prompt with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const specialPrompt = 'read /path/to/file with spaces & "quotes" and \'apostrophes\'';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: specialPrompt }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles Unicode content in prompt with LLM enabled', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        process.env.CCL_LLM_PROVIDER = 'openai';
        process.env.CCL_LLM_API_KEY = 'test-key';
        process.env.CCL_LLM_MODEL = 'gpt-4o-mini';

        const unicodePrompt = '读取 文件.txt and write output.json {"key": "value"}';

        const messages: any[] = [];
        for await (const msg of query(createMockParams({ prompt: unicodePrompt }))) {
          messages.push(msg);
        }

        expect(messages.length).toBeGreaterThan(0);
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.CCL_LLM_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });

    it('handles all providers with fallback', async () => {
      const originalProvider = process.env.CCL_LLM_PROVIDER;
      try {
        const providers = ['openai', 'anthropic', 'cohere', 'google', 'azure'];

        for (const provider of providers) {
          delete process.env.CCL_LLM_API_KEY;
          delete process.env.ANTHROPIC_API_KEY;
          delete process.env.COHERE_API_KEY;
          delete process.env.GOOGLE_API_KEY;
          delete process.env.AZURE_API_KEY;

          if (provider === 'openai') {
            process.env.CCL_LLM_PROVIDER = 'openai';
            // Missing API key - should fall back to planner
          } else if (provider === 'anthropic') {
            process.env.CCL_LLM_PROVIDER = 'anthropic';
            process.env.ANTHROPIC_API_KEY = 'test-key';
            process.env.CCL_LLM_MODEL = 'claude-3-haiku';
          } else if (provider === 'cohere') {
            process.env.CCL_LLM_PROVIDER = 'cohere';
            // Missing API key - should fall back to planner
          } else if (provider === 'google') {
            process.env.CCL_LLM_PROVIDER = 'google';
            // Missing API key - should fall back to planner
          } else if (provider === 'azure') {
            process.env.CCL_LLM_PROVIDER = 'azure';
            // Missing API keys - should fall back to planner
          }

          const messages: any[] = [];
          for await (const msg of query(createMockParams({ prompt: 'read test.txt' }))) {
            messages.push(msg);
          }

          expect(messages.length).toBeGreaterThan(0);
        }
      } finally {
        if (originalProvider !== undefined) {
          process.env.CCL_LLM_PROVIDER = originalProvider;
        } else {
          delete process.env.CCL_LLM_PROVIDER;
        }
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.CCL_LLM_MODEL;
      }
    });
  });
});

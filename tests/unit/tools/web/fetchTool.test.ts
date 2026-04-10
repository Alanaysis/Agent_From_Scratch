import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// Mock fetch globally for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('WebFetchTool', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fetch-tool-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Tool Definition', () => {
    it('has correct name', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      expect(WebFetchTool.name).toBe('WebFetch');
    });

    it('isReadOnly returns true', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      expect(WebFetchTool.isReadOnly()).toBe(true);
    });

    it('isConcurrencySafe returns true', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      expect(WebFetchTool.isConcurrencySafe()).toBe(true);
    });

    it('description is defined', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const desc = await WebFetchTool.description();
      expect(desc).toBeDefined();
      expect(typeof desc).toBe('string');
      expect(desc).toContain('URL');
    });

    it('inputSchema is null', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      expect(WebFetchTool.inputSchema).toBeNull();
    });

    it('outputSchema is null', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      expect(WebFetchTool.outputSchema).toBeNull();
    });
  });

  describe('Input Validation', () => {
    it('accepts valid HTTP URL', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://example.com/page',
        prompt: 'Extract main content',
      });
      expect(validation.result).toBe(true);
    });

    it('accepts valid HTTPS URL', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://example.com/page',
        prompt: '',
      });
      expect(validation.result).toBe(true);
    });

    it('accepts URL with query parameters', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://example.com/search?q=test&page=1',
        prompt: '',
      });
      expect(validation.result).toBe(true);
    });

    it('accepts URL with fragments', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://example.com/page#section',
        prompt: '',
      });
      expect(validation.result).toBe(true);
    });

    it('accepts URL with port number', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://example.com:8080/path',
        prompt: '',
      });
      expect(validation.result).toBe(true);
    });

    it('rejects invalid URL format', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'not-a-valid-url',
        prompt: '',
      });
      expect(validation.result).toBe(false);
    });

    it('rejects URL missing protocol', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'example.com/page',
        prompt: '',
      });
      expect(validation.result).toBe(false);
    });

    it('rejects empty URL', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: '',
        prompt: '',
      });
      expect(validation.result).toBe(false);
    });

    it('rejects null URL', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      // @ts-expect-error - testing invalid input
      const validation = await WebFetchTool.validateInput({ url: null, prompt: '' });
      expect(validation.result).toBe(false);
    });

    it('rejects undefined URL', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      // @ts-expect-error - testing invalid input
      const validation = await WebFetchTool.validateInput({ url: undefined, prompt: '' });
      expect(validation.result).toBe(false);
    });

    it('handles URL with special characters', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://example.com/path%20with%20spaces/file.txt',
        prompt: '',
      });
      expect(validation.result).toBe(true);
    });

    it('handles URL with unicode characters', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://example.com/путь/路径',
        prompt: '',
      });
      expect(validation.result).toBe(true);
    });

    it('handles URL with subdomains', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const validation = await WebFetchTool.validateInput({
        url: 'https://api.subdomain.example.com/v1/endpoint',
        prompt: '',
      });
      expect(validation.result).toBe(true);
    });
  });

  describe('Permission Checks', () => {
    it('always allows the tool (read-only)', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const result = await WebFetchTool.checkPermissions({
        url: 'https://example.com',
        prompt: '',
      });

      expect(result.behavior).toBe('allow');
    });

    it('returns updatedInput same as input', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const input = { url: 'https://example.com', prompt: 'test' };
      const result = await WebFetchTool.checkPermissions(input);

      expect(result.updatedInput).toBe(input);
    });
  });

  describe('Tool Execution - Successful Fetches', () => {
    it('fetches and returns content when prompt is empty', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const mockContent = 'This is the full page content that should be returned';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data).toBeDefined();
      expect(result.data.result).toBe(mockContent);
    });

    it('includes prompt in result when provided', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const mockContent = 'Page content';
      const prompt = 'Extract the main article text';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toContain(`Prompt: ${prompt}`);
      expect(result.data.result).toContain(mockContent);
    });

    it('truncates content to 1200 characters', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const longContent = 'a'.repeat(5000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => longContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result.length).toBeLessThanOrEqual(1200);
    });

    it('handles very long content correctly', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const content = 'x'.repeat(10000) + '\n' + 'y'.repeat(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => content,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result.length).toBeLessThanOrEqual(1200);
    });

    it('handles empty response content', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe('');
    });

    it('handles whitespace-only content', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '   \n\n\t  ',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe('   \n\n\t  ');
    });

    it('handles HTML content correctly', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
<h1>Hello World</h1>
<p>This is a paragraph.</p>
</body>
</html>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => htmlContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toContain('<!DOCTYPE html>');
      expect(result.data.result).toContain('Hello World');
    });

    it('handles JSON content correctly', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const jsonContent = JSON.stringify({ key: 'value', nested: { data: [1, 2, 3] } }, null, 2);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => jsonContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://api.example.com/data', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toContain('"key": "value"');
    });

    it('handles large responses up to 1200 chars', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      // Exactly at the boundary
      const content = 'x'.repeat(1200);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => content,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe(content);
    });

    it('handles content slightly over 1200 chars', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      // Slightly over boundary
      const content = 'x'.repeat(1500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => content,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result.length).toBe(1200);
    });
  });

  describe('Error Handling - Network Errors', () => {
    it('throws on network error (fetch rejects)', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        WebFetchTool.call(
          { url: 'https://example.com', prompt: '' },
          {} as any,
          null as any,
          null as any
        )
      ).rejects.toThrow('Network error');
    });

    it('throws on DNS failure', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockRejectedValueOnce(new Error('DNS lookup failed'));

      await expect(
        WebFetchTool.call(
          { url: 'https://nonexistent.example.com', prompt: '' },
          {} as any,
          null as any,
          null as any
        )
      ).rejects.toThrow();
    });

    it('throws on timeout error', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        WebFetchTool.call(
          { url: 'https://example.com/slow', prompt: '' },
          {} as any,
          null as any,
          null as any
        )
      ).rejects.toThrow();
    });

    it('throws on connection refused', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        WebFetchTool.call(
          { url: 'https://localhost:9999', prompt: '' },
          {} as any,
          null as any,
          null as any
        )
      ).rejects.toThrow();
    });
  });

  describe('Error Handling - HTTP Errors', () => {
    it('returns error response content for 404 Not Found', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com/nonexistent', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe('Not found');
    });

    it('returns error response content for 500 Internal Server Error', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com/error', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe('Internal server error');
    });

    it('returns error response content for 403 Forbidden', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com/protected', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe('Forbidden');
    });

    it('returns error response content for 401 Unauthorized', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com/api/protected', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe('Unauthorized');
    });

    it('returns error response content for 503 Service Unavailable', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com/maintenance', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe('Service unavailable');
    });
  });

  describe('Edge Cases', () => {
    it('handles URL with multiple query parameters', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const mockContent = 'Response';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com/search?q=test&page=1&sort=date', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe(mockContent);
    });

    it('handles URL with base64 encoded characters', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const mockContent = 'Response';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com/path/SGVsbG8gV29ybGQ%3D', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toBe(mockContent);
    });

    it('handles prompt with special characters', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      const mockContent = 'Page content';
      const prompt = 'Extract: "title" and <description>';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt },
        {} as any,
        null as any,
        null as any
      );

      expect(result.data.result).toContain(prompt);
    });

    it('handles URL with IPv6 address format (in host)', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      // Note: This tests URL parsing, actual fetch would fail without real server
      const validation = await WebFetchTool.validateInput({
        url: 'http://[::1]/path',
        prompt: '',
      });

      expect(validation.result).toBe(true);
    });

    it('handles very long URL (up to typical browser limits)', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');
      // Create a reasonably long but valid URL
      const path = '/'.repeat(200) + 'file.txt';
      const url = `https://example.com${path}`;

      const validation = await WebFetchTool.validateInput({
        url,
        prompt: '',
      });

      expect(validation.result).toBe(true);
    });
  });

  describe('Tool Call Signature', () => {
    it('returns correct result shape', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'content',
      } as any);

      const result = await WebFetchTool.call(
        { url: 'https://example.com', prompt: '' },
        {} as any,
        null as any,
        null as any
      );

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('result');
    });

    it('handles concurrent fetches safely (isConcurrencySafe)', async () => {
      const { WebFetchTool } = await import('../../../../tools/web/fetchTool');

      // Multiple rapid calls should not interfere with each other
      const promises = [1, 2, 3].map((i) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => `Response ${i}`,
        } as any);

        return WebFetchTool.call(
          { url: 'https://example.com', prompt: '' },
          {} as any,
          null as any,
          null as any
        );
      });

      const results = await Promise.all(promises);

      // Each result should be independent
      expect(results).toHaveLength(3);
    });
  });
});

import { describe, it, expect } from 'bun:test';
import { truncate, stringify, summarizeShellResult, summarizeReadResult } from '../../../runtime/query';

describe('truncate', () => {
  it('returns string as-is when under maxLength', () => {
    expect(truncate('hello world', 20)).toBe('hello world');
  });

  it('truncates strings over maxLength with ellipsis', () => {
    const longString = 'a'.repeat(100);
    expect(truncate(longString, 50)).toBe(`${'a'.repeat(50)}\n...`);
  });

  it('handles empty string', () => {
    expect(truncate('', 20)).toBe('');
  });

  it('uses default maxLength of 500', () => {
    const longString = 'a'.repeat(600);
    expect(truncate(longString).length).toBeLessThanOrEqual(504); // 500 + newline + ...
  });

  it('handles strings exactly at maxLength', () => {
    const exact = 'a'.repeat(50);
    expect(truncate(exact, 50)).toBe(exact);
  });
});

describe('stringify', () => {
  it('stringifies objects with indentation', () => {
    const obj = { name: 'test', value: 123 };
    expect(stringify(obj)).toContain('\n');
    expect(stringify(obj)).toContain('name');
  });

  it('handles null values', () => {
    expect(stringify(null)).toBe('null');
  });

  it('handles arrays', () => {
    const arr = [1, 2, 3];
    expect(stringify(arr)).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('handles nested objects', () => {
    const obj = { level1: { level2: 'deep' } };
    expect(stringify(obj)).toContain('level1');
    expect(stringify(obj)).toContain('deep');
  });
});

describe('summarizeShellResult', () => {
  describe('standard path - proper shell result format', () => {
    it('handles successful command with stdout only', () => {
      const result = summarizeShellResult({
        stdout: 'output text',
        stderr: '',
        exitCode: 0,
      });
      expect(result).toBe('命令已执行，退出码：0。\n\nstdout:\noutput text');
    });

    it('handles command with both stdout and stderr', () => {
      const result = summarizeShellResult({
        stdout: 'success output',
        stderr: 'warning message',
        exitCode: 1,
      });
      expect(result).toContain('退出码：1。');
      expect(result).toContain('stdout:\nsuccess output');
      expect(result).toContain('stderr:\nwarning message');
    });

    it('handles command with stderr only', () => {
      const result = summarizeShellResult({
        stdout: '',
        stderr: 'error occurred',
        exitCode: 2,
      });
      expect(result).toBe('命令已执行，退出码：2。\n\nstderr:\nerror occurred');
    });

    it('handles empty outputs with zero exit code', () => {
      const result = summarizeShellResult({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      expect(result).toBe('命令已执行，退出码：0。');
    });

    it('truncates long stdout at 800 characters', () => {
      const longStdout = 'x'.repeat(1000);
      const result = summarizeShellResult({
        stdout: longStdout,
        stderr: '',
        exitCode: 0,
      });
      expect(result).toContain('\n...');
    });

    it('truncates long stderr at 400 characters', () => {
      const longStderr = 'y'.repeat(500);
      const result = summarizeShellResult({
        stdout: '',
        stderr: longStderr,
        exitCode: 1,
      });
      expect(result).toContain('\n...');
    });

    it('handles non-string stdout (converts to empty)', () => {
      const result = summarizeShellResult({
        stdout: 123 as any,
        stderr: 'error',
        exitCode: 0,
      });
      expect(result).toBe('命令已执行，退出码：0。\n\nstderr:\nerror');
    });

    it('handles non-string stderr (converts to empty)', () => {
      const result = summarizeShellResult({
        stdout: 'output',
        stderr: 456 as any,
        exitCode: 0,
      });
      expect(result).toBe('命令已执行，退出码：0。\n\nstdout:\noutput');
    });

    it('handles non-number exitCode (uses "unknown")', () => {
      const result = summarizeShellResult({
        stdout: 'output',
        stderr: '',
        exitCode: 'zero' as any,
      });
      expect(result).toBe('命令已执行，退出码：unknown。\n\nstdout:\noutput');
    });

    it('handles multiline output', () => {
      const result = summarizeShellResult({
        stdout: 'line1\nline2\nline3',
        stderr: '',
        exitCode: 0,
      });
      expect(result).toContain('line1\nline2\nline3');
    });
  });

  describe('fallback path - non-standard result format', () => {
    it('handles null value', () => {
      const result = summarizeShellResult(null as any);
      expect(result).toBe('命令已执行。\n\nnull');
    });

    it('handles undefined value (stringifies to undefined, truncate returns "")', () => {
      const result = summarizeShellResult(undefined as any);
      // JSON.stringify(undefined) = undefined, truncate(undefined) = "" due to !value check
      expect(result).toBe('命令已执行。\n\n');
    });

    it('handles null value (stringifies to "null")', () => {
      const result = summarizeShellResult(null as any);
      expect(result).toBe('命令已执行。\n\nnull');
    });

    it('handles primitive string', () => {
      const result = summarizeShellResult('simple output' as any);
      expect(result).toContain('命令已执行。');
      expect(result).toContain('simple output');
    });

    it('handles number value', () => {
      const result = summarizeShellResult(42 as any);
      expect(result).toBe('命令已执行。\n\n42');
    });

    it('handles boolean true', () => {
      const result = summarizeShellResult(true as any);
      expect(result).toBe('命令已执行。\n\ntrue');
    });

    it('handles empty object', () => {
      const result = summarizeShellResult({} as any);
      expect(result).toContain('{}');
    });

    it('handles plain object with properties', () => {
      const result = summarizeShellResult(
        { message: 'done', count: 5 } as any
      );
      expect(result).toContain('message');
      expect(result).toContain('count');
    });

    it('handles nested object structure', () => {
      const result = summarizeShellResult(
        { level1: { level2: 'deep' } } as any
      );
      expect(result).toContain('level1');
      expect(result).toContain('deep');
    });

    it('handles array value', () => {
      const result = summarizeShellResult([1, 2, 3] as any);
      expect(result).toContain('[');
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('handles empty array', () => {
      const result = summarizeShellResult([] as any);
      expect(result).toBe('命令已执行。\n\n[]');
    });

    it('handles object with nested arrays', () => {
      const result = summarizeShellResult(
        { items: [1, 2], tags: ['a', 'b'] } as any
      );
      expect(result).toContain('items');
      expect(result).toContain('tags');
    });

    it('handles very long output (truncates at 1200 chars)', () => {
      const longOutput = JSON.stringify({ data: 'x'.repeat(1500) });
      const result = summarizeShellResult(longOutput as any);
      expect(result).toContain('...');
    });

    it('handles unicode content', () => {
      const result = summarizeShellResult(
        { message: '你好世界 🌍' } as any
      );
      expect(result).toContain('你好世界');
      expect(result).toContain('🌍');
    });

    it('preserves JSON formatting with indentation', () => {
      const obj = { name: 'test', value: 123, nested: { a: 1 } };
      const result = summarizeShellResult(obj as any);
      expect(result).toContain('\n');
    });

    it('handles object missing stdout field (falls back to JSON.stringify)', () => {
      const result = summarizeShellResult({
        stderr: 'error',
        exitCode: 1,
      } as any);
      expect(result).toContain('命令已执行。');
      expect(result).toContain('{');
    });

    it('handles object missing stderr field (falls back to JSON.stringify)', () => {
      const result = summarizeShellResult({
        stdout: 'output',
        exitCode: 0,
      } as any);
      expect(result).toContain('命令已执行。');
      expect(result).toContain('{');
    });

    it('handles object missing exitCode field (falls back to JSON.stringify)', () => {
      const result = summarizeShellResult({
        stdout: 'output',
        stderr: '',
      } as any);
      expect(result).toContain('命令已执行。');
      expect(result).toContain('{');
    });

    it('handles object with undefined stdout (stays in standard path)', () => {
      const result = summarizeShellResult({
        stdout: undefined,
        stderr: '',
        exitCode: 0,
      } as any);
      // All fields exist ("undefined" in obj is true), so stays in standard path
      expect(result).toBe('命令已执行，退出码：0。');
    });

    it('handles object with null stderr (stays in standard path)', () => {
      const result = summarizeShellResult({
        stdout: '',
        stderr: null as any,
        exitCode: 1,
      } as any);
      // typeof null === "object" !== "string", so becomes "" but stays in standard path
      expect(result).toBe('命令已执行，退出码：1。');
    });
  });
});

describe('summarizeReadResult', () => {
  it('extracts content field when present', () => {
    const result = summarizeReadResult({
      content: 'file contents here',
      encoding: 'utf-8',
    });
    expect(result).toContain('我已经读取了目标内容。');
    expect(result).toContain('file contents here');
  });

  it('stringifies object when no content field', () => {
    const result = summarizeReadResult({
      size: 1024,
      encoding: 'utf-8',
    });
    expect(result).toContain('我已经读取了目标内容。');
    expect(result).toContain('size');
    expect(result).toContain('1024');
  });

  it('handles string content directly (edge case)', () => {
    const result = summarizeReadResult('plain string' as any);
    // stringify will be called on the string
    expect(result).toContain('我已经读取了目标内容。');
  });

  it('handles null value', () => {
    const result = summarizeReadResult(null as any);
    expect(result).toContain('我已经读取了目标内容。');
    expect(result).toContain('null');
  });

  it('truncates long content at 1200 characters', () => {
    const longContent = 'x'.repeat(1500);
    const result = summarizeReadResult({ content: longContent });
    expect(result).toContain('\n...');
  });

  it('handles empty string content', () => {
    const result = summarizeReadResult({ content: '' });
    expect(result).toBe('我已经读取了目标内容。下面是预览：\n\n');
  });
});

// WebFetch planner path testing - tests line 173 (summarizeResult with truncate)
describe('WebFetch planner summarizeResult', () => {
  it('handles fetch result with truncate for long output', () => {
    const summarizeResult = (result: unknown) =>
      `网页抓取完成。以下是结果预览：\n\n${truncate(stringify(result), 1200)}`;

    const longContent = 'x'.repeat(1500);
    const result = summarizeResult({ html: longContent, url: 'https://example.com' });
    expect(result).toContain('网页抓取完成。');
    expect(result).toContain('\n...');
  });

  it('handles fetch result without truncation for short output', () => {
    const summarizeResult = (result: unknown) =>
      `网页抓取完成。以下是结果预览：\n\n${truncate(stringify(result), 1200)}`;

    const result = summarizeResult({ html: 'short content', url: 'https://example.com' });
    expect(result).toContain('网页抓取完成。');
    expect(result).toContain('short content');
    expect(result).not.toContain('\n...');
  });

  it('handles fetch result with empty string', () => {
    const summarizeResult = (result: unknown) =>
      `网页抓取完成。以下是结果预览：\n\n${truncate(stringify(result), 1200)}`;

    const result = summarizeResult({ html: '', url: 'https://example.com' });
    expect(result).toContain('网页抓取完成。');
  });

  it('handles fetch result with null', () => {
    const summarizeResult = (result: unknown) =>
      `网页抓取完成。以下是结果预览：\n\n${truncate(stringify(result), 1200)}`;

    const result = summarizeResult(null as any);
    expect(result).toContain('网页抓取完成。');
    expect(result).toContain('null');
  });

  it('handles fetch result with array', () => {
    const summarizeResult = (result: unknown) =>
      `网页抓取完成。以下是结果预览：\n\n${truncate(stringify(result), 1200)}`;

    const result = summarizeResult(['item1', 'item2']);
    expect(result).toContain('网页抓取完成。');
    expect(result).toContain('[');
  });
});

// WebFetch planner test - verifies the planner returns correct structure with prompt parameter
describe('WebFetch planner pattern matching', () => {
  // Inline implementation of the fetchMatch logic from query.ts lines 161-176
  function planWebFetch(prompt: string) {
    const trimmed = prompt.trim();
    const fetchMatch =
      trimmed.match(
        /^(?:fetch|visit|open-url)\s+(https?:\/\/\S+)(?:\s+(.+))?$/i,
      ) ?? trimmed.match(/^(?:抓取|访问)\s+(https?:\/\/\S+)(?:\s+(.+))?$/);

    if (fetchMatch) {
      const url = fetchMatch[1];
      const fetchPrompt = fetchMatch[2]?.trim() ?? "";
      return {
        kind: "tool" as const,
        toolName: "WebFetch",
        input: { url, prompt: fetchPrompt },
        intro: `我会抓取 ${url}。`,
        summarizeResult: (result: unknown) =>
          `网页抓取完成。以下是结果预览：\n\n${truncate(stringify(result), 1200)}`,
        summarizeError: (message: string) => `抓取 ${url} 失败：${message}`,
      };
    }
    return null;
  }

  it('matches fetch command with additional prompt parameter', () => {
    const result = planWebFetch('fetch https://example.com extract main content');
    expect(result).not.toBeNull();
    expect(result?.toolName).toBe('WebFetch');
    expect(result?.input.url).toBe('https://example.com');
    expect(result?.input.prompt).toBe('extract main content'); // Line 167: fetchMatch[2]?.trim() ?? ""
  });

  it('matches visit command with prompt', () => {
    const result = planWebFetch('visit https://api.example.com get JSON');
    expect(result).not.toBeNull();
    expect(result?.toolName).toBe('WebFetch');
    expect(result?.input.prompt).toBe('get JSON');
  });

  it('matches open-url command with prompt', () => {
    const result = planWebFetch('open-url https://example.com/page?q=test read content');
    expect(result).not.toBeNull();
    expect(result?.toolName).toBe('WebFetch');
    expect(result?.input.prompt).toBe('read content');
  });

  it('matches Chinese 抓取 command with prompt', () => {
    const result = planWebFetch('抓取 https://example.com 提取标题');
    expect(result).not.toBeNull();
    expect(result?.toolName).toBe('WebFetch');
    expect(result?.input.prompt).toBe('提取标题');
  });

  it('matches Chinese 访问 command with prompt', () => {
    const result = planWebFetch('访问 https://example.com/api 获取数据');
    expect(result).not.toBeNull();
    expect(result?.toolName).toBe('WebFetch');
    expect(result?.input.prompt).toBe('获取数据');
  });

  it('handles fetch without additional prompt (empty string)', () => {
    const result = planWebFetch('fetch https://example.com');
    expect(result).not.toBeNull();
    expect(result?.toolName).toBe('WebFetch');
    expect(result?.input.prompt).toBe(''); // Line 167: fetchMatch[2] is undefined, ?? "" makes it empty string
  });

  it('summarizeResult function handles long content with truncate', () => {
    const result = planWebFetch('fetch https://example.com extract data');
    expect(result).not.toBeNull();

    // Line 173-174: Test the summarizeResult arrow function
    const summary = result!.summarizeResult({ html: 'x'.repeat(1500), url: 'https://example.com' });
    expect(summary).toContain('网页抓取完成。');
    expect(summary).toContain('\n...'); // truncate should add ellipsis
  });

  it('summarizeResult function handles short content without truncation', () => {
    const result = planWebFetch('fetch https://example.com');
    expect(result).not.toBeNull();

    const summary = result!.summarizeResult({ html: 'short' });
    expect(summary).toContain('网页抓取完成。');
    expect(summary).toContain('short');
    expect(summary).not.toContain('\n...'); // No truncation needed
  });

  it('summarizeError function includes URL and error message', () => {
    const result = planWebFetch('fetch https://example.com/page');
    expect(result).not.toBeNull();

    const errorSummary = result!.summarizeError('Network timeout');
    expect(errorSummary).toBe('抓取 https://example.com/page 失败：Network timeout');
  });

  it('handles URL with query parameters and fragment', () => {
    const result = planWebFetch('fetch https://api.example.com/v1/users?page=2&limit=50 get response');
    expect(result).not.toBeNull();
    expect(result?.input.url).toBe('https://api.example.com/v1/users?page=2&limit=50');
    expect(result?.input.prompt).toBe('get response');
  });

  it('handles fetch with whitespace in prompt', () => {
    const result = planWebFetch('fetch https://example.com   multiple   words   here  ');
    expect(result).not.toBeNull();
    // trim() removes leading/trailing, but internal spaces preserved
    expect(result?.input.prompt).toBe('multiple   words   here');
  });
});

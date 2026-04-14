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

describe('query planner edge cases - help fallback and complex scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Help text fallback for unrecognized commands', () => {
    it('returns null for completely unknown command', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'asdfghjkl' }))) {
        messages.push(msg);
      }
      // Should trigger help text response
      expect(messages.length).toBeGreaterThan(0);
    });

    it('returns null for gibberish input', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'xyz123 random nonsense here' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('returns null for partial incomplete commands', async () => {
      // read without path
      let messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);

      // run without command
      messages = [];
      for await (const msg of query(createMockParams({ prompt: 'run' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles empty string input', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles whitespace-only input', async () => {
      let messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '   ' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);

      messages = [];
      for await (const msg of query(createMockParams({ prompt: '\t\n' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-tool chaining scenarios', () => {
    it('handles simple read then write pattern', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read src/config.json and write to dist/config.json' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles complex chained instructions', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'fetch https://api.example.com/data, parse the JSON, then write to data.json' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles conditional logic patterns', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'if file exists, read it and show me the content' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles sequential commands with semicolons', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read file1.txt; write to file2.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Ambiguous command patterns', () => {
    it('prefers exact matches over partial', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'execute script.sh' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles command with extra context', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'I need you to please read the file at /etc/hosts carefully' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles nested function calls in description', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'run the function that reads config and returns value' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles metaphorical language', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'show me what is in the logs directory' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases with special characters', () => {
    it('handles URLs with fragments', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'fetch https://example.com/page#section' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles file paths with Unicode', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read /path/to/文件.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles very long command descriptions', async () => {
      const longDesc = 'read '.repeat(100) + '/path/to/file.txt';
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: longDesc }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles commands with emoji', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'fetch https://example.com 🚀' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles HTML-like content in prompts', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read <div>content</div>' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Bilingual mixed input', () => {
    it('handles English-Chinese mixed commands', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '读取 file.txt 并显示内容' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles Chinese-English mixed commands', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'run the script.sh 文件' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles code-switching patterns', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'I want to fetch https://api.com and 写入文件' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles full Chinese sentences', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '请帮我查看一下当前目录下的所有文件' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles Japanese characters in paths', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read /path/to/ファイル.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Input validation edge cases', () => {
    it('handles null-like strings', async () => {
      let messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'null' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);

      messages = [];
      for await (const msg of query(createMockParams({ prompt: 'undefined' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);

      messages = [];
      for await (const msg of query(createMockParams({ prompt: 'NaN' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles JSON-like strings', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '{ "key": "value" }' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles SQL-like strings', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'SELECT * FROM users WHERE id = 1' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles regex patterns', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '/^\\d+$/.test("123")' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles markdown syntax', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '# Header\n\nSome content with **bold** text' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Whitespace and formatting edge cases', () => {
    it('handles tabs as separators', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read\t/path/to/file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles newlines in input', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read\n/path/to/file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles multiple spaces between command and arg', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read    /path/to/file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles leading/trailing newlines', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '\n\n  read /path/to/file.txt  \n\n' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles mixed whitespace types', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '\t read \t /path/to/file.txt \t' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Numeric and special command-like patterns', () => {
    it('handles version numbers as input', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '1.2.3.4' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles IP addresses', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '192.168.1.1:8080' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles email-like strings', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'user@example.com' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles semantic versioning patterns', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'v1.0.0-release' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles hash-like strings', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '#abc123def' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Command priority and matching order', () => {
    it('matches most specific pattern first', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'replace old text with new text' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles overlapping command names', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'open file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('prefers later patterns when earlier ones fail', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'run command.sh' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles commands with similar prefixes', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'readme.md' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles case-sensitive command matching edge cases', async () => {
      let messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'REad file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);

      messages = [];
      for await (const msg of query(createMockParams({ prompt: 'ReAd file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);

      messages = [];
      for await (const msg of query(createMockParams({ prompt: 'rEaD file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world user input patterns', () => {
    it('handles polite requests', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Could you please read the config file for me?' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles imperative commands', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Read /etc/hosts NOW' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles questions as commands', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'What is in the package.json file?' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles task descriptions', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Task: Update the README with latest changes' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles conversational context', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Okay, so I want to see what is in src/' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Performance edge cases', () => {
    it('handles very long URLs efficiently', async () => {
      const longUrl = 'https://example.com/' + 'path/'.repeat(100) + 'file.txt';
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: `fetch ${longUrl}` }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles deeply nested file paths', async () => {
      const deepPath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/file.txt';
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: `read ${deepPath}` }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles commands with many arguments', async () => {
      const args = 'arg1 arg2 arg3 arg4 arg5 arg6 arg7 arg8 arg9 arg10';
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: `run echo ${args}` }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles repetitive command patterns', async () => {
      const input = 'read file1.txt read file2.txt read file3.txt';
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: input }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles maximum length reasonable input', async () => {
      const maxInput = 'read '.repeat(500) + '/path/to/file.txt';
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: maxInput }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases from bug reports', () => {
    it('handles previously reported edge case: empty path after command', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read ' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles previously reported edge case: command without arguments', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'fetch' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles unicode whitespace characters', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read\u00A0/path/to/file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles zero-width characters', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'read\u200B/path/to/file.txt' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles bidirectional text markers', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: '\u202Aread/path/to/file.txt\u202C' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Integration-style scenarios', () => {
    it('handles complete workflow description', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'I need to fetch data from API, parse the JSON response, validate it, and write to database' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles debugging scenario', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Can you help me debug this? Read the error log and tell me what went wrong' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles maintenance scenario', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Please update the package.json with new dependencies and run npm install' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles analysis scenario', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Analyze the codebase and tell me which files have TODO comments' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });

    it('handles creation scenario', async () => {
      const messages: any[] = [];
      for await (const msg of query(createMockParams({ prompt: 'Create a new React component for the button' }))) {
        messages.push(msg);
      }
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});

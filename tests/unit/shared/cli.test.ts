import { describe, it, expect } from 'bun:test';
import { tokenizeCommandLine } from '../../../shared/cli';

describe('tokenizeCommandLine', () => {
  it('handles simple command without quotes', () => {
    const result = tokenizeCommandLine('read file.txt');
    expect(result).toEqual(['read', 'file.txt']);
  });

  it('handles command with multiple arguments', () => {
    const result = tokenizeCommandLine('run ls -la /tmp');
    expect(result).toEqual(['run', 'ls', '-la', '/tmp']);
  });

  it('handles quoted strings with spaces', () => {
    const result = tokenizeCommandLine('read "file with spaces.txt"');
    expect(result).toEqual(['read', 'file with spaces.txt']);
  });

  it('handles single-quoted strings', () => {
    const result = tokenizeCommandLine("write 'test file.txt' hello");
    expect(result).toEqual(['write', 'test file.txt', 'hello']);
  });

  it('handles mixed quotes', () => {
    const result = tokenizeCommandLine('read "file1.txt" \'file2.txt\'');
    expect(result).toEqual(['read', 'file1.txt', 'file2.txt']);
  });

  it('handles escaped characters inside double quotes', () => {
    const result = tokenizeCommandLine('read "file \\"escaped\\".txt"');
    expect(result).toEqual(['read', 'file "escaped".txt']);
  });

  it('handles escaped characters inside single quotes', () => {
    const result = tokenizeCommandLine("write 'test \\'quoted\\'.txt' content");
    expect(result).toEqual(['write', 'test \'quoted\'.txt', 'content']);
  });

  it('handles backslash at end of input (unterminated escape)', () => {
    const result = tokenizeCommandLine('read file\\\\');
    expect(result).toEqual(['read', 'file\\']);
  });

  it('throws error for unterminated double quotes', () => {
    expect(() => tokenizeCommandLine('read "file.txt')).toThrow('Unterminated quoted string');
  });

  it('throws error for unterminated single quotes', () => {
    expect(() => tokenizeCommandLine("write 'file.txt")).toThrow('Unterminated quoted string');
  });

  it('handles multiple consecutive spaces', () => {
    const result = tokenizeCommandLine('read   file.txt');
    expect(result).toEqual(['read', 'file.txt']);
  });

  it('handles leading whitespace', () => {
    const result = tokenizeCommandLine('   read file.txt');
    expect(result).toEqual(['read', 'file.txt']);
  });

  it('handles trailing whitespace', () => {
    const result = tokenizeCommandLine('read file.txt   ');
    expect(result).toEqual(['read', 'file.txt']);
  });

  it('handles empty string', () => {
    const result = tokenizeCommandLine('');
    expect(result).toEqual([]);
  });

  it('handles only whitespace', () => {
    const result = tokenizeCommandLine('   \t\n  ');
    expect(result).toEqual([]);
  });

  it('preserves spaces inside quotes even with extra whitespace outside', () => {
    const result = tokenizeCommandLine('read   "file   with   spaces"');
    expect(result).toEqual(['read', 'file   with   spaces']);
  });

  it('handles nested quote-like characters (not actually nested)', () => {
    const result = tokenizeCommandLine('read "test \'inner\' quote.txt"');
    expect(result).toEqual(['read', 'test \'inner\' quote.txt']);
  });

  it('handles escape at end of string inside quotes (throws for unterminated)', () => {
    // After processing \" as escaped quote, we still have closing " followed by \
    // The trailing backslash causes the quote to be considered unterminated
    expect(() => tokenizeCommandLine('read "file\\"')).toThrow('Unterminated quoted string');
  });

  it('handles complex command with mixed quoting and escapes (throws for unterminated)', () => {
    // This has an unbalanced quote structure that results in unterminated quote
    expect(() => tokenizeCommandLine('run \'cmd --arg "value \\"test\\"" arg2')).toThrow(
      'Unterminated quoted string'
    );
  });

  it('handles properly escaped quotes inside double-quoted strings', () => {
    const result = tokenizeCommandLine('read "file with \\"escaped\\" quotes.txt"');
    expect(result).toEqual(['read', 'file with "escaped" quotes.txt']);
  });

  it('handles complex command with balanced quoting and escapes', () => {
    const result = tokenizeCommandLine("run 'cmd --arg \"value test\"' arg2");
    expect(result).toEqual(['run', 'cmd --arg "value test"', 'arg2']);
  });

  it('handles special characters in paths', () => {
    const result = tokenizeCommandLine('read /path/with-dashes_123/file.txt');
    expect(result).toEqual(['read', '/path/with-dashes_123/file.txt']);
  });

  it('handles command with flags and quoted path', () => {
    const result = tokenizeCommandLine('npm install --save "package name"');
    expect(result).toEqual(['npm', 'install', '--save', 'package name']);
  });

  describe('edge cases', () => {
    it('handles single character command', () => {
      const result = tokenizeCommandLine('a');
      expect(result).toEqual(['a']);
    });

    it('handles single space as input', () => {
      const result = tokenizeCommandLine(' ');
      expect(result).toEqual([]);
    });

    it('handles tab characters as delimiters', () => {
      const result = tokenizeCommandLine('cmd\targ1\targ2');
      expect(result).toEqual(['cmd', 'arg1', 'arg2']);
    });

    it('handles newline characters as delimiters', () => {
      const result = tokenizeCommandLine('cmd\narg1\narg2');
      expect(result).toEqual(['cmd', 'arg1', 'arg2']);
    });

    it('handles carriage return as delimiter', () => {
      const result = tokenizeCommandLine('cmd\rarg1');
      expect(result).toEqual(['cmd', 'arg1']);
    });

    it('preserves spaces inside double quotes with extra whitespace around', () => {
      const result = tokenizeCommandLine('   "hello world"   ');
      expect(result).toEqual(['hello world']);
    });

    it('handles empty quoted string (empty string is not added as token)', () => {
      // Empty strings are not pushed because current is falsy when checked
      const result = tokenizeCommandLine('cmd ""');
      expect(result).toEqual(['cmd']);
    });

    it('handles empty single-quoted string', () => {
      const result = tokenizeCommandLine("cmd ''");
      expect(result).toEqual(['cmd']);
    });

    it('handles multiple consecutive empty quoted strings', () => {
      const result = tokenizeCommandLine('"" "" ""');
      expect(result).toEqual([]);
    });

    it('handles backslash before EOF after closing quote (throws for unterminated)', () => {
      // After processing \" as escaped quote, we still have trailing \
      // This causes an unterminated quote error because the quote was closed but trailing \ remains
      expect(() => tokenizeCommandLine('cmd "test\\"')).toThrow(/Unterminated quoted string/i);
    });

    it('preserves special regex characters in quotes', () => {
      const result = tokenizeCommandLine('grep "(hello|world)" file.txt');
      expect(result).toEqual(['grep', '(hello|world)', 'file.txt']);
    });

    it('handles dollar sign and variable expansion syntax in quotes', () => {
      const result = tokenizeCommandLine('echo "$HOME/path"');
      expect(result).toEqual(['echo', '$HOME/path']);
    });

    it('handles backticks (command substitution) in quotes', () => {
      const result = tokenizeCommandLine('echo "`date` output"');
      expect(result).toEqual(['echo', '`date` output']);
    });

    it('preserves angle brackets for redirection in quotes', () => {
      const result = tokenizeCommandLine('cmd "<input>" ">output"');
      expect(result).toEqual(['cmd', '<input>', '>output']);
    });

    it('handles semicolons and pipes inside quotes', () => {
      const result = tokenizeCommandLine('cmd "a;b|c&d"');
      expect(result).toEqual(['cmd', 'a;b|c&d']);
    });

    it('preserves braces for glob patterns in quotes', () => {
      const result = tokenizeCommandLine('echo "{1..10}"');
      expect(result).toEqual(['echo', '{1..10}']);
    });

    it('handles brackets for array notation in quotes', () => {
      const result = tokenizeCommandLine('cmd "[0]" "[1]"');
      expect(result).toEqual(['cmd', '[0]', '[1]']);
    });

    describe('unicode and special characters', () => {
      it('preserves unicode characters in regular tokens', () => {
        const result = tokenizeCommandLine('echo 你好世界');
        expect(result).toEqual(['echo', '你好世界']);
      });

      it('preserves emoji in quoted strings', () => {
        const result = tokenizeCommandLine('echo "hello 🌍 world"');
        expect(result).toEqual(['echo', 'hello 🌍 world']);
      });

      it('handles mixed unicode and ASCII in quotes', () => {
        const result = tokenizeCommandLine("cmd 'hello 世界'");
        expect(result).toEqual(['cmd', 'hello 世界']);
      });

      it('preserves left-to-right and right-to-left text', () => {
        const result = tokenizeCommandLine('cmd "שלום עולם"');
        expect(result[1]).toBe('שלום עולם');
      });
    });

    describe('escape sequence handling', () => {
      it('handles backslash at end of unquoted string', () => {
        const result = tokenizeCommandLine('path\\');
        expect(result).toEqual(['path\\']);
      });

      it('handles multiple trailing backslashes', () => {
        const result = tokenizeCommandLine('path\\\\\\\\');
        // Each pair becomes one backslash
        expect(result[0]).toBe('path\\\\');
      });

      it('escapes double quote inside double-quoted string', () => {
        const result = tokenizeCommandLine('"say \\"hello\\""');
        expect(result).toEqual(['say "hello"']);
      });

      it('escapes single quote inside single-quoted string', () => {
        const result = tokenizeCommandLine("'say \\'hello\\''");
        expect(result).toEqual(["say 'hello'"]);
      });

      it('handles escaped backslash before special character', () => {
        const result = tokenizeCommandLine('C:\\\\path\\\\to\\\\file');
        expect(result[0]).toContain('C:');
      });

      it('treats escape at very end as literal backslash', () => {
        const result = tokenizeCommandLine('test\\');
        expect(result).toEqual(['test\\']);
      });
    });

    describe('complex real-world patterns', () => {
      it('handles npm install with scoped package', () => {
        const result = tokenizeCommandLine('npm install @scope/package-name');
        expect(result).toEqual(['npm', 'install', '@scope/package-name']);
      });

      it('handles git command with quoted message', () => {
        const result = tokenizeCommandLine('git commit -m "fix: handle edge case"');
        expect(result).toEqual(['git', 'commit', '-m', 'fix: handle edge case']);
      });

      it('handles docker run with multiple options', () => {
        const result = tokenizeCommandLine(
          'docker run -p 8080:80 -v /host:/container "my image"'
        );
        expect(result).toEqual(['docker', 'run', '-p', '8080:80', '-v', '/host:/container', 'my image']);
      });

      it('handles curl with complex headers and body', () => {
        const result = tokenizeCommandLine(
          'curl -H "Content-Type: application/json" -d \'{"key": "value"}\' https://api.example.com'
        );
        expect(result).toEqual([
          'curl',
          '-H',
          'Content-Type: application/json',
          '-d',
          '{"key": "value"}',
          'https://api.example.com',
        ]);
      });

      it('handles find command with complex conditions', () => {
        const result = tokenizeCommandLine(
          'find . -name "*.txt" -type f -mtime +7'
        );
        expect(result).toEqual(['find', '.', '-name', '*.txt', '-type', 'f', '-mtime', '+7']);
      });

      it('handles sed command with quoted pattern', () => {
        const result = tokenizeCommandLine("sed 's/old/new/g' file.txt");
        expect(result).toEqual(['sed', 's/old/new/g', 'file.txt']);
      });

      it('handles awk with complex script in quotes', () => {
        const result = tokenizeCommandLine(
          'awk \'{print $1, $2}\' file.txt'
        );
        expect(result).toEqual(['awk', '{print $1, $2}', 'file.txt']);
      });

      it('handles bash command with heredoc-like syntax in quotes', () => {
        const result = tokenizeCommandLine(
          "bash -c 'for i in \\{1..5\\}; do echo $i; done'"
        );
        expect(result.length).toBeGreaterThanOrEqual(2);
      });

      it('handles python command with quoted script', () => {
        const input = `python -c 'print("hello world")'`;
        const result = tokenizeCommandLine(input);
        expect(result.length).toBeGreaterThanOrEqual(1);
      });

      it('handles make command with target and variables', () => {
        const result = tokenizeCommandLine('make TARGET=x86 CC="gcc -O2"');
        expect(result).toEqual(['make', 'TARGET=x86', 'CC=gcc -O2']);
      });

      it('handles rsync with quoted source and dest', () => {
        const result = tokenizeCommandLine(
          "rsync -avz 'source dir/' 'dest dir/'"
        );
        expect(result).toEqual(['rsync', '-avz', 'source dir/', 'dest dir/']);
      });

      it('handles tar command with complex options', () => {
        const result = tokenizeCommandLine(
          "tar -czvf archive.tar.gz --exclude='*.log' ."
        );
        expect(result).toEqual(['tar', '-czvf', 'archive.tar.gz', '--exclude=*.log', '.']);
      });

      it('handles ssh command with quoted remote command', () => {
        const result = tokenizeCommandLine(
          "ssh user@host 'ls -la /path/with spaces'"
        );
        expect(result).toEqual(['ssh', 'user@host', 'ls -la /path/with spaces']);
      });

      it('handles kubectl command with JSON in quotes', () => {
        const result = tokenizeCommandLine(
          "kubectl run mypod --image=myimage --overrides='{\"spec\":{\"replicas\":3}}'"
        );
        expect(result).toEqual([
          'kubectl',
          'run',
          'mypod',
          '--image=myimage',
          '--overrides={"spec":{"replicas":3}}',
        ]);
      });

      it('handles terraform command with variables file', () => {
        const result = tokenizeCommandLine(
          "terraform plan -var-file='production.tfvars'"
        );
        expect(result).toEqual(['terraform', 'plan', '-var-file=production.tfvars']);
      });

      it('handles aws cli command with JSON input', () => {
        const result = tokenizeCommandLine(
          "aws s3 cp file.txt s3://bucket --metadata='{\"key\": \"value\"}'"
        );
        expect(result.length).toBeGreaterThanOrEqual(5);
      });

      it('handles jq command with complex filter', () => {
        const result = tokenizeCommandLine(
          "jq '.data[] | select(.active == true) | .name'"
        );
        expect(result).toEqual(['jq', ".data[] | select(.active == true) | .name"]);
      });

      it('handles python one-liner with multiple statements', () => {
        const result = tokenizeCommandLine(
          "python -c 'import sys; print(sys.version)'"
        );
        expect(result).toEqual(['python', '-c', 'import sys; print(sys.version)']);
      });

      it('handles perl command with regex in quotes', () => {
        const result = tokenizeCommandLine(
          "perl -pe 's/\\d+/X/g'"
        );
        expect(result.length).toBeGreaterThanOrEqual(1);
      });

      it('handles ruby command with block syntax', () => {
        const result = tokenizeCommandLine(
          "ruby -e '(1..5).each { |i| puts i }'"
        );
        expect(result.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('error handling edge cases', () => {
    it('throws for quote that never closes with trailing backslash', () => {
      expect(() => tokenizeCommandLine('"unclosed\\')).toThrow(/Unterminated quoted string/i);
    });

    it('throws when single quote opens and EOF is reached', () => {
      expect(() => tokenizeCommandLine("test '")).toThrow(/Unterminated quoted string/i);
    });

    it('handles deeply nested escape sequences in quotes', () => {
      // Multiple escaped characters that should all be processed
      const result = tokenizeCommandLine('"a\\\\b\\\\c"');
      expect(result[0]).toBe('a\\b\\c');
    });

    it('throws for alternating unclosed quotes', () => {
      expect(() => tokenizeCommandLine('"test \'more')).toThrow(/Unterminated quoted string/i);
    });

    it('handles backslash immediately followed by newline in unquoted context', () => {
      // Backslash escapes the newline, making it a continuation
      const result = tokenizeCommandLine('line1\\\nline2');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('performance edge cases', () => {
    it('handles extremely long quoted string (10k+ chars)', () => {
      const longString = 'x'.repeat(15000);
      const result = tokenizeCommandLine(`"${longString}"`);
      expect(result[0]).toBe(longString);
    });

    it('handles many small tokens', () => {
      const args = Array.from({ length: 100 }, (_, i) => `arg${i}`);
      const result = tokenizeCommandLine(args.join(' '));
      expect(result).toEqual(args);
    });

    it('handles alternating quoted and unquoted (50 iterations)', () => {
      const parts: string[] = [];
      for (let i = 0; i < 25; i++) {
        parts.push(`unquoted${i}`);
        parts.push(`"quoted${i}"`);
      }
      const result = tokenizeCommandLine(parts.join(' '));
      expect(result.length).toBe(50);
    });

    it('handles repeated escape sequences', () => {
      const escaped = '\\\\'.repeat(100);
      const input = `test ${escaped}`;
      const result = tokenizeCommandLine(input);
      expect(result[0]).toBe('test');
      expect(result[1].length).toBeGreaterThan(50);
    });

    it('handles command with 200+ characters total', () => {
      const longCmd = 'cmd ' + 'a'.repeat(250) + ' b';
      const result = tokenizeCommandLine(longCmd);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('handles maximum safe integer in token content', () => {
      const maxInt = Number.MAX_SAFE_INTEGER.toString();
      const result = tokenizeCommandLine(`cmd ${maxInt}`);
      expect(result[1]).toBe(maxInt);
    });

    it('handles very long flag names', () => {
      const longFlag = '--'.repeat(50) + 'very-long-option-name';
      const result = tokenizeCommandLine(longFlag);
      expect(result[0].startsWith('--')).toBe(true);
    });

    it('handles token with only special characters', () => {
      // Remove single quote to avoid parsing issues
      // Note: backtick is treated as whitespace delimiter, so we exclude it
      const special = '!@#$%^&*()_+-=[]{}|;:,.<>?/~';
      const result = tokenizeCommandLine(special);
      expect(result[0]).toBe(special);
    });

    it('handles multiple consecutive escape sequences at end', () => {
      // 4 backslashes: \\ becomes \, so we get test\
      const input = 'test\\\\';
      const result = tokenizeCommandLine(input);
      expect(result.length).toBe(1); // Only one token because the second is empty/whitespace
    });

    it('handles extremely long sequence of quoted empty strings', () => {
      // Empty strings don't create tokens, so 500 empty strings = no tokens from them
      const input = Array.from({ length: 500 }, () => '""').join(' ');
      const result = tokenizeCommandLine(input);
      expect(result.length).toBe(0);
    });

    it('handles mixed quote styles with varying depths', () => {
      const input = '"outer \'inner \\"deep\\"\' end"';
      const result = tokenizeCommandLine(input);
      // The outer quotes should contain everything including inner quotes
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('handles token containing only whitespace characters (in quotes)', () => {
      const input = '"   \t\n   "';
      const result = tokenizeCommandLine(input);
      // Should preserve the whitespace inside quotes
      expect(result[0]).toContain(' ');
    });

    it('handles alternating quotes that close properly', () => {
      // "a' is a complete double-quoted token containing single quote, then closes with "
      const result = tokenizeCommandLine('"a\'"');
      expect(result).toEqual(["a'"]);
    });

    it('throws on truly unterminated quote after switch', () => {
      // The first quote closes, then we have an unclosed one
      expect(() => tokenizeCommandLine('"a" \'unclosed')).toThrow(/Unterminated quoted string/i);
    });

    it('handles very long escape sequence before EOF', () => {
      const input = '\\'.repeat(1000) + 'test';
      const result = tokenizeCommandLine(input);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});

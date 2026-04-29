import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Integration: CLI Command Execution', () => {
  const agentPath = path.join(process.cwd(), 'bin', 'claude-code-lite.js');

  it('should execute the --help command and return output', async () => {
    // Use node to run the script with help flag - exits immediately without readline issues
    const stdout = execSync(`node ${agentPath} --help`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Verify the output contains expected CLI information
    expect(stdout).toContain('Commands:');
    expect(stdout.toLowerCase()).toContain('claude code-lite');
  });

  it('should execute the --version command and return output', async () => {
    const stdout = execSync(`node ${agentPath} --version`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    expect(stdout).toContain('claude-code-lite');
  });
});

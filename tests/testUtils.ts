import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';

/**
 * Test utilities for the Agent framework.
 */

// Create a temporary directory for storage tests
export function createTempDir(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'agent-test-'));
  return tempDir;
}

// Clean up a temporary directory
export function cleanupTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors in tests
  }
}

// Create a mock file with content in temp dir
export function createMockFile(dir: string, filename: string, content: string): string {
  const filepath = join(dir, filename);
  writeFileSync(filepath, content);
  return filepath;
}

// Read and parse JSON from a test file
export function readJsonFile<T>(filepath: string): T {
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Mock LLM response for testing runtime/llm.ts interactions.
 */
export interface MockLLMResponse {
  content: string | Array<{ type: string; text?: string }>;
  toolCalls?: Array<{ id: string; name: string; arguments: object }>;
  error?: Error;
}

/**
 * Creates a mock LLM client for testing.
 */
export function createMockLLM(response: MockLLMResponse) {
  return {
    generate: async () => response,
    streamGenerate: async function* () {
      yield response.content;
    },
  };
}

/**
 * Creates a mock tool registry for testing.
 */
export interface MockToolConfig {
  name: string;
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export function createMockTool(config: MockToolConfig) {
  return {
    name: config.name,
    description: `Mock tool for ${config.name}`,
    parameters: {},
    execute: config.execute,
  };
}

/**
 * Creates a mock session state for testing runtime/state.ts.
 */
export function createMockSessionState() {
  return {
    sessionId: 'test-session-123',
    messages: [] as Array<{ role: string; content: string }>,
    tools: new Map<string, unknown>(),
    usage: { inputTokens: 0, outputTokens: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Creates a mock permission context for testing.
 */
export function createMockPermissionContext(
  user: string = 'test-user',
  cwd: string = '/tmp'
) {
  return {
    user,
    cwd,
    timestamp: Date.now(),
  };
}

/**
 * Helper to format test output for assertions.
 */
export function formatOutput(lines: string[]): string {
  return lines.join('\n');
}

/**
 * Creates a delay for async tests.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

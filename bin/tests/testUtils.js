import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
/**
 * Test utilities for the Agent framework.
 */
// Create a temporary directory for storage tests
export function createTempDir() {
    const tempDir = mkdtempSync(join(tmpdir(), 'agent-test-'));
    return tempDir;
}
// Clean up a temporary directory
export function cleanupTempDir(dir) {
    try {
        rmSync(dir, { recursive: true, force: true });
    }
    catch (e) {
        // Ignore cleanup errors in tests
    }
}
// Create a mock file with content in temp dir
export function createMockFile(dir, filename, content) {
    const filepath = join(dir, filename);
    writeFileSync(filepath, content);
    return filepath;
}
// Read and parse JSON from a test file
export function readJsonFile(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
}
/**
 * Creates a mock LLM client for testing.
 */
export function createMockLLM(response) {
    return {
        generate: async () => response,
        streamGenerate: async function* () {
            yield response.content;
        },
    };
}
export function createMockTool(config) {
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
        messages: [],
        tools: new Map(),
        usage: { inputTokens: 0, outputTokens: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}
/**
 * Creates a mock permission context for testing.
 */
export function createMockPermissionContext(user = 'test-user', cwd = '/tmp') {
    return {
        user,
        cwd,
        timestamp: Date.now(),
    };
}
/**
 * Helper to format test output for assertions.
 */
export function formatOutput(lines) {
    return lines.join('\n');
}
/**
 * Creates a delay for async tests.
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

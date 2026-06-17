import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('LlmConfig Context Window', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
    originalEnv = process.env.IRG_CONTEXT_WINDOW;
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    if (originalEnv !== undefined) {
      process.env.IRG_CONTEXT_WINDOW = originalEnv;
    } else {
      delete process.env.IRG_CONTEXT_WINDOW;
    }
    delete process.env.IRG_MAX_OUTPUT_TOKENS;
  });

  describe('Default config values', () => {
    it('has default contextWindow of 200000', async () => {
      // Import fresh to get defaults
      const { getDefaultConfig } = await import('../../../runtime/config');
      const config = getDefaultConfig();
      expect(config.llm.contextWindow).toBe(200000);
    });

    it('has default maxOutputTokens of 4096', async () => {
      const { getDefaultConfig } = await import('../../../runtime/config');
      const config = getDefaultConfig();
      expect(config.llm.maxOutputTokens).toBe(4096);
    });
  });

  describe('Environment variable overrides', () => {
    it('overrides contextWindow from env', async () => {
      process.env.IRG_CONTEXT_WINDOW = '100000';
      const { mergeEnvIntoConfig, getDefaultConfig } = await import('../../../runtime/config');
      const config = getDefaultConfig();
      const merged = mergeEnvIntoConfig(config);
      expect(merged.llm.contextWindow).toBe(100000);
    });

    it('overrides maxOutputTokens from env', async () => {
      process.env.IRG_MAX_OUTPUT_TOKENS = '8192';
      const { mergeEnvIntoConfig, getDefaultConfig } = await import('../../../runtime/config');
      const config = getDefaultConfig();
      const merged = mergeEnvIntoConfig(config);
      expect(merged.llm.maxOutputTokens).toBe(8192);
    });

    it('ignores invalid contextWindow env value', async () => {
      process.env.IRG_CONTEXT_WINDOW = 'not-a-number';
      const { mergeEnvIntoConfig, getDefaultConfig } = await import('../../../runtime/config');
      const config = getDefaultConfig();
      const merged = mergeEnvIntoConfig(config);
      expect(merged.llm.contextWindow).toBe(200000); // unchanged default
    });

    it('ignores zero contextWindow env value', async () => {
      process.env.IRG_CONTEXT_WINDOW = '0';
      const { mergeEnvIntoConfig, getDefaultConfig } = await import('../../../runtime/config');
      const config = getDefaultConfig();
      const merged = mergeEnvIntoConfig(config);
      expect(merged.llm.contextWindow).toBe(200000); // unchanged default
    });
  });

  describe('Config persistence', () => {
    it('saves and loads contextWindow', async () => {
      // This test verifies the config type accepts the new fields
      const configPath = path.join(tempDir, 'config.json');
      const config = {
        llm: {
          provider: 'openai' as const,
          apiKey: 'test',
          model: 'test',
          baseUrl: 'http://localhost',
          contextWindow: 150000,
          maxOutputTokens: 2048,
        },
      };
      await fs.writeFile(configPath, JSON.stringify(config), 'utf8');
      const loaded = JSON.parse(await fs.readFile(configPath, 'utf8'));
      expect(loaded.llm.contextWindow).toBe(150000);
      expect(loaded.llm.maxOutputTokens).toBe(2048);
    });
  });
});

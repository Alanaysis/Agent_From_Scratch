import { ipcMain } from "electron";
import { loadConfig, saveConfig, getDefaultConfig, mergeEnvIntoConfig } from "../../../runtime/config";
import { initLlmConfig, setLlmConfig } from "../../../runtime/llm";
import type { LlmConfig } from "../../../runtime/llm";
import { log } from "../logger";

interface ConfigGetResult {
  llm: LlmConfig;
  source: "file" | "default" | "env";
}

interface ConfigSetInput {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  systemPrompt?: string;
  anthropicVersion?: string;
}

export async function registerConfigHandlers() {
  log('INFO', 'Config', 'Initializing config handlers')
  await initLlmConfig();

  ipcMain.handle("config:get", async (): Promise<ConfigGetResult> => {
    log('INFO', 'Config', 'config:get called')
    try {
      const appConfig = await loadConfig();
      log('INFO', 'Config', 'config:get loaded', { apiKey: appConfig.llm.apiKey ? '[SET]' : '[EMPTY]', model: appConfig.llm.model, baseUrl: appConfig.llm.baseUrl })
      const merged = mergeEnvIntoConfig(appConfig);
      
      const hasEnv = 
        process.env.IRG_LLM_API_KEY ||
        process.env.IRG_LLM_MODEL ||
        process.env.IRG_LLM_PROVIDER;
      
      const defaultConfig = getDefaultConfig().llm;
      const hasFileSettings = merged.llm.model !== defaultConfig.model || 
                              merged.llm.baseUrl !== defaultConfig.baseUrl ||
                              merged.llm.provider !== defaultConfig.provider;
      
      const result = hasEnv
        ? { llm: merged.llm, source: "env" as const }
        : hasFileSettings
          ? { llm: merged.llm, source: "file" as const }
          : { llm: merged.llm, source: "default" as const };
      
      log('INFO', 'Config', 'config:get returned', { source: result.source, model: result.llm.model, baseUrl: result.llm.baseUrl })
      return result;
    } catch (e) {
      log('ERROR', 'Config', 'config:get failed', e)
      throw e
    }
  });

  ipcMain.handle("config:set", async (_event, input: ConfigSetInput): Promise<ConfigGetResult> => {
    log('INFO', 'Config', 'config:set called', input)
    try {
      const updates: Partial<LlmConfig> = {};
      if (input.provider) updates.provider = input.provider as LlmConfig["provider"];
      if (input.apiKey !== undefined) updates.apiKey = input.apiKey;
      if (input.model) updates.model = input.model;
      if (input.baseUrl) updates.baseUrl = input.baseUrl;
      if (input.systemPrompt !== undefined) updates.systemPrompt = input.systemPrompt;
      if (input.anthropicVersion) updates.anthropicVersion = input.anthropicVersion;

      log('INFO', 'Config', 'config:set calling setLlmConfig with updates:', updates)
      const newConfig = await setLlmConfig(updates);
      log('INFO', 'Config', 'config:set succeeded, new config:', { model: newConfig.model, baseUrl: newConfig.baseUrl, apiKey: newConfig.apiKey ? '[SET]' : '[EMPTY]' })
      
      // Verify the save by loading it back
      const verifyConfig = await loadConfig()
      log('INFO', 'Config', 'config:set verified:', { model: verifyConfig.llm.model, baseUrl: verifyConfig.llm.baseUrl })
      
      return { llm: newConfig, source: "file" };
    } catch (e) {
      log('ERROR', 'Config', 'config:set failed', e)
      throw e
    }
  });

  ipcMain.handle("config:save", async (_event, input: ConfigSetInput): Promise<void> => {
    log('INFO', 'Config', 'config:save called', input)
    try {
      const appConfig = await loadConfig();
      if (input.provider) appConfig.llm.provider = input.provider as LlmConfig["provider"];
      if (input.apiKey !== undefined) appConfig.llm.apiKey = input.apiKey;
      if (input.model) appConfig.llm.model = input.model;
      if (input.baseUrl) appConfig.llm.baseUrl = input.baseUrl;
      if (input.systemPrompt !== undefined) appConfig.llm.systemPrompt = input.systemPrompt;
      if (input.anthropicVersion) appConfig.llm.anthropicVersion = input.anthropicVersion;
      await saveConfig(appConfig);
      log('INFO', 'Config', 'config:save succeeded')
    } catch (e) {
      log('ERROR', 'Config', 'config:save failed', e)
      throw e
    }
  });
}
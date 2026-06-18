import { homedir } from "os";
import { join } from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
const DEFAULT_LLM_CONFIG = {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    anthropicVersion: "2023-06-01",
    contextWindow: 200000,
    maxOutputTokens: 4096,
};
function getConfigPath() {
    return join(homedir(), ".irg", "config.json");
}
export function getDefaultConfig() {
    return {
        llm: { ...DEFAULT_LLM_CONFIG },
    };
}
export async function loadConfig() {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
        return getDefaultConfig();
    }
    try {
        const content = await readFile(configPath, "utf-8");
        const parsed = JSON.parse(content);
        return {
            llm: {
                ...DEFAULT_LLM_CONFIG,
                ...parsed.llm,
            },
        };
    }
    catch {
        return getDefaultConfig();
    }
}
export async function saveConfig(config) {
    const configPath = getConfigPath();
    const dir = homedir();
    await mkdir(join(dir, ".irg"), { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}
export function mergeEnvIntoConfig(config) {
    const apiKey = process.env.IRG_LLM_API_KEY?.trim();
    const model = process.env.IRG_LLM_MODEL?.trim();
    const provider = process.env.IRG_LLM_PROVIDER?.trim().toLowerCase();
    const baseUrl = process.env.IRG_LLM_BASE_URL?.trim();
    const systemPrompt = process.env.IRG_LLM_SYSTEM_PROMPT?.trim();
    const anthropicVersion = process.env.IRG_ANTHROPIC_VERSION?.trim();
    const contextWindow = process.env.IRG_CONTEXT_WINDOW?.trim();
    const maxOutputTokens = process.env.IRG_MAX_OUTPUT_TOKENS?.trim();
    if (!apiKey && !model && !provider && !baseUrl && !systemPrompt && !anthropicVersion && !contextWindow && !maxOutputTokens) {
        return config;
    }
    const merged = { ...config };
    if (apiKey)
        merged.llm.apiKey = apiKey;
    if (model)
        merged.llm.model = model;
    if (provider === "anthropic" || provider === "openai") {
        merged.llm.provider = provider;
    }
    if (baseUrl)
        merged.llm.baseUrl = baseUrl.replace(/\/$/, "");
    if (systemPrompt)
        merged.llm.systemPrompt = systemPrompt;
    if (anthropicVersion)
        merged.llm.anthropicVersion = anthropicVersion;
    if (contextWindow) {
        const parsed = parseInt(contextWindow, 10);
        if (!isNaN(parsed) && parsed > 0)
            merged.llm.contextWindow = parsed;
    }
    if (maxOutputTokens) {
        const parsed = parseInt(maxOutputTokens, 10);
        if (!isNaN(parsed) && parsed > 0)
            merged.llm.maxOutputTokens = parsed;
    }
    return merged;
}

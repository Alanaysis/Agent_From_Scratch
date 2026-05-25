import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { loadKnowledgeStore, knowledgeToSystemPrompt } from "./knowledge";
const MEMORY_CHAR_LIMIT = 3575;
function getMemoryPath(cwd) {
    return join(cwd, ".claude-code-lite", "Memory.md");
}
export async function loadMemory(cwd) {
    try {
        return await readFile(getMemoryPath(cwd), "utf8");
    }
    catch {
        return "";
    }
}
export async function saveMemory(cwd, content) {
    await mkdir(join(cwd, ".claude-code-lite"), { recursive: true });
    const truncated = content.length > MEMORY_CHAR_LIMIT
        ? content.slice(0, MEMORY_CHAR_LIMIT)
        : content;
    await writeFile(getMemoryPath(cwd), truncated, "utf8");
}
export async function rebuildMemoryFromKnowledge(cwd) {
    const store = await loadKnowledgeStore(cwd);
    const sorted = [...store.entries].sort((a, b) => {
        if (a.category === "anti_pattern" && b.category !== "anti_pattern")
            return -1;
        if (b.category === "anti_pattern" && a.category !== "anti_pattern")
            return 1;
        return b.confidence - a.confidence;
    });
    const prompt = knowledgeToSystemPrompt(sorted);
    await saveMemory(cwd, prompt);
    return prompt;
}
export async function getMemoryForSystemPrompt(cwd) {
    const memory = await loadMemory(cwd);
    if (memory.trim())
        return memory;
    const rebuilt = await rebuildMemoryFromKnowledge(cwd);
    return rebuilt;
}

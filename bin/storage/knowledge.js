import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { createId } from "../shared/ids";
const MAX_ENTRIES = 100;
const CHAR_LIMIT = 500;
function getKnowledgePath(cwd) {
    return join(cwd, ".claude-code-lite", "knowledge.json");
}
function emptyStore() {
    return { entries: [], version: 1 };
}
export async function loadKnowledgeStore(cwd) {
    try {
        const content = await readFile(getKnowledgePath(cwd), "utf8");
        return JSON.parse(content);
    }
    catch {
        return emptyStore();
    }
}
export async function saveKnowledgeStore(cwd, store) {
    await mkdir(join(cwd, ".claude-code-lite"), { recursive: true });
    await writeFile(getKnowledgePath(cwd), JSON.stringify(store, null, 2), "utf8");
}
export async function addKnowledge(cwd, category, content, source, tags = [], confidence = 0.7) {
    if (!content.trim())
        return null;
    const truncated = content.length > CHAR_LIMIT
        ? content.slice(0, CHAR_LIMIT - 3) + "..."
        : content;
    const store = await loadKnowledgeStore(cwd);
    const duplicate = store.entries.find((e) => e.content === truncated && e.category === category);
    if (duplicate) {
        duplicate.confidence = Math.min(1, duplicate.confidence + 0.1);
        duplicate.usageCount += 1;
        duplicate.lastUsed = new Date().toISOString();
        await saveKnowledgeStore(cwd, store);
        return duplicate;
    }
    if (store.entries.length >= MAX_ENTRIES) {
        store.entries.sort((a, b) => {
            const scoreA = a.confidence * 0.6 + (a.usageCount / 10) * 0.4;
            const scoreB = b.confidence * 0.6 + (b.usageCount / 10) * 0.4;
            return scoreA - scoreB;
        });
        store.entries = store.entries.slice(1);
    }
    const now = new Date().toISOString();
    const entry = {
        id: createId("knowledge"),
        category,
        content: truncated,
        source,
        confidence,
        usageCount: 0,
        lastUsed: now,
        createdAt: now,
        tags,
    };
    store.entries.push(entry);
    store.version += 1;
    await saveKnowledgeStore(cwd, store);
    return entry;
}
export async function queryKnowledge(cwd, query, limit = 5) {
    const store = await loadKnowledgeStore(cwd);
    const lowerQuery = query.toLowerCase();
    const queryTags = lowerQuery.split(/\s+/).filter(Boolean);
    const scored = store.entries.map((entry) => {
        let score = 0;
        const contentLower = entry.content.toLowerCase();
        for (const tag of queryTags) {
            if (contentLower.includes(tag))
                score += 2;
        }
        for (const tag of entry.tags) {
            if (queryTags.some((qt) => tag.toLowerCase().includes(qt)))
                score += 1;
        }
        if (score > 0) {
            if (entry.category === "anti_pattern")
                score += 0.5;
            if (entry.category === "preference")
                score += 0.3;
        }
        score *= entry.confidence;
        return { entry, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit).filter((s) => s.score > 0);
    if (results.length > 0) {
        const store2 = await loadKnowledgeStore(cwd);
        for (const r of results) {
            const found = store2.entries.find((e) => e.id === r.entry.id);
            if (found) {
                found.usageCount += 1;
                found.lastUsed = new Date().toISOString();
            }
        }
        await saveKnowledgeStore(cwd, store2);
    }
    return results.map((r) => r.entry);
}
export async function removeKnowledge(cwd, entryId) {
    const store = await loadKnowledgeStore(cwd);
    const before = store.entries.length;
    store.entries = store.entries.filter((e) => e.id !== entryId);
    if (store.entries.length < before) {
        store.version += 1;
        await saveKnowledgeStore(cwd, store);
        return true;
    }
    return false;
}
export async function decayKnowledge(cwd) {
    const store = await loadKnowledgeStore(cwd);
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    let decayed = 0;
    store.entries = store.entries.filter((entry) => {
        const age = now - new Date(entry.createdAt).getTime();
        if (entry.confidence < 0.2 && age > THIRTY_DAYS) {
            decayed += 1;
            return false;
        }
        return true;
    });
    for (const entry of store.entries) {
        const lastUsedAge = now - new Date(entry.lastUsed).getTime();
        if (lastUsedAge > THIRTY_DAYS) {
            entry.confidence = Math.max(0.1, entry.confidence - 0.05);
        }
    }
    if (decayed > 0) {
        store.version += 1;
        await saveKnowledgeStore(cwd, store);
    }
    return decayed;
}
export function knowledgeToSystemPrompt(entries) {
    if (entries.length === 0)
        return "";
    const lines = ["=== PERSISTENT KNOWLEDGE ==="];
    const grouped = {
        fact: [],
        preference: [],
        pattern: [],
        anti_pattern: [],
    };
    for (const entry of entries) {
        grouped[entry.category].push(entry);
    }
    if (grouped.anti_pattern.length > 0) {
        lines.push("\n--- Anti-Patterns (AVOID these) ---");
        for (const entry of grouped.anti_pattern) {
            lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
        }
    }
    if (grouped.preference.length > 0) {
        lines.push("\n--- User Preferences ---");
        for (const entry of grouped.preference) {
            lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
        }
    }
    if (grouped.fact.length > 0) {
        lines.push("\n--- Project Facts ---");
        for (const entry of grouped.fact) {
            lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
        }
    }
    if (grouped.pattern.length > 0) {
        lines.push("\n--- Success Patterns ---");
        for (const entry of grouped.pattern) {
            lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
        }
    }
    return lines.join("\n");
}

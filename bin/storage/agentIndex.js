import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { BUILTIN_AGENTS } from "../tools/agent/agentRegistry";
function getAgentsDir(cwd) {
    return join(cwd, ".irg", "agents");
}
function getAgentInfoPath(cwd, agentId) {
    return join(getAgentsDir(cwd), `${agentId}.json`);
}
export async function readAgentInfo(cwd, agentId) {
    try {
        const content = await readFile(getAgentInfoPath(cwd, agentId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function createAgent(cwd, agent) {
    const now = new Date().toISOString();
    const newAgent = {
        ...agent,
        createdAt: now,
        updatedAt: now,
    };
    await mkdir(getAgentsDir(cwd), { recursive: true });
    await writeFile(getAgentInfoPath(cwd, agent.id), `${JSON.stringify(newAgent, null, 2)}\n`, "utf8");
    return newAgent;
}
export async function updateAgentInfo(cwd, agentId, updates) {
    const previous = await readAgentInfo(cwd, agentId);
    if (!previous) {
        return null;
    }
    if (previous.isBuiltIn) {
        return null;
    }
    const now = new Date().toISOString();
    const updated = {
        ...previous,
        ...updates,
        updatedAt: now,
    };
    await mkdir(getAgentsDir(cwd), { recursive: true });
    await writeFile(getAgentInfoPath(cwd, agentId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    return updated;
}
export async function deleteAgentInfo(cwd, agentId) {
    const previous = await readAgentInfo(cwd, agentId);
    if (!previous || previous.isBuiltIn) {
        return false;
    }
    await rm(getAgentInfoPath(cwd, agentId), { force: true });
    return true;
}
export async function listAgents(cwd) {
    const infos = new Map();
    for (const [key, agentDef] of Object.entries(BUILTIN_AGENTS)) {
        infos.set(key, {
            ...agentDef,
            id: key,
            isBuiltIn: true,
            createdAt: "",
            updatedAt: "",
        });
    }
    try {
        const entries = await readdir(getAgentsDir(cwd));
        for (const entry of entries) {
            if (!entry.endsWith(".json")) {
                continue;
            }
            const agentId = entry.replace(/\.json$/, "");
            const info = await readAgentInfo(cwd, agentId);
            if (info) {
                infos.set(agentId, info);
            }
        }
    }
    catch {
        // ignore missing agents dir
    }
    return [...infos.values()];
}
export async function listAgentsByCapability(cwd, capability) {
    const allAgents = await listAgents(cwd);
    const lowerCap = capability.toLowerCase();
    return allAgents.filter((agent) => agent.capabilities?.some((cap) => cap.toLowerCase() === lowerCap));
}
export async function getAgentDefinition(cwd, agentId) {
    const stored = await readAgentInfo(cwd, agentId);
    if (stored) {
        return {
            name: stored.name,
            description: stored.description,
            systemPrompt: stored.systemPrompt,
            allowedTools: stored.allowedTools,
            maxTurns: stored.maxTurns,
            isReadOnly: stored.isReadOnly,
        };
    }
    if (BUILTIN_AGENTS[agentId]) {
        return BUILTIN_AGENTS[agentId];
    }
    return null;
}

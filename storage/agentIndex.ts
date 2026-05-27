import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { BUILTIN_AGENTS, type AgentDefinition, type PermissionConfig } from "../tools/agent/agentRegistry";

export type StoredAgent = AgentDefinition & {
  id: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
  permission?: PermissionConfig;
};

function getAgentsDir(cwd: string): string {
  return join(cwd, ".irg", "agents");
}

function getAgentInfoPath(cwd: string, agentId: string): string {
  return join(getAgentsDir(cwd), `${agentId}.json`);
}

export async function readAgentInfo(
  cwd: string,
  agentId: string,
): Promise<StoredAgent | null> {
  try {
    const content = await readFile(getAgentInfoPath(cwd, agentId), "utf8");
    return JSON.parse(content) as StoredAgent;
  } catch {
    return null;
  }
}

export async function createAgent(
  cwd: string,
  agent: Omit<StoredAgent, "createdAt" | "updatedAt">,
): Promise<StoredAgent> {
  const now = new Date().toISOString();
  const newAgent: StoredAgent = {
    ...agent,
    createdAt: now,
    updatedAt: now,
  };

  await mkdir(getAgentsDir(cwd), { recursive: true });
  await writeFile(
    getAgentInfoPath(cwd, agent.id),
    `${JSON.stringify(newAgent, null, 2)}\n`,
    "utf8",
  );
  return newAgent;
}

export async function updateAgentInfo(
  cwd: string,
  agentId: string,
  updates: Partial<Omit<StoredAgent, "id" | "createdAt" | "isBuiltIn">>,
): Promise<StoredAgent | null> {
  const previous = await readAgentInfo(cwd, agentId);
  if (!previous) {
    return null;
  }

  if (previous.isBuiltIn) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: StoredAgent = {
    ...previous,
    ...updates,
    updatedAt: now,
  };

  await mkdir(getAgentsDir(cwd), { recursive: true });
  await writeFile(
    getAgentInfoPath(cwd, agentId),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return updated;
}

export async function deleteAgentInfo(
  cwd: string,
  agentId: string,
): Promise<boolean> {
  const previous = await readAgentInfo(cwd, agentId);
  if (!previous || previous.isBuiltIn) {
    return false;
  }
  await rm(getAgentInfoPath(cwd, agentId), { force: true });
  return true;
}

export async function listAgents(cwd: string): Promise<StoredAgent[]> {
  const infos = new Map<string, StoredAgent>();

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
  } catch {
    // ignore missing agents dir
  }

  return [...infos.values()];
}

export async function getAgentDefinition(
  cwd: string,
  agentId: string,
): Promise<AgentDefinition | null> {
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
import type { LlmToolDefinition } from "../../runtime/llm";

export type AgentDefinition = {
  name: string;
  description: string;
  systemPrompt: string[];
  allowedTools: string[] | "*";
  maxTurns?: number;
  isReadOnly?: boolean;
};

export const BUILTIN_AGENTS: Record<string, AgentDefinition> = {
  "general-purpose": {
    name: "general-purpose",
    description:
      "A general-purpose agent for complex multi-step tasks that require both exploration and modification.",
    systemPrompt: [
      "You are a sub-agent working on a delegated task.",
      "Complete the task autonomously using the tools available to you.",
      "Be thorough but concise in your findings.",
      "When you are done, provide a clear summary of what you found or did.",
    ],
    allowedTools: "*",
    maxTurns: 8,
  },
  explore: {
    name: "explore",
    description:
      "A fast, read-only agent optimized for searching and analyzing codebases. Use for file discovery, code search, and codebase exploration.",
    systemPrompt: [
      "You are an exploration agent. Your job is to search and analyze the codebase.",
      "You are READ-ONLY — you cannot modify any files.",
      "Be thorough: check multiple locations, follow imports, trace references.",
      "When you are done, provide a structured summary of your findings.",
    ],
    allowedTools: ["Read", "FileTree", "SearchFiles", "WebFetch", "WebSearch"],
    isReadOnly: true,
    maxTurns: 10,
  },
  plan: {
    name: "plan",
    description:
      "A research agent for gathering context during planning. Use when you need to understand the codebase before creating a plan.",
    systemPrompt: [
      "You are a planning research agent. Your job is to gather context about the codebase to support planning.",
      "You are READ-ONLY — you cannot modify any files.",
      "Focus on understanding the current state, dependencies, and potential impact areas.",
      "Provide a structured research summary that can be used for planning.",
    ],
    allowedTools: ["Read", "FileTree", "SearchFiles"],
    isReadOnly: true,
    maxTurns: 6,
  },
  reflect: {
    name: "reflect",
    description:
      "A reflection agent that analyzes past interactions and extracts actionable insights for self-improvement.",
    systemPrompt: [
      "You are a reflection agent. Your job is to analyze past interactions and extract actionable insights.",
      "For each interaction, identify:",
      "1. What went well (success patterns to reinforce)",
      "2. What went wrong (anti-patterns to avoid)",
      "3. What could be improved (optimization opportunities)",
      "4. Whether a new skill should be created or an existing one updated",
      "You are READ-ONLY — you cannot modify any files.",
      "IMPORTANT: You cannot launch other sub-agents or trigger further reflections.",
      "Output your findings in this structured format:",
      "## Success Patterns",
      "- [pattern description]",
      "## Anti-Patterns",
      "- [anti-pattern description]",
      "## Optimization Opportunities",
      "- [improvement suggestion]",
      "## Skill Suggestions",
      "- [skill name]: [description of what this skill should do]",
    ],
    allowedTools: ["Read", "FileTree", "SearchFiles"],
    isReadOnly: true,
    maxTurns: 4,
  },
};

export function getAgentDefinition(
  subagentType?: string,
): AgentDefinition {
  const key = (subagentType?.trim() || "general-purpose").toLowerCase();
  return BUILTIN_AGENTS[key] ?? BUILTIN_AGENTS["general-purpose"]!;
}

export function getToolDefinitionsForAgent(
  agentDef: AgentDefinition,
  allToolDefs: LlmToolDefinition[],
): LlmToolDefinition[] {
  const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
  if (agentDef.allowedTools === "*") {
    return allToolDefs.filter((t) => !blockedTools.includes(t.name));
  }
  return allToolDefs.filter(
    (t) => agentDef.allowedTools.includes(t.name) && !blockedTools.includes(t.name),
  );
}

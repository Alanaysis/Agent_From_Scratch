import type { Message } from "./messages";
import type { ToolUseContext } from "../tools/Tool";
import type { SessionInfo } from "../storage/sessionIndex";
import {
  runReflection,
  shouldReflect,
  type ReflectionTrigger,
  type ReflectionResult,
  type ReflectionConfig,
  DEFAULT_REFLECTION_CONFIG,
} from "./reflection";
import { decayKnowledge } from "../storage/knowledge";
import { rebuildMemoryFromKnowledge } from "../storage/memory";
import { listUserSkills, recordSkillUsage } from "../skills/skillManager";

export type EvolutionConfig = {
  enabled: boolean;
  reflectionOnComplete: boolean;
  reflectionOnError: boolean;
  reflectionCronSchedule?: string;
  maxKnowledgeEntries: number;
  knowledgeCharLimit: number;
  skillAutoCreate: boolean;
  skillAutoRefine: boolean;
  skillRefineThreshold: number;
  decayIntervalDays: number;
};

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  enabled: true,
  reflectionOnComplete: false,
  reflectionOnError: true,
  maxKnowledgeEntries: 100,
  knowledgeCharLimit: 500,
  skillAutoCreate: true,
  skillAutoRefine: true,
  skillRefineThreshold: 10,
  decayIntervalDays: 30,
};

export type EvolutionState = {
  totalReflections: number;
  skillsCreated: number;
  skillsRefined: number;
  knowledgeEntries: number;
  lastReflectionAt?: string;
  lastDecayAt?: string;
};

function toReflectionConfig(config: EvolutionConfig): ReflectionConfig {
  return {
    enabled: config.enabled,
    reflectionOnComplete: config.reflectionOnComplete,
    reflectionOnError: config.reflectionOnError,
    errorThreshold: 2,
    toolUseThreshold: 15,
    skillAutoCreate: config.skillAutoCreate,
    skillAutoRefine: config.skillAutoRefine,
    skillRefineThreshold: config.skillRefineThreshold,
  };
}

export async function evolveAfterSession(
  cwd: string,
  sessionInfo: SessionInfo,
  messages: Message[],
  parentContext: ToolUseContext,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): Promise<ReflectionResult | null> {
  if (!config.enabled) return null;

  const errorCount = sessionInfo.errorCount ?? 0;
  const toolUseCount = sessionInfo.toolUseCount ?? 0;

  let trigger: ReflectionTrigger;
  if (errorCount > 0) {
    trigger = {
      type: "task_failed",
      errorCount,
      lastError: sessionInfo.lastError ?? "Unknown error",
    };
  } else {
    trigger = {
      type: "task_completed",
      errorCount,
      toolUseCount,
    };
  }

  if (!shouldReflect(trigger, toReflectionConfig(config))) {
    return null;
  }

  const result = await runReflection(
    cwd,
    messages,
    trigger,
    parentContext,
    toReflectionConfig(config),
  );

  return result;
}

export async function evolveOnCron(
  cwd: string,
  parentContext: ToolUseContext,
  schedule: string,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): Promise<ReflectionResult | null> {
  if (!config.enabled) return null;

  const trigger: ReflectionTrigger = {
    type: "cron_schedule",
    schedule,
  };

  const decayed = await decayKnowledge(cwd);

  await rebuildMemoryFromKnowledge(cwd);

  const result = await runReflection(
    cwd,
    [],
    trigger,
    parentContext,
    toReflectionConfig(config),
  );

  return result;
}

export async function evolveOnUserRequest(
  cwd: string,
  messages: Message[],
  prompt: string,
  parentContext: ToolUseContext,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): Promise<ReflectionResult | null> {
  if (!config.enabled) return null;

  const trigger: ReflectionTrigger = {
    type: "user_request",
    prompt,
  };

  const result = await runReflection(
    cwd,
    messages,
    trigger,
    parentContext,
    toReflectionConfig(config),
  );

  return result;
}

export async function getEvolutionState(
  cwd: string,
): Promise<EvolutionState> {
  const { loadKnowledgeStore } = await import("../storage/knowledge");
  const store = await loadKnowledgeStore(cwd);
  const skills = await listUserSkills(cwd);

  return {
    totalReflections: store.entries.filter(
      (e) => e.source === "agent_reflection",
    ).length,
    skillsCreated: skills.length,
    skillsRefined: skills.filter(
      (s) => (s.frontmatter.version ?? 1) > 1,
    ).length,
    knowledgeEntries: store.entries.length,
    lastReflectionAt: store.entries
      .filter((e) => e.source === "agent_reflection")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0]?.createdAt,
    lastDecayAt: undefined,
  };
}

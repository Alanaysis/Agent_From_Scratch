import { runReflection, shouldReflect, } from "./reflection";
import { decayKnowledge } from "../storage/knowledge";
import { rebuildMemoryFromKnowledge } from "../storage/memory";
import { listUserSkills } from "../skills/skillManager";
export const DEFAULT_EVOLUTION_CONFIG = {
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
function toReflectionConfig(config) {
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
export async function evolveAfterSession(cwd, sessionInfo, messages, parentContext, config = DEFAULT_EVOLUTION_CONFIG) {
    if (!config.enabled)
        return null;
    const errorCount = sessionInfo.errorCount ?? 0;
    const toolUseCount = sessionInfo.toolUseCount ?? 0;
    let trigger;
    if (errorCount > 0) {
        trigger = {
            type: "task_failed",
            errorCount,
            lastError: sessionInfo.lastError ?? "Unknown error",
        };
    }
    else {
        trigger = {
            type: "task_completed",
            errorCount,
            toolUseCount,
        };
    }
    if (!shouldReflect(trigger, toReflectionConfig(config))) {
        return null;
    }
    const result = await runReflection(cwd, messages, trigger, parentContext, toReflectionConfig(config));
    return result;
}
export async function evolveOnCron(cwd, parentContext, schedule, config = DEFAULT_EVOLUTION_CONFIG) {
    if (!config.enabled)
        return null;
    const trigger = {
        type: "cron_schedule",
        schedule,
    };
    const decayed = await decayKnowledge(cwd);
    await rebuildMemoryFromKnowledge(cwd);
    const result = await runReflection(cwd, [], trigger, parentContext, toReflectionConfig(config));
    return result;
}
export async function evolveOnUserRequest(cwd, messages, prompt, parentContext, config = DEFAULT_EVOLUTION_CONFIG) {
    if (!config.enabled)
        return null;
    const trigger = {
        type: "user_request",
        prompt,
    };
    const result = await runReflection(cwd, messages, trigger, parentContext, toReflectionConfig(config));
    return result;
}
export async function getEvolutionState(cwd) {
    const { loadKnowledgeStore } = await import("../storage/knowledge");
    const store = await loadKnowledgeStore(cwd);
    const skills = await listUserSkills(cwd);
    return {
        totalReflections: store.entries.filter((e) => e.source === "agent_reflection").length,
        skillsCreated: skills.length,
        skillsRefined: skills.filter((s) => (s.frontmatter.version ?? 1) > 1).length,
        knowledgeEntries: store.entries.length,
        lastReflectionAt: store.entries
            .filter((e) => e.source === "agent_reflection")
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt,
        lastDecayAt: undefined,
    };
}

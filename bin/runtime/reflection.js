import { runAgent } from "../tools/agent/runAgent";
import { addKnowledge } from "../storage/knowledge";
import { rebuildMemoryFromKnowledge } from "../storage/memory";
import { createSkill, patchSkill, listUserSkills, } from "../skills/skillManager";
export const DEFAULT_REFLECTION_CONFIG = {
    enabled: true,
    reflectionOnComplete: false,
    reflectionOnError: true,
    errorThreshold: 2,
    toolUseThreshold: 15,
    skillAutoCreate: true,
    skillAutoRefine: true,
    skillRefineThreshold: 10,
};
export function shouldReflect(trigger, config = DEFAULT_REFLECTION_CONFIG) {
    if (!config.enabled)
        return false;
    switch (trigger.type) {
        case "task_completed":
            if (!config.reflectionOnComplete)
                return false;
            return (trigger.errorCount > 0 || trigger.toolUseCount > config.toolUseThreshold);
        case "task_failed":
            return config.reflectionOnError && trigger.errorCount >= config.errorThreshold;
        case "repeated_errors":
            return trigger.count >= 3;
        case "cron_schedule":
            return true;
        case "user_request":
            return true;
    }
}
function parseReflectionOutput(output) {
    const result = {
        successPatterns: [],
        antiPatterns: [],
        optimizations: [],
        skillSuggestions: [],
    };
    const sections = output.split(/##\s*/);
    for (const section of sections) {
        const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
        const header = lines[0]?.toLowerCase() || "";
        const items = lines
            .slice(1)
            .filter((l) => l.startsWith("-"))
            .map((l) => l.replace(/^-\s*/, ""));
        if (header.includes("success")) {
            result.successPatterns = items;
        }
        else if (header.includes("anti")) {
            result.antiPatterns = items;
        }
        else if (header.includes("optim")) {
            result.optimizations = items;
        }
        else if (header.includes("skill")) {
            for (const item of items) {
                const colonIndex = item.indexOf(":");
                if (colonIndex > 0) {
                    result.skillSuggestions.push({
                        name: item.slice(0, colonIndex).trim(),
                        description: item.slice(colonIndex + 1).trim(),
                    });
                }
                else {
                    result.skillSuggestions.push({ name: item, description: item });
                }
            }
        }
    }
    return result;
}
export async function runReflection(cwd, messages, trigger, parentContext, config = DEFAULT_REFLECTION_CONFIG) {
    const result = {
        knowledgeExtracted: 0,
        skillsCreated: 0,
        skillsPatched: 0,
        summary: "",
    };
    const transcriptSummary = summarizeTranscript(messages);
    const triggerContext = formatTriggerContext(trigger);
    const reflectionPrompt = [
        "Analyze the following interaction transcript and extract insights for self-improvement.",
        "",
        `Trigger: ${triggerContext}`,
        "",
        "## Transcript Summary",
        transcriptSummary,
        "",
        "Please identify success patterns, anti-patterns, optimization opportunities, and skill suggestions.",
    ].join("\n");
    let reflectionOutput;
    try {
        reflectionOutput = await runAgent({
            description: "Self-reflection analysis",
            prompt: reflectionPrompt,
            subagentType: "reflect",
            parentContext,
            maxTurns: 4,
        });
    }
    catch {
        result.summary = "Reflection agent failed to execute.";
        return result;
    }
    const parsed = parseReflectionOutput(reflectionOutput);
    for (const pattern of parsed.successPatterns) {
        await addKnowledge(cwd, "pattern", pattern, "agent_reflection", [
            "success-pattern",
            "reflection",
        ]);
        result.knowledgeExtracted += 1;
    }
    for (const antiPattern of parsed.antiPatterns) {
        await addKnowledge(cwd, "anti_pattern", antiPattern, "agent_reflection", [
            "anti-pattern",
            "reflection",
        ]);
        result.knowledgeExtracted += 1;
    }
    for (const optimization of parsed.optimizations) {
        await addKnowledge(cwd, "pattern", optimization, "agent_reflection", [
            "optimization",
            "reflection",
        ]);
        result.knowledgeExtracted += 1;
    }
    if (config.skillAutoCreate) {
        for (const suggestion of parsed.skillSuggestions) {
            const existing = await listUserSkills(cwd);
            const match = existing.find((s) => s.name.toLowerCase().includes(suggestion.name.toLowerCase()) ||
                suggestion.name.toLowerCase().includes(s.name.toLowerCase()));
            if (match && config.skillAutoRefine) {
                await patchSkill(cwd, match.name, { description: suggestion.description }, `Refined based on reflection: ${suggestion.description}`, "auto");
                result.skillsPatched += 1;
            }
            else if (!match) {
                const triggerWords = suggestion.name
                    .toLowerCase()
                    .split(/[\s-]+/)
                    .filter((w) => w.length > 2);
                await createSkill(cwd, suggestion.name, `# ${suggestion.name}\n\n${suggestion.description}`, triggerWords, undefined, "auto");
                result.skillsCreated += 1;
            }
        }
    }
    if (result.knowledgeExtracted > 0) {
        await rebuildMemoryFromKnowledge(cwd);
    }
    result.summary = [
        `Reflection complete: ${result.knowledgeExtracted} insights extracted,`,
        `${result.skillsCreated} skills created, ${result.skillsPatched} skills refined.`,
    ].join(" ");
    return result;
}
function summarizeTranscript(messages) {
    const parts = [];
    let toolUseCount = 0;
    let errorCount = 0;
    for (const msg of messages) {
        if (msg.type === "user") {
            parts.push(`[User] ${msg.content.slice(0, 200)}`);
        }
        else if (msg.type === "assistant") {
            const aMsg = msg;
            for (const block of aMsg.content) {
                if (block.type === "text") {
                    parts.push(`[Assistant] ${block.text.slice(0, 200)}`);
                }
                else if (block.type === "tool_use") {
                    toolUseCount += 1;
                    parts.push(`[Tool Call] ${block.name}: ${JSON.stringify(block.input).slice(0, 150)}`);
                }
            }
        }
        else if (msg.type === "tool_result") {
            if (msg.isError) {
                errorCount += 1;
                parts.push(`[Tool Error] ${msg.content.slice(0, 200)}`);
            }
            else {
                parts.push(`[Tool Result] ${msg.content.slice(0, 150)}`);
            }
        }
    }
    parts.push(`\n--- Stats: ${toolUseCount} tool calls, ${errorCount} errors ---`);
    return parts.join("\n");
}
function formatTriggerContext(trigger) {
    switch (trigger.type) {
        case "task_completed":
            return `Task completed with ${trigger.errorCount} errors and ${trigger.toolUseCount} tool uses`;
        case "task_failed":
            return `Task failed with ${trigger.errorCount} errors. Last error: ${trigger.lastError}`;
        case "repeated_errors":
            return `Repeated error pattern detected: "${trigger.errorPattern}" (${trigger.count} times)`;
        case "cron_schedule":
            return `Scheduled reflection (cron: ${trigger.schedule})`;
        case "user_request":
            return `User requested reflection: ${trigger.prompt}`;
    }
}

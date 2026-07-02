import type { Message, AssistantMessage } from "../runtime/messages";
import type { ToolUseContext } from "../tools/Tool";
import { runAgent, type RunAgentParams } from "../tools/agent/runAgent";
import { addKnowledge, type KnowledgeCategory } from "../storage/knowledge";
import { rebuildMemoryFromKnowledge } from "../storage/memory";
import {
  createSkill,
  patchSkill,
  listUserSkills,
  type EvolvableSkill,
} from "../skills/skillManager";

export type ReflectionTrigger =
  | { type: "task_completed"; errorCount: number; toolUseCount: number }
  | { type: "task_failed"; errorCount: number; lastError: string }
  | { type: "repeated_errors"; errorPattern: string; count: number }
  | { type: "cron_schedule"; schedule: string }
  | { type: "user_request"; prompt: string };

export type ReflectionResult = {
  knowledgeExtracted: number;
  skillsCreated: number;
  skillsPatched: number;
  summary: string;
};

export type ReflectionConfig = {
  enabled: boolean;
  reflectionOnComplete: boolean;
  reflectionOnError: boolean;
  errorThreshold: number;
  toolUseThreshold: number;
  skillAutoCreate: boolean;
  skillAutoRefine: boolean;
  skillRefineThreshold: number;
};

export const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  enabled: true,
  reflectionOnComplete: false,
  reflectionOnError: true,
  errorThreshold: 2,
  toolUseThreshold: 15,
  skillAutoCreate: true,
  skillAutoRefine: true,
  skillRefineThreshold: 10,
};

export function shouldReflect(
  trigger: ReflectionTrigger,
  config: ReflectionConfig = DEFAULT_REFLECTION_CONFIG,
): boolean {
  if (!config.enabled) return false;

  switch (trigger.type) {
    case "task_completed":
      if (!config.reflectionOnComplete) return false;
      return (
        trigger.errorCount > 0 || trigger.toolUseCount > config.toolUseThreshold
      );
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

function parseReflectionOutput(
  output: string,
): {
  successPatterns: string[];
  antiPatterns: string[];
  optimizations: string[];
  skillSuggestions: Array<{ name: string; description: string }>;
  constraints: string[];
  remediations: Array<{ fingerprint: string; strategy: string }>;
} {
  const result = {
    successPatterns: [] as string[],
    antiPatterns: [] as string[],
    optimizations: [] as string[],
    skillSuggestions: [] as Array<{ name: string; description: string }>,
    constraints: [] as string[],
    remediations: [] as Array<{ fingerprint: string; strategy: string }>,
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
    } else if (header.includes("anti")) {
      result.antiPatterns = items;
    } else if (header.includes("optim")) {
      result.optimizations = items;
    } else if (header.includes("constraint")) {
      result.constraints = items;
    } else if (header.includes("remediation") || header.includes("remedy")) {
      for (const item of items) {
        // Format: "fingerprint | strategy" or just "strategy"
        const pipeIndex = item.indexOf("|");
        if (pipeIndex > 0) {
          result.remediations.push({
            fingerprint: item.slice(0, pipeIndex).trim(),
            strategy: item.slice(pipeIndex + 1).trim(),
          });
        } else {
          result.remediations.push({ fingerprint: "unknown", strategy: item });
        }
      }
    } else if (header.includes("skill")) {
      for (const item of items) {
        const colonIndex = item.indexOf(":");
        if (colonIndex > 0) {
          result.skillSuggestions.push({
            name: item.slice(0, colonIndex).trim(),
            description: item.slice(colonIndex + 1).trim(),
          });
        } else {
          result.skillSuggestions.push({ name: item, description: item });
        }
      }
    }
  }

  return result;
}

export async function runReflection(
  cwd: string,
  messages: Message[],
  trigger: ReflectionTrigger,
  parentContext: ToolUseContext,
  config: ReflectionConfig = DEFAULT_REFLECTION_CONFIG,
): Promise<ReflectionResult> {
  const result: ReflectionResult = {
    knowledgeExtracted: 0,
    skillsCreated: 0,
    skillsPatched: 0,
    summary: "",
  };

  const transcriptSummary = summarizeTranscript(messages);
  const triggerContext = formatTriggerContext(trigger);

  // Domain-focused reflection prompt: ask WHY this task step failed/succeeded,
  // not "how could the agent use tools better". The goal is to extract
  // constraints (hard rules to prevent repeats) and remediations (fix recipes).
  const reflectionPrompt = [
    "You are analyzing a workflow task transcript to extract DOMAIN-SPECIFIC insights.",
    "Focus on the TASK outcome (why did this gRPC call / recipe step fail or succeed),",
    "NOT on meta-commentary about tool usage patterns.",
    "",
    `Trigger: ${triggerContext}`,
    "",
    "## Transcript Summary",
    transcriptSummary,
    "",
    "Extract insights in this EXACT format:",
    "",
    "## Anti-Patterns",
    "- [what went wrong in THIS domain task, e.g. 'gRPC SendMessage to RecipeTool failed because WaferMap was not loaded first']",
    "",
    "## Constraints",
    "- [hard rules to prevent recurrence. Format: 'agentType=X toolName=Y: rule description'",
    "  e.g. 'agentType=grpc-worker toolName=GrpcClient: must call LoadWafer before CorrectWaferMap']",
    "  These will be ENFORCED (blocked) on future calls, so be precise and conservative.",
    "",
    "## Remediations",
    "- [error fingerprint | fix strategy]",
    "  e.g. 'grpc:UNAVAILABLE:AlgoService | check device address is reachable, then retry']",
    "  e.g. 'RecipeTool:CompletePage:failed | ensure previous step's property page was saved first']",
    "",
    "## Success Patterns",
    "- [what worked well that should be repeated, domain-specific not tool-usage-generic]",
    "",
    "## Optimization Opportunities",
    "- [concrete improvements to this workflow, not generic advice]",
    "",
    "## Skill Suggestions",
    "- [skill name]: [description]",
    "",
    "IMPORTANT: Do NOT produce generic coding-agent meta-commentary like 'should have used SearchFiles instead of Read'.",
    "Focus ONLY on the industrial workflow domain (gRPC calls, recipe steps, wafer alignment, equipment state).",
  ].join("\n");

  let reflectionOutput: string;
  try {
    reflectionOutput = await runAgent({
      description: "Self-reflection analysis",
      prompt: reflectionPrompt,
      subagentType: "reflect",
      parentContext,
      maxTurns: 4,
    });
  } catch {
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

  // Constraints: hard rules that will be enforced by constraintEngine.ts
  // (beforeToolCall hook). Low initial confidence (0.5) — must prove itself
  // by surviving multiple reflections before reaching block-level (0.8).
  for (const constraint of parsed.constraints) {
    await addKnowledge(cwd, "constraint", constraint, "agent_reflection", [
      "constraint",
      "reflection",
      "warn", // default to warn until confidence rises
    ], 0.5);
    result.knowledgeExtracted += 1;
  }

  // Remediations: error fingerprint → fix strategy mappings.
  // Consumed by RemediationEngine (P2) to suggest/automate fixes.
  for (const remediation of parsed.remediations) {
    const content = `${remediation.fingerprint} | ${remediation.strategy}`;
    await addKnowledge(cwd, "remediation", content, "agent_reflection", [
      "remediation",
      "reflection",
    ], 0.6);
    result.knowledgeExtracted += 1;
  }

  if (config.skillAutoCreate) {
    for (const suggestion of parsed.skillSuggestions) {
      const existing = await listUserSkills(cwd);
      const match = existing.find(
        (s) =>
          s.name.toLowerCase().includes(suggestion.name.toLowerCase()) ||
          suggestion.name.toLowerCase().includes(s.name.toLowerCase()),
      );

      if (match && config.skillAutoRefine) {
        await patchSkill(
          cwd,
          match.name,
          { description: suggestion.description },
          `Refined based on reflection: ${suggestion.description}`,
          "auto",
        );
        result.skillsPatched += 1;
      } else if (!match) {
        const triggerWords = suggestion.name
          .toLowerCase()
          .split(/[\s-]+/)
          .filter((w) => w.length > 2);
        await createSkill(
          cwd,
          suggestion.name,
          `# ${suggestion.name}\n\n${suggestion.description}`,
          triggerWords,
          undefined,
          "auto",
        );
        result.skillsCreated += 1;
      }
    }
  }

  if (result.knowledgeExtracted > 0) {
    await rebuildMemoryFromKnowledge(cwd);
  }

  result.summary = [
    `Reflection complete: ${result.knowledgeExtracted} insights extracted`,
    `(${parsed.constraints.length} constraints, ${parsed.remediations.length} remediations,`,
    `${parsed.antiPatterns.length} anti-patterns, ${parsed.successPatterns.length} patterns),`,
    `${result.skillsCreated} skills created, ${result.skillsPatched} skills refined.`,
  ].join(" ");

  return result;
}

function summarizeTranscript(messages: Message[]): string {
  const parts: string[] = [];
  let toolUseCount = 0;
  let errorCount = 0;

  for (const msg of messages) {
    if (msg.type === "user") {
      parts.push(`[User] ${msg.content.slice(0, 200)}`);
    } else if (msg.type === "assistant") {
      const aMsg = msg as AssistantMessage;
      for (const block of aMsg.content) {
        if (block.type === "text") {
          parts.push(`[Assistant] ${block.text.slice(0, 200)}`);
        } else if (block.type === "tool_use") {
          toolUseCount += 1;
          parts.push(
            `[Tool Call] ${block.name}: ${JSON.stringify(block.input).slice(0, 150)}`,
          );
        }
      }
    } else if (msg.type === "tool_result") {
      if (msg.isError) {
        errorCount += 1;
        parts.push(`[Tool Error] ${msg.content.slice(0, 200)}`);
      } else {
        parts.push(`[Tool Result] ${msg.content.slice(0, 150)}`);
      }
    }
  }

  parts.push(`\n--- Stats: ${toolUseCount} tool calls, ${errorCount} errors ---`);

  return parts.join("\n");
}

function formatTriggerContext(trigger: ReflectionTrigger): string {
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

/**
 * Knowledge Extraction Hook
 *
 * Automatically records anti-patterns when tools fail,
 * and patterns when complex tool usage succeeds.
 *
 * Register this hook at application startup to enable automatic knowledge extraction.
 */

import { registerHooks, type HookContext, type AfterHookResult } from "./hooks";
import { addKnowledge } from "../storage/knowledge";
import { rebuildMemoryFromKnowledge } from "../storage/memory";

/** Error patterns to extract as anti-patterns */
const ERROR_PATTERNS = [
  { pattern: /ENOENT.*no such file/i, insight: "File not found errors often indicate wrong path or missing file" },
  { pattern: /EACCES.*permission denied/i, insight: "Permission denied errors indicate insufficient access rights" },
  { pattern: /timeout/i, insight: "Timeout errors may indicate network issues or overloaded services" },
  { pattern: /ECONNREFUSED/i, insight: "Connection refused errors indicate service is not running or wrong address" },
  { pattern: /gRPC.*failed/i, insight: "gRPC failures should be checked for service availability and correct proto definitions" },
];

/** Track error counts per tool for pattern detection */
const toolErrorCounts = new Map<string, number>();

/** Track successful complex tool sequences */
const toolUsageCounts = new Map<string, number>();

/**
 * Register the knowledge extraction hook.
 * Call this at application startup to enable automatic knowledge extraction.
 */
export function registerKnowledgeHook(cwd: string): void {
  registerHooks({
    afterToolCall: async (ctx: HookContext, result: unknown, error?: Error): Promise<AfterHookResult> => {
      try {
        if (error) {
          await handleError(cwd, ctx, error);
        } else {
          await handleSuccess(cwd, ctx);
        }
      } catch (hookError) {
        // Don't let hook errors affect main execution
        console.error("[KnowledgeHook] Error:", hookError);
      }
      return {};
    },
  });
}

async function handleError(cwd: string, ctx: HookContext, error: Error): Promise<void> {
  const errorMessage = error.message;
  const toolKey = ctx.toolName;

  // Increment error count
  toolErrorCounts.set(toolKey, (toolErrorCounts.get(toolKey) || 0) + 1);

  // Check for known error patterns
  for (const { pattern, insight } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      await addKnowledge(
        cwd,
        "anti_pattern",
        `${ctx.toolName}: ${insight} (Error: ${errorMessage.slice(0, 100)})`,
        "user_implicit",
        [ctx.toolName.toLowerCase(), "error"],
        0.7,
      );
      break; // Only record first matching pattern
    }
  }

  // Record repeated errors as anti-pattern
  const errorCount = toolErrorCounts.get(toolKey) || 0;
  if (errorCount >= 3) {
    await addKnowledge(
      cwd,
      "anti_pattern",
      `Tool "${ctx.toolName}" has failed ${errorCount} times in this session. Consider alternative approaches.`,
      "user_implicit",
      [ctx.toolName.toLowerCase(), "recurring-error"],
      0.8,
    );
    // Reset counter after recording
    toolErrorCounts.set(toolKey, 0);
  }

  // Rebuild memory after knowledge addition
  await rebuildMemoryFromKnowledge(cwd).catch(() => {});
}

async function handleSuccess(cwd: string, ctx: HookContext): Promise<void> {
  const toolKey = ctx.toolName;

  // Track usage count
  toolUsageCounts.set(toolKey, (toolUsageCounts.get(toolKey) || 0) + 1);

  // Record efficiency pattern for complex tool usage
  const usageCount = toolUsageCounts.get(toolKey) || 0;
  if (usageCount === 15) {
    await addKnowledge(
      cwd,
      "pattern",
      `Tool "${ctx.toolName}" used 15+ times in session - complex workflow detected`,
      "user_implicit",
      [ctx.toolName.toLowerCase(), "efficiency"],
      0.6,
    );
    await rebuildMemoryFromKnowledge(cwd).catch(() => {});
  }
}

/** Reset tracking counters (call at session start) */
export function resetKnowledgeHookCounters(): void {
  toolErrorCounts.clear();
  toolUsageCounts.clear();
}

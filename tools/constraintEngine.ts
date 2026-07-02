/**
 * Constraint Engine — enforces hard constraints extracted by reflection.
 *
 * This is the 2nd line of defense against "agent 自作主张":
 *   1st line: ToolRouter tool whitelist (grpc-worker can't see WriteTool)
 *   2nd line: this hook — blocks or modifies tool calls based on learned constraints
 *   3rd line: system prompt anti_patterns (soft, LLM may ignore)
 *
 * Constraints are stored in knowledge.json with category="constraint".
 * Each constraint has a matchRule (agentType/toolName/taskPhase) and an
 * enforcement level ("block" = hard reject, "warn" = allow but log).
 *
 * Register via registerConstraintHook(cwd) at startup.
 */

import { registerHooks, type HookContext, type BeforeHookResult } from "./hooks";
import { loadKnowledgeStore, type KnowledgeEntry } from "../storage/knowledge";

/** Match rule for a constraint entry. All present fields must match. */
type ConstraintMatchRule = {
  agentType?: string;
  toolName?: string;
};

/** Extracted match rule from a constraint knowledge entry's content.
 *  Content format: "agentType=X toolName=Y: <description>" or just "<description>".
 *  The structured fields are optional; if absent, the constraint applies broadly. */
function parseMatchRule(entry: KnowledgeEntry): ConstraintMatchRule {
  const rule: ConstraintMatchRule = {};
  const content = entry.content;
  // Try to parse "agentType=X toolName=Y" prefix
  const agentMatch = content.match(/agentType=(\S+)/);
  if (agentMatch) rule.agentType = agentMatch[1];
  const toolMatch = content.match(/toolName=(\S+)/);
  if (toolMatch) rule.toolName = toolMatch[1];
  return rule;
}

/** Determine enforcement level from entry tags. Default to "warn" for safety. */
function getEnforcement(entry: KnowledgeEntry): "block" | "warn" {
  if (entry.tags.includes("block")) return "block";
  if (entry.tags.includes("warn")) return "warn";
  // High-confidence constraints default to block
  if (entry.confidence >= 0.8) return "block";
  return "warn";
}

/** Check if a constraint matches the current hook context. */
function matchesConstraint(
  entry: KnowledgeEntry,
  ctx: HookContext,
): boolean {
  const rule = parseMatchRule(entry);
  if (rule.agentType && ctx.context.agentType && ctx.context.agentType !== rule.agentType) {
    return false;
  }
  if (rule.toolName && ctx.toolName !== rule.toolName) {
    return false;
  }
  return true;
}

/** Register the constraint hook. Call at application startup. */
export function registerConstraintHook(cwd: string): void {
  registerHooks({
    beforeToolCall: async (ctx: HookContext): Promise<BeforeHookResult> => {
      try {
        const store = await loadKnowledgeStore(cwd);
        const constraints = store.entries.filter(e => e.category === "constraint");

        let blockedBy: KnowledgeEntry | null = null;
        const warnings: string[] = [];

        for (const entry of constraints) {
          if (!matchesConstraint(entry, ctx)) continue;
          if (getEnforcement(entry) === "block") {
            blockedBy = entry;
            break; // first block wins
          } else {
            warnings.push(entry.content.slice(0, 100));
          }
        }

        if (blockedBy) {
          const reason = `Constraint violated: ${blockedBy.content.slice(0, 200)}`;
          console.warn(`[ConstraintEngine] BLOCKED ${ctx.toolName}: ${reason}`);
          return { proceed: false, reason };
        }

        if (warnings.length > 0) {
          // Warn but allow — log for observability
          console.warn(`[ConstraintEngine] WARN ${ctx.toolName}: ${warnings.join("; ")}`);
        }
      } catch (hookError) {
        // Don't block execution on hook failure
        console.error("[ConstraintEngine] Error:", hookError);
      }
      return { proceed: true };
    },
  });
}

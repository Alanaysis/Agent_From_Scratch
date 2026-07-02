/**
 * Remediation Engine — records and recalls how users manually fixed errors.
 *
 * "越用越聪明" core: when a task fails and the user manually changes params
 * then retries successfully, we record what they changed. Next time the same
 * error fingerprint appears, we can suggest (or for transient, auto-apply)
 * the same fix.
 *
 * Storage: knowledge.json entries with category="remediation".
 * Format: "fingerprint | strategy" where strategy may include param diff.
 *
 * This module is intentionally side-effect-free for reads — it only records
 * on explicit calls, never auto-modifies task params.
 */

import { loadKnowledgeStore, addKnowledge, type KnowledgeEntry } from "../storage/knowledge";

/** Compute the diff between two parameter objects. */
export function computeParamDiff(
  oldParams: Record<string, unknown>,
  newParams: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldParams), ...Object.keys(newParams)]);
  for (const key of allKeys) {
    const oldVal = oldParams[key];
    const newVal = newParams[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { from: oldVal, to: newVal };
    }
  }
  return diff;
}

/** Generate an error fingerprint from a gRPC error message or task failure.
 *  Format: "tool:errorCode:service" or "task:errorType" for non-gRPC errors. */
export function fingerprintError(errorMessage: string): string {
  // gRPC error: "gRPC error [14]: ..." → "grpc:14"
  const grpcMatch = errorMessage.match(/gRPC error \[(\d+)\]/);
  if (grpcMatch) {
    return `grpc:${grpcMatch[1]}`;
  }
  // gRPC call failed (after retries): "gRPC call failed: gRPC error [14]: ..."
  const grpcFailMatch = errorMessage.match(/gRPC call failed.*gRPC error \[(\d+)\]/);
  if (grpcFailMatch) {
    return `grpc:${grpcFailMatch[1]}`;
  }
  // Proto/service errors
  if (errorMessage.includes("Proto file not found")) return "grpc:proto-not-found";
  if (errorMessage.includes("Service") && errorMessage.includes("not found")) return "grpc:service-not-found";
  if (errorMessage.includes("Method") && errorMessage.includes("not found")) return "grpc:method-not-found";
  // Generic
  const firstLine = errorMessage.split("\n")[0] || errorMessage;
  return `task:${firstLine.slice(0, 50).replace(/[^a-zA-Z0-9]/g, ":")}`;
}

/** Record that a user manually fixed a task by changing params, then it succeeded.
 *  This is the "learning" half — the user showed us how to fix it. */
export async function recordUserRemediation(
  cwd: string,
  taskId: string,
  sessionId: string | undefined,
  errorMessage: string,
  paramDiff: Record<string, { from: unknown; to: unknown }>,
  taskTitle: string,
): Promise<void> {
  if (Object.keys(paramDiff).length === 0) return; // nothing to learn

  const fingerprint = fingerprintError(errorMessage);
  const diffStr = Object.entries(paramDiff)
    .map(([k, v]) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`)
    .join("; ");
  const strategy = `User changed [${diffStr}] and retry succeeded`;
  const content = `${fingerprint} | ${strategy}`;

  await addKnowledge(cwd, "remediation", content, "agent_reflection", [
    "remediation",
    "user-action",
    fingerprint,
  ], 0.7); // user-confirmed fix — higher confidence than reflection-extracted

  console.log(`[RemediationEngine] Recorded user fix for ${fingerprint}: ${diffStr.slice(0, 100)}`);
}

/** Find a remediation entry matching the given error fingerprint.
 *  Returns the most recently used, highest-confidence match. */
export async function findRemediation(
  cwd: string,
  errorMessage: string,
): Promise<{ content: string; confidence: number; fingerprint: string } | null> {
  const fingerprint = fingerprintError(errorMessage);
  const store = await loadKnowledgeStore(cwd);

  const matches = store.entries.filter(
    e => e.category === "remediation" && e.content.startsWith(fingerprint)
  );

  if (matches.length === 0) return null;

  // Sort by confidence (desc) then usageCount (desc)
  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.usageCount - a.usageCount;
  });

  const top = matches[0]!;
  return {
    content: top.content,
    confidence: top.confidence,
    fingerprint,
  };
}

/** Get all remediation entries (for the future RemediationPanel UI). */
export async function listRemediations(
  cwd: string,
): Promise<KnowledgeEntry[]> {
  const store = await loadKnowledgeStore(cwd);
  return store.entries.filter(e => e.category === "remediation");
}

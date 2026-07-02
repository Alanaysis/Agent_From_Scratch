/**
 * Audit Log — structured record of every tool call for traceability.
 *
 * Writes to .irg/audit.jsonl (one JSON object per line).
 * Each entry captures: taskId, sessionId, tool, input, output, duration,
 * error, actor (agentType), and timestamp.
 *
 * Consumed by the frontend AuditDrawer (P1) for debugging and by
 * the industrial traceability requirement (半导体行业可追溯).
 */

import { appendFile, mkdir, readFile } from "fs/promises";
import { join } from "path";

export type AuditEntry = {
  id: string;
  timestamp: string;
  taskId: string;
  sessionId?: string;
  tool: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
  actor?: string; // agentType
  blocked?: boolean; // true if blocked by constraint/schema
  blockReason?: string;
};

function getAuditPath(cwd: string): string {
  return join(cwd, ".irg", "audit.jsonl");
}

export async function appendAudit(
  cwd: string,
  entry: Omit<AuditEntry, "id" | "timestamp">,
): Promise<void> {
  const fullEntry: AuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  await mkdir(join(cwd, ".irg"), { recursive: true });
  await appendFile(getAuditPath(cwd), `${JSON.stringify(fullEntry)}\n`, "utf8");
}

export async function readAuditLog(
  cwd: string,
  filters?: {
    taskId?: string;
    sessionId?: string;
    tool?: string;
    limit?: number;
  },
): Promise<AuditEntry[]> {
  let content: string;
  try {
    content = await readFile(getAuditPath(cwd), "utf8");
  } catch {
    return [];
  }

  let entries = content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line) as AuditEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is AuditEntry => e !== null);

  if (filters?.taskId) {
    entries = entries.filter(e => e.taskId === filters.taskId);
  }
  if (filters?.sessionId) {
    entries = entries.filter(e => e.sessionId === filters.sessionId);
  }
  if (filters?.tool) {
    entries = entries.filter(e => e.tool === filters.tool);
  }

  // Most recent first
  entries.reverse();

  if (filters?.limit) {
    entries = entries.slice(0, filters.limit);
  }

  return entries;
}

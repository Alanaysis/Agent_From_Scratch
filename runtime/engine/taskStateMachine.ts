/**
 * Task State Machine — centralized state transition rules + rewind support.
 *
 * Extracted from storage/taskIndex.ts to make the state machine a
 * first-class citizen in runtime/engine/. The storage layer still
 * owns persistence, but transition rules and rewind logic live here.
 *
 * Rewind: uses statusHistory to restore a task to a previous state.
 * This enables "回到任意节点重跑" without introducing xstate.
 */

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "pausing"
  | "paused"
  | "cancelling"
  | "cancelled"
  | "verify"
  | "done"
  | "failed"
  | "skipped";

export type StatusHistoryEntry = {
  status: TaskStatus;
  timestamp: string;
  actor?: string;
};

/** Valid state transitions. Keys are current state, values are allowed next states. */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "failed", "skipped", "cancelled", "done"],
  in_progress: ["verify", "failed", "pausing", "paused", "cancelling", "cancelled", "todo", "done"],
  pausing: ["paused", "failed", "todo"],
  paused: ["in_progress", "cancelling", "cancelled", "todo", "failed", "done"],
  cancelling: ["cancelled", "failed"],
  verify: ["done", "in_progress", "paused", "cancelled", "todo"],
  // `done` is terminal for the success path — do NOT allow done → failed,
  // otherwise already-completed tasks could be retroactively broken and
  // affect downstream tasks that already ran based on the done state.
  done: ["todo", "in_progress"],
  failed: ["todo", "in_progress", "paused", "skipped", "cancelled"],
  cancelled: ["todo"],
  skipped: ["todo", "in_progress"],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from as TaskStatus]?.includes(to as TaskStatus) ?? false;
}

export function getValidTransitions(from: string): TaskStatus[] {
  return VALID_TRANSITIONS[from as TaskStatus] || [];
}

/** Check if a task can be rewound to a specific historical status.
 *  Rewind is allowed if:
 *  - The target status exists in statusHistory
 *  - The transition from current status to target status is valid
 *    (or the task is in a terminal/failed state, which allows rewind)
 */
export function canRewindTo(
  currentStatus: string,
  targetStatus: string,
  statusHistory: StatusHistoryEntry[],
): boolean {
  // Target must exist in history
  const existsInHistory = statusHistory.some(e => e.status === targetStatus);
  if (!existsInHistory) return false;

  // If already at target, no rewind needed
  if (currentStatus === targetStatus) return false;

  // Rewind is always allowed to a historical state that the task
  // previously held. This is because rewind means "go back and re-run
  // from this point", which is a user-initiated action.
  // The actual state transition (e.g. done → todo) is validated
  // by isValidTransition when the rewind is executed.
  // done → todo and failed → todo are both in VALID_TRANSITIONS.
  return isValidTransition(currentStatus, targetStatus) ||
    currentStatus === "done" ||
    currentStatus === "failed" ||
    currentStatus === "cancelled";
}

/** Get the list of statuses that a task can be rewound to. */
export function getRewindTargets(
  currentStatus: string,
  statusHistory: StatusHistoryEntry[],
): StatusHistoryEntry[] {
  // Deduplicate by status, keeping the most recent occurrence
  const seen = new Set<string>();
  const targets: StatusHistoryEntry[] = [];
  for (let i = statusHistory.length - 1; i >= 0; i--) {
    const entry = statusHistory[i]!;
    if (entry.status === currentStatus) continue; // skip current
    if (seen.has(entry.status)) continue;
    if (canRewindTo(currentStatus, entry.status, statusHistory)) {
      seen.add(entry.status);
      targets.push(entry);
    }
  }
  return targets;
}

/** Terminal states — tasks in these states cannot progress further
 *  without rewind or external intervention. */
export const TERMINAL_STATES: ReadonlySet<TaskStatus> = new Set([
  "done",
  "failed",
  "cancelled",
  "skipped",
]);

/** Check if a status is terminal. */
export function isTerminal(status: string): boolean {
  return TERMINAL_STATES.has(status as TaskStatus);
}

/** Active states — tasks in these states are currently being processed. */
export const ACTIVE_STATES: ReadonlySet<TaskStatus> = new Set([
  "in_progress",
  "pausing",
  "cancelling",
]);

/** Check if a status is active (currently being processed). */
export function isActive(status: string): boolean {
  return ACTIVE_STATES.has(status as TaskStatus);
}

import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";

// Per-task write lock to prevent race conditions in read-modify-write
const taskLocks = new Map<string, Promise<void>>();

async function withTaskLock<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
  const prev = taskLocks.get(taskId) ?? Promise.resolve();
  const current = prev.then(fn, fn); // chain regardless of previous result
  taskLocks.set(taskId, current.then(() => {}, () => {}));
  try {
    return await current;
  } finally {
    // Clean up if this is the last in the chain
    if (taskLocks.get(taskId) === current.then(() => {}, () => {})) {
      taskLocks.delete(taskId);
    }
  }
}

export type TaskActivity = {
  id: string;
  action: "created" | "assigned" | "released" | "status_changed" | "updated" | "comment_added";
  actor?: string;
  details?: string;
  timestamp: string;
}

export type AcceptanceCriterion = {
  id: string;
  text: string;
  status: "pending" | "passed" | "failed";
  evidence?: string;
}

export type StepCondition = {
  /** step_result: based on a previous step's output; llm_judge: LLM decides */
  type: "step_result" | "llm_judge";
  /** For step_result: which step to check */
  source?: string;
  /** For step_result: which field to check (status, result, etc.) */
  field?: string;
  /** For step_result: expected value */
  equals?: string;
  /** For llm_judge: prompt to ask the LLM */
  prompt?: string;
  /** For llm_judge: possible options the LLM can choose from */
  options?: string[];
};

export type LoopConfig = {
  /** Max iterations before forced exit */
  max: number;
  /** Steps to repeat (by ID) */
  steps: string[];
  /** Exit condition: stop looping when condition met */
  until?: StepCondition;
  /** What to do when max iterations exhausted: abort | continue | skip */
  onExhausted?: "abort" | "continue" | "skip";
};

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

export type TaskInfo = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  assignee?: string;
  dependsOn?: string[];
  proposalId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  errorCount?: number;
  lastError?: string;
  sessionId?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  relatedDocumentIds?: string[];
  autoVerify?: boolean;
  requiresApproval?: boolean;
  approvalMessage?: string;
  checkpointAfter?: boolean;
  checkpointMessage?: string;
  grpcConfig?: {
    protoFile: string;
    service: string;
    method: string;
    address: string;
    payload: Record<string, unknown>;
    metadata?: Record<string, string>;
    deadline?: number;
  };
  activities: TaskActivity[];
  statusHistory: Array<{ status: string; timestamp: string; actor?: string }>;
  /** Conditional execution: task only runs if condition is met */
  condition?: StepCondition
  /** Loop configuration: repeat steps until condition or max count */
  loop?: LoopConfig
  /** Whether this task was skipped due to condition not met */
  skipped?: boolean
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  todo: ["in_progress", "failed", "skipped", "cancelled"],
  in_progress: ["verify", "failed", "pausing", "paused", "cancelling", "cancelled"],
  pausing: ["paused", "failed"],
  paused: ["in_progress", "cancelling", "cancelled"],
  cancelling: ["cancelled", "failed"],
  verify: ["done", "in_progress", "paused", "cancelled"],
  done: [],
  failed: ["todo"],
  cancelled: [],
  skipped: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function evaluateCondition(
  condition: StepCondition,
  allTasks: TaskInfo[],
): boolean {
  if (condition.type === 'llm_judge') {
    // For llm_judge, we need to defer to runtime, default to true for now
    console.warn('[evaluateCondition] llm_judge condition not implemented in static check, defaulting to true');
    return true;
  }

  if (condition.type !== 'step_result') {
    return true;
  }

  const sourceTask = allTasks.find(t => t.id === condition.source);
  if (!sourceTask) {
    console.warn(`[evaluateCondition] Source task "${condition.source}" not found, defaulting to false`);
    return false;
  }

  const field = condition.field || 'status';
  const actualValue = (sourceTask as any)[field];
  const expectedValue = condition.equals;

  const match = actualValue === expectedValue;
  console.log(`[evaluateCondition] Task "${sourceTask.title}" ${field}: "${actualValue}" vs expected "${expectedValue}" → ${match}`);
  return match;
}

function getTasksDir(cwd: string): string {
  return join(cwd, ".irg", "tasks");
}

function getTaskInfoPath(cwd: string, taskId: string): string {
  return join(getTasksDir(cwd), `${taskId}.json`);
}

export function getTaskInfoFilePath(cwd: string, taskId: string): string {
  return getTaskInfoPath(cwd, taskId);
}

export async function readTaskInfo(
  cwd: string,
  taskId: string,
): Promise<TaskInfo | null> {
  try {
    const content = await readFile(getTaskInfoPath(cwd, taskId), "utf8");
    return JSON.parse(content) as TaskInfo;
  } catch {
    return null;
  }
}

export async function createTask(
  cwd: string,
  task: Omit<TaskInfo, "createdAt" | "updatedAt" | "activities" | "statusHistory">,
): Promise<TaskInfo> {
  const now = new Date().toISOString();
  const newTask: TaskInfo = {
    ...task,
    createdAt: now,
    updatedAt: now,
    activities: [{
      id: `activity-${Date.now()}`,
      action: "created",
      actor: task.createdBy,
      details: `Task created: ${task.title}`,
      timestamp: now,
    }],
    statusHistory: [{
      status: task.status || "todo",
      timestamp: now,
      actor: task.createdBy,
    }],
  };

  await mkdir(getTasksDir(cwd), { recursive: true });
  await writeFile(
    getTaskInfoPath(cwd, task.id),
    `${JSON.stringify(newTask, null, 2)}\n`,
    "utf8",
  );
  return newTask;
}

export async function updateTaskInfo(
  cwd: string,
  taskId: string,
  updates: Partial<Omit<TaskInfo, "id" | "createdAt" | "activities" | "statusHistory">>,
  actor?: string,
): Promise<TaskInfo | null> {
  return withTaskLock(taskId, async () => {
  const previous = await readTaskInfo(cwd, taskId);
  if (!previous) {
    return null;
  }

  // Validate state transition if status is being changed
  if (updates.status && updates.status !== previous.status) {
    if (!isValidTransition(previous.status, updates.status)) {
      throw new Error(
        `Invalid status transition from "${previous.status}" to "${updates.status}". ` +
        `Valid transitions: ${VALID_TRANSITIONS[previous.status]?.join(", ") || "none"}`
      );
    }
  }

  // Filter out undefined values to prevent overwriting existing fields
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  const now = new Date().toISOString();
  const activities: TaskActivity[] = [...previous.activities];
  const statusHistory = [...previous.statusHistory];
  let activityCounter = activities.length;

  if (cleanUpdates.status && cleanUpdates.status !== previous.status) {
    activities.push({
      id: `activity-${Date.now()}-${activityCounter++}`,
      action: "status_changed",
      actor,
      details: `Status changed from ${previous.status} to ${cleanUpdates.status}`,
      timestamp: now,
    });
    statusHistory.push({
      status: cleanUpdates.status as TaskInfo["status"],
      timestamp: now,
      actor,
    });
  }

  if (cleanUpdates.assignee !== undefined && cleanUpdates.assignee !== previous.assignee) {
    activities.push({
      id: `activity-${Date.now()}-${activityCounter++}`,
      action: cleanUpdates.assignee ? "assigned" : "released",
      actor,
      details: cleanUpdates.assignee ? `Assigned to ${cleanUpdates.assignee}` : "Released",
      timestamp: now,
    });
  }

  const updated: TaskInfo = {
    ...previous,
    ...cleanUpdates,
    updatedAt: now,
    activities,
    statusHistory,
  };

  await mkdir(getTasksDir(cwd), { recursive: true });
  await writeFile(
    getTaskInfoPath(cwd, taskId),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return updated;
  }); // end withTaskLock
}

export async function deleteTaskInfo(
  cwd: string,
  taskId: string,
): Promise<void> {
  await rm(getTaskInfoPath(cwd, taskId), { force: true });
}

export async function addTaskComment(
  cwd: string,
  taskId: string,
  comment: string,
  actor?: string,
): Promise<TaskInfo | null> {
  return withTaskLock(taskId, async () => {
    const previous = await readTaskInfo(cwd, taskId);
    if (!previous) {
      return null;
    }

    const now = new Date().toISOString();
    const updated: TaskInfo = {
      ...previous,
      updatedAt: now,
      activities: [
        ...previous.activities,
        {
          id: `activity-${Date.now()}-${previous.activities.length}`,
          action: "comment_added",
          actor,
          details: comment,
          timestamp: now,
        },
      ],
    };

    await mkdir(getTasksDir(cwd), { recursive: true });
    await writeFile(
      getTaskInfoPath(cwd, taskId),
      `${JSON.stringify(updated, null, 2)}\n`,
      "utf8",
    );
    return updated;
  });
}

export async function listTasks(cwd: string): Promise<TaskInfo[]> {
  const infos = new Map<string, TaskInfo>();

  try {
    const entries = await readdir(getTasksDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      const taskId = entry.replace(/\.json$/, "");
      const info = await readTaskInfo(cwd, taskId);
      if (info) {
        infos.set(taskId, info);
      }
    }
  } catch {
    // ignore missing tasks dir
  }

  return [...infos.values()].sort((left, right) => {
    const statusOrder: Record<string, number> = {
      in_progress: 0,
      todo: 1,
      verify: 2,
      failed: 3,
      done: 4,
    };
    const leftRank = statusOrder[left.status] ?? 5;
    const rightRank = statusOrder[right.status] ?? 5;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftTime = left.updatedAt || left.createdAt || "";
    const rightTime = right.updatedAt || right.createdAt || "";
    return rightTime.localeCompare(leftTime);
  });
}

export async function getUnblockedTasks(cwd: string): Promise<TaskInfo[]> {
  const allTasks = await listTasks(cwd);
  const taskMap = new Map<string, TaskInfo>();

  for (const task of allTasks) {
    taskMap.set(task.id, task);
  }

  return allTasks
    .filter((task) => {
      if (task.status !== "todo") return false;
      if (task.skipped) return false;

      // Check dependencies
      if (task.dependsOn && task.dependsOn.length > 0) {
        // Special logic for OR condition: if any dependency is done/failed/skipped, we can proceed
        // But also need to make sure NO dependencies are still in progress/checkpoint waiting
        let anyDepComplete = false;
        let hasBlockingDep = false;

        for (const depId of task.dependsOn) {
          const depTask = taskMap.get(depId);
          if (!depTask) continue;

          // Check if dep is complete
          if (depTask.status === "done" || depTask.status === "failed" || depTask.skipped) {
            anyDepComplete = true;
          }

          // Check if dep is blocking
          if (depTask.status === "paused" || 
              !(depTask.status === "done" || depTask.status === "failed" || depTask.skipped)) {
            hasBlockingDep = true;
          }
        }

        if (hasBlockingDep) {
          return false;
        }

        if (!anyDepComplete) {
          return false;
        }
      }

      // Check condition if exists
      if (task.condition) {
        const conditionMet = evaluateCondition(task.condition, allTasks);
        if (!conditionMet) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    });
}

export async function updateAcceptanceCriterion(
  cwd: string,
  taskId: string,
  criterionId: string,
  updates: { status: "passed" | "failed"; evidence?: string },
  actor?: string,
): Promise<TaskInfo | null> {
  return withTaskLock(taskId, async () => {
    const task = await readTaskInfo(cwd, taskId);
    if (!task || !task.acceptanceCriteria) return null;

    const criterion = task.acceptanceCriteria.find((c) => c.id === criterionId);
    const criteria = task.acceptanceCriteria.map((c) =>
      c.id === criterionId ? { ...c, ...updates } : c
    );

    const now = new Date().toISOString();
    const activities = [...task.activities, {
      id: `activity-${Date.now()}-${task.activities.length}`,
      action: "updated" as const,
      actor,
      details: `Criterion "${criterion?.text || criterionId}" marked as ${updates.status}${updates.evidence ? `: ${updates.evidence}` : ''}`,
      timestamp: now,
    }];

    const updated: TaskInfo = {
      ...task,
      acceptanceCriteria: criteria,
      activities,
      updatedAt: now,
    };

    await mkdir(getTasksDir(cwd), { recursive: true });
    await writeFile(
      getTaskInfoPath(cwd, taskId),
      `${JSON.stringify(updated, null, 2)}\n`,
      "utf8",
    );
    return updated;
  });
}

export function allCriteriaPassed(task: TaskInfo): boolean {
  if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0) return true;
  return task.acceptanceCriteria.every((c) => c.status === "passed");
}
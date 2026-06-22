import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { createTask } from "./taskIndex";
import { createId } from "../shared/ids";

export type PlanTaskDraft = {
  tempId: string;  // local reference within plan
  title: string;
  description?: string;
  agent?: string;
  priority?: "low" | "medium" | "high";
  dependsOnTempIds?: string[];  // references to other tempIds
  resolvedDependsOn?: string[];  // actual task IDs after confirmation
};

export type Plan = {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "confirmed" | "executing" | "completed" | "cancelled";
  tasks: PlanTaskDraft[];
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  createdBy?: string;
};

function getPlansDir(cwd: string): string {
  return join(cwd, ".irg", "plans");
}

function getPlanPath(cwd: string, planId: string): string {
  return join(getPlansDir(cwd), `${planId}.json`);
}

export async function readPlan(
  cwd: string,
  planId: string,
): Promise<Plan | null> {
  try {
    const content = await readFile(getPlanPath(cwd, planId), "utf8");
    return JSON.parse(content) as Plan;
  } catch {
    return null;
  }
}

export async function createPlan(
  cwd: string,
  plan: Omit<Plan, "createdAt" | "updatedAt">,
): Promise<Plan> {
  const now = new Date().toISOString();
  const newPlan: Plan = {
    ...plan,
    createdAt: now,
    updatedAt: now,
  };

  await mkdir(getPlansDir(cwd), { recursive: true });
  await writeFile(
    getPlanPath(cwd, plan.id),
    `${JSON.stringify(newPlan, null, 2)}\n`,
    "utf8",
  );
  return newPlan;
}

export async function updatePlan(
  cwd: string,
  planId: string,
  updates: Partial<Omit<Plan, "id" | "createdAt">>,
): Promise<Plan | null> {
  const previous = await readPlan(cwd, planId);
  if (!previous) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: Plan = {
    ...previous,
    ...updates,
    updatedAt: now,
  };

  await mkdir(getPlansDir(cwd), { recursive: true });
  await writeFile(
    getPlanPath(cwd, planId),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return updated;
}

export async function deletePlan(
  cwd: string,
  planId: string,
): Promise<void> {
  await rm(getPlanPath(cwd, planId), { force: true });
}

export async function listPlans(cwd: string): Promise<Plan[]> {
  const plans: Plan[] = [];

  try {
    const entries = await readdir(getPlansDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      const planId = entry.replace(/\.json$/, "");
      const plan = await readPlan(cwd, planId);
      if (plan) {
        plans.push(plan);
      }
    }
  } catch {
    // ignore missing plans dir
  }

  return plans.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function confirmPlan(
  cwd: string,
  planId: string,
): Promise<{ plan: Plan; tasks: Array<{ id: string; title: string }> } | null> {
  const plan = await readPlan(cwd, planId);
  if (!plan) {
    return null;
  }

  if (plan.status !== "draft") {
    throw new Error(`Plan ${planId} is not in draft status (current: ${plan.status})`);
  }

  if (plan.tasks.length === 0) {
    throw new Error(`Plan ${planId} has no tasks to confirm`);
  }

  // Phase 1: Create all tasks without dependencies
  const tempIdToTaskId = new Map<string, string>();
  const createdTaskIds: string[] = [];

  for (const draft of plan.tasks) {
    const taskId = createId("task");
    tempIdToTaskId.set(draft.tempId, taskId);

    await createTask(cwd, {
      id: taskId,
      title: draft.title,
      description: draft.description,
      priority: draft.priority || "medium",
      status: "todo",
      assignee: draft.agent,
      createdBy: plan.createdBy,
    });

    createdTaskIds.push(taskId);
  }

  // Phase 2: Resolve dependencies and update tasks with actual dependsOn IDs
  const updatedDrafts: PlanTaskDraft[] = plan.tasks.map((draft, index) => {
    const resolvedDependsOn: string[] = [];
    if (draft.dependsOnTempIds && draft.dependsOnTempIds.length > 0) {
      for (const tempId of draft.dependsOnTempIds) {
        const resolvedId = tempIdToTaskId.get(tempId);
        if (resolvedId) {
          resolvedDependsOn.push(resolvedId);
        }
      }
    }
    return {
      ...draft,
      resolvedDependsOn: resolvedDependsOn.length > 0 ? resolvedDependsOn : undefined,
    };
  });

  // Phase 3: Update tasks with resolved dependencies
  const { updateTaskInfo } = await import("./taskIndex");
  for (let i = 0; i < updatedDrafts.length; i++) {
    const draft = updatedDrafts[i];
    if (draft.resolvedDependsOn && draft.resolvedDependsOn.length > 0) {
      await updateTaskInfo(cwd, createdTaskIds[i]!, { dependsOn: draft.resolvedDependsOn });
    }
  }

  // Phase 4: Update plan status
  const now = new Date().toISOString();
  const confirmedPlan: Plan = {
    ...plan,
    status: "confirmed",
    tasks: updatedDrafts,
    confirmedAt: now,
    updatedAt: now,
  };

  await mkdir(getPlansDir(cwd), { recursive: true });
  await writeFile(
    getPlanPath(cwd, planId),
    `${JSON.stringify(confirmedPlan, null, 2)}\n`,
    "utf8",
  );

  return {
    plan: confirmedPlan,
    tasks: updatedDrafts.map((draft, i) => ({
      id: createdTaskIds[i]!,
      title: draft.title,
    })),
  };
}

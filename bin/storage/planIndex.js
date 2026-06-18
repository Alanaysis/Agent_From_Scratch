import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { createTask } from "./taskIndex";
import { createId } from "../shared/ids";
function getPlansDir(cwd) {
    return join(cwd, ".irg", "plans");
}
function getPlanPath(cwd, planId) {
    return join(getPlansDir(cwd), `${planId}.json`);
}
export async function readPlan(cwd, planId) {
    try {
        const content = await readFile(getPlanPath(cwd, planId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function createPlan(cwd, plan) {
    const now = new Date().toISOString();
    const newPlan = {
        ...plan,
        createdAt: now,
        updatedAt: now,
    };
    await mkdir(getPlansDir(cwd), { recursive: true });
    await writeFile(getPlanPath(cwd, plan.id), `${JSON.stringify(newPlan, null, 2)}\n`, "utf8");
    return newPlan;
}
export async function updatePlan(cwd, planId, updates) {
    const previous = await readPlan(cwd, planId);
    if (!previous) {
        return null;
    }
    const now = new Date().toISOString();
    const updated = {
        ...previous,
        ...updates,
        updatedAt: now,
    };
    await mkdir(getPlansDir(cwd), { recursive: true });
    await writeFile(getPlanPath(cwd, planId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    return updated;
}
export async function deletePlan(cwd, planId) {
    await rm(getPlanPath(cwd, planId), { force: true });
}
export async function listPlans(cwd) {
    const plans = [];
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
    }
    catch {
        // ignore missing plans dir
    }
    return plans.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
export async function confirmPlan(cwd, planId) {
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
    const tempIdToTaskId = new Map();
    const createdTaskIds = [];
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
    const updatedDrafts = plan.tasks.map((draft, index) => {
        const resolvedDependsOn = [];
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
            await updateTaskInfo(cwd, createdTaskIds[i], { dependsOn: draft.resolvedDependsOn });
        }
    }
    // Phase 4: Update plan status
    const now = new Date().toISOString();
    const confirmedPlan = {
        ...plan,
        status: "confirmed",
        tasks: updatedDrafts,
        confirmedAt: now,
        updatedAt: now,
    };
    await mkdir(getPlansDir(cwd), { recursive: true });
    await writeFile(getPlanPath(cwd, planId), `${JSON.stringify(confirmedPlan, null, 2)}\n`, "utf8");
    return {
        plan: confirmedPlan,
        tasks: updatedDrafts.map((draft, i) => ({
            id: createdTaskIds[i],
            title: draft.title,
        })),
    };
}

import { ipcMain } from "electron";
import { cwd } from "process";
import {
  listPlans,
  readPlan,
  createPlan,
  updatePlan,
  deletePlan,
  confirmPlan,
} from "../../../storage/planIndex";
import type { Plan, PlanTaskDraft } from "../../../storage/planIndex";
import { createId } from "../../../shared/ids";
import { log } from "../logger";

interface PlanCreateInput {
  title: string;
  description?: string;
  recipeId?: string;
  tasks: PlanTaskDraft[];
  createdBy?: string;
}

interface PlanUpdateInput {
  planId: string;
  updates: {
    title?: string;
    description?: string;
    recipeId?: string;
    tasks?: PlanTaskDraft[];
    status?: "draft" | "confirmed" | "executing" | "completed" | "cancelled";
  };
}

export function registerPlanHandlers() {
  log("INFO", "Plans", "Registering plan handlers");

  ipcMain.handle("plans:list", async (): Promise<{ plans: Plan[] }> => {
    log("INFO", "Plans", "plans:list called");
    try {
      const plans = await listPlans(cwd());
      log("INFO", "Plans", `plans:list returned ${plans.length} plans`);
      return { plans };
    } catch (e) {
      log("ERROR", "Plans", "plans:list failed", e);
      throw e;
    }
  });

  ipcMain.handle("plans:get", async (_event, planId: string): Promise<{ plan: Plan | null }> => {
    log("INFO", "Plans", `plans:get called for ${planId}`);
    try {
      const plan = await readPlan(cwd(), planId);
      log("INFO", "Plans", `plans:get ${planId} returned ${plan ? "found" : "not found"}`);
      return { plan };
    } catch (e) {
      log("ERROR", "Plans", `plans:get ${planId} failed`, e);
      throw e;
    }
  });

  ipcMain.handle("plans:create", async (_event, input: PlanCreateInput): Promise<{ plan: Plan }> => {
    log("INFO", "Plans", `plans:create called: ${input.title}`);
    try {
      const plan = await createPlan(cwd(), {
        id: createId("plan"),
        title: input.title,
        description: input.description,
        recipeId: input.recipeId,
        status: "draft",
        tasks: input.tasks,
        createdBy: input.createdBy,
      });
      log("INFO", "Plans", `plans:create created ${plan.id}`);
      return { plan };
    } catch (e) {
      log("ERROR", "Plans", "plans:create failed", e);
      throw e;
    }
  });

  ipcMain.handle("plans:update", async (_event, input: PlanUpdateInput): Promise<{ plan: Plan | null }> => {
    log("INFO", "Plans", `plans:update called for ${input.planId}`);
    try {
      const plan = await updatePlan(cwd(), input.planId, input.updates);
      log("INFO", "Plans", `plans:update ${input.planId} ${plan ? "success" : "not found"}`);
      return { plan };
    } catch (e) {
      log("ERROR", "Plans", `plans:update ${input.planId} failed`, e);
      throw e;
    }
  });

  ipcMain.handle("plans:delete", async (_event, input: { planId: string }): Promise<void> => {
    log("INFO", "Plans", `plans:delete called for ${input.planId}`);
    try {
      await deletePlan(cwd(), input.planId);
      log("INFO", "Plans", `plans:delete ${input.planId} completed`);
    } catch (e) {
      log("ERROR", "Plans", `plans:delete ${input.planId} failed`, e);
      throw e;
    }
  });

  ipcMain.handle(
    "plans:confirm",
    async (
      _event,
      input: { planId: string },
    ): Promise<{ plan: Plan; tasks: Array<{ id: string; title: string }> } | null> => {
      log("INFO", "Plans", `plans:confirm called for ${input.planId}`);
      try {
        const result = await confirmPlan(cwd(), input.planId);
        if (result) {
          log("INFO", "Plans", `plans:confirm ${input.planId} created ${result.tasks.length} tasks`);
        } else {
          log("INFO", "Plans", `plans:confirm ${input.planId} plan not found`);
        }
        return result;
      } catch (e) {
        log("ERROR", "Plans", `plans:confirm ${input.planId} failed`, e);
        throw e;
      }
    },
  );
}

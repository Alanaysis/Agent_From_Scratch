import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { listTasks, readTaskInfo } from "../../storage/taskIndex";
import { eventBus } from "../../shared/eventBus";

export type TaskControlInput = {
  action: "list" | "retry" | "skip" | "continue" | "resume" | "start-executor" | "stop-executor" | "set-status";
  taskId?: string;
  status?: string;
  reason?: string;
};

export type TaskControlOutput = {
  ok: boolean;
  action: string;
  message: string;
  tasks?: any[];
};

export const TaskControlTool: Tool<TaskControlInput, TaskControlOutput> = {
  name: "TaskControl",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Control workflow tasks and executor: list tasks, retry/skip/continue/resume tasks, start/stop executor, or set task status";
  },
  async call(
    args: TaskControlInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<TaskControlOutput>> {
    const { action } = args;

    if (action === "list") {
      const allTasks = await listTasks(context.cwd);
      return {
        data: {
          ok: true,
          action: "list",
          message: `Found ${allTasks.length} task(s)`,
          tasks: allTasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assignee: t.assignee,
            sessionId: t.sessionId,
            lastError: t.lastError ? t.lastError.slice(0, 200) : undefined,
            checkpointAfter: t.checkpointAfter,
            requiresApproval: t.requiresApproval,
          })),
        },
      };
    }

    if (action === "start-executor") {
      eventBus.emit("executor:command", { action: "start" });
      return {
        data: { ok: true, action: "start-executor", message: "Executor started — pending tasks will be picked up automatically" },
      };
    }

    if (action === "stop-executor") {
      eventBus.emit("executor:command", { action: "stop" });
      return {
        data: { ok: true, action: "stop-executor", message: "Executor stopped — running tasks paused" },
      };
    }

    if (!args.taskId) {
      throw new Error("taskId is required for this action");
    }

    const task = await readTaskInfo(context.cwd, args.taskId);
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`);
    }

    if (action === "retry") {
      eventBus.emit("executor:command", { action: "retry-task", taskId: args.taskId });
      return {
        data: { ok: true, action: "retry", message: `Task "${task.title}" queued for retry — status reset to todo` },
      };
    }

    if (action === "skip") {
      eventBus.emit("executor:command", { action: "skip-task", taskId: args.taskId, reason: args.reason });
      return {
        data: { ok: true, action: "skip", message: `Task "${task.title}" skipped — downstream tasks will be triggered` },
      };
    }

    if (action === "continue") {
      eventBus.emit("executor:command", { action: "continue-task", taskId: args.taskId });
      return {
        data: { ok: true, action: "continue", message: `Continuing past failed task "${task.title}" — downstream tasks will be triggered` },
      };
    }

    if (action === "resume") {
      eventBus.emit("executor:command", { action: "resume-task", taskId: args.taskId });
      return {
        data: { ok: true, action: "resume", message: `Task "${task.title}" resumed from paused state` },
      };
    }

    if (action === "set-status") {
      if (!args.status) {
        throw new Error("status is required for set-status action");
      }
      eventBus.emit("executor:command", { action: "set-status", taskId: args.taskId, status: args.status, reason: args.reason });
      return {
        data: { ok: true, action: "set-status", message: `Task "${task.title}" status set to ${args.status}` },
      };
    }

    throw new Error(`Unknown action: ${action}`);
  },
  async validateInput(input) {
    const validActions = ["list", "retry", "skip", "continue", "resume", "start-executor", "stop-executor", "set-status"];
    if (!input?.action || !validActions.includes(input.action)) {
      return { result: false, message: `action must be one of: ${validActions.join(", ")}` };
    }
    return { result: true };
  },
  async checkPermissions(_input, _context) {
    return { behavior: "allow", updatedInput: _input };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return true;
  },
};

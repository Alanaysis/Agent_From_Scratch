import { ipcMain } from "electron";
import { cwd } from "process";
import { listTasks, readTaskInfo, createTask, updateTaskInfo, deleteTaskInfo, getUnblockedTasks, addTaskComment } from "../../../storage/taskIndex";
import type { TaskInfo } from "../../../storage/taskIndex";
import { createId } from "../../../shared/ids";
import { log } from "../logger";
import { getExecutor, startExecutor, forceExecuteTask } from "../../../runtime/executor/ExecutorAgent";
import { canUseTool } from "../../../permissions/engine";
import { createSubagentContext } from "../../../tools/agent/subagentContext";
import { createInitialAppState } from "../../../runtime/state";
import { initLlmConfig } from "../../../runtime/llm";

interface TaskCreateInput {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  assignee?: string;
  dependsOn?: string[];
  createdBy?: string;
}

interface TaskUpdateInput {
  taskId: string;
  title?: string;
  description?: string;
  status?: "todo" | "in_progress" | "verify" | "done" | "failed";
  priority?: "low" | "medium" | "high";
  assignee?: string;
  dependsOn?: string[];
  errorCount?: number;
  lastError?: string;
  actor?: string;
}

interface TaskListResult {
  tasks: TaskInfo[];
}

interface TaskGetResult {
  task: TaskInfo | null;
}

export function registerTaskHandlers() {
  log('INFO', 'Tasks', 'Registering task handlers')

  ipcMain.handle("tasks:list", async (): Promise<TaskListResult> => {
    log('INFO', 'Tasks', 'tasks:list called')
    try {
      const tasks = await listTasks(cwd());
      log('INFO', 'Tasks', `tasks:list returned ${tasks.length} tasks`)
      return { tasks };
    } catch (e) {
      log('ERROR', 'Tasks', 'tasks:list failed', e)
      throw e
    }
  });

  ipcMain.handle("tasks:get", async (_event, taskId: string): Promise<TaskGetResult> => {
    log('INFO', 'Tasks', `tasks:get called for ${taskId}`)
    try {
      const task = await readTaskInfo(cwd(), taskId);
      log('INFO', 'Tasks', `tasks:get ${taskId} returned ${task ? 'found' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:get ${taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:create", async (_event, input: TaskCreateInput): Promise<{ task: TaskInfo }> => {
    log('INFO', 'Tasks', `tasks:create called: ${input.title}`)
    try {
      const task = await createTask(cwd(), {
        id: createId("task"),
        title: input.title,
        description: input.description,
        priority: input.priority || "medium",
        status: "todo",
        assignee: input.assignee,
        dependsOn: input.dependsOn,
        createdBy: input.createdBy,
      });
      log('INFO', 'Tasks', `tasks:create created ${task.id}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', 'tasks:create failed', e)
      throw e
    }
  });

  ipcMain.handle("tasks:update", async (_event, input: TaskUpdateInput): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:update called for ${input.taskId}`)
    try {
      const task = await updateTaskInfo(cwd(), input.taskId, {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assignee: input.assignee,
        dependsOn: input.dependsOn,
        errorCount: input.errorCount,
        lastError: input.lastError,
      }, input.actor);
      log('INFO', 'Tasks', `tasks:update ${input.taskId} ${task ? 'success' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:update ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:delete", async (_event, input: { taskId: string }): Promise<void> => {
    log('INFO', 'Tasks', `tasks:delete called for ${input.taskId}`)
    try {
      await deleteTaskInfo(cwd(), input.taskId);
      log('INFO', 'Tasks', `tasks:delete ${input.taskId} completed`)
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:delete ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:get_unblocked", async (): Promise<TaskListResult> => {
    log('INFO', 'Tasks', 'tasks:get_unblocked called')
    try {
      const tasks = await getUnblockedTasks(cwd());
      log('INFO', 'Tasks', `tasks:get_unblocked returned ${tasks.length} tasks`)
      return { tasks };
    } catch (e) {
      log('ERROR', 'Tasks', 'tasks:get_unblocked failed', e)
      throw e
    }
  });

  ipcMain.handle("tasks:claim", async (_event, input: { taskId: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:claim called for ${input.taskId}`)
    try {
      const task = await updateTaskInfo(cwd(), input.taskId, { status: "in_progress" }, input.actor);
      log('INFO', 'Tasks', `tasks:claim ${input.taskId} ${task ? 'success' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:claim ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:submit_verify", async (_event, input: { taskId: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:submit_verify called for ${input.taskId}`)
    try {
      const task = await updateTaskInfo(cwd(), input.taskId, { status: "verify" }, input.actor);
      log('INFO', 'Tasks', `tasks:submit_verify ${input.taskId} ${task ? 'success' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:submit_verify ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:complete", async (_event, input: { taskId: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:complete called for ${input.taskId}`)
    try {
      const task = await updateTaskInfo(cwd(), input.taskId, { status: "done" }, input.actor);
      log('INFO', 'Tasks', `tasks:complete ${input.taskId} ${task ? 'success' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:complete ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:fail", async (_event, input: { taskId: string; error?: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:fail called for ${input.taskId}`)
    try {
      const task = await updateTaskInfo(cwd(), input.taskId, {
        status: "failed",
        lastError: input.error,
      }, input.actor);
      log('INFO', 'Tasks', `tasks:fail ${input.taskId} ${task ? 'success' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:fail ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:assign", async (_event, input: { taskId: string; assignee: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:assign ${input.taskId} to ${input.assignee}`)
    try {
      const task = await updateTaskInfo(cwd(), input.taskId, { assignee: input.assignee }, input.actor);
      log('INFO', 'Tasks', `tasks:assign ${input.taskId} ${task ? 'success' : 'not found'}`)

      if (input.assignee && task) {
        log('INFO', 'Tasks', `tasks:assign triggering executor for ${input.taskId}`)
        await initLlmConfig()
        let executor = getExecutor()
        if (!executor || !executor.isRunning()) {
          const emptyState = createInitialAppState()
          const mockContext = createSubagentContext({
            cwd: cwd(),
            messages: [],
            agentId: input.assignee,
            agentType: input.assignee,
            abortController: new AbortController(),
            setAppState: () => {},
            getAppState: () => emptyState,
          }, { agentType: input.assignee })
          executor = startExecutor(mockContext as any, {})
        }
        setTimeout(() => {
          if (task.status === 'todo') {
            forceExecuteTask(input.taskId)
          }
        }, 100)
      }

      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:assign ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:release", async (_event, input: { taskId: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:release called for ${input.taskId}`)
    try {
      const task = await updateTaskInfo(cwd(), input.taskId, { assignee: undefined }, input.actor);
      log('INFO', 'Tasks', `tasks:release ${input.taskId} ${task ? 'success' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:release ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:add_comment", async (_event, input: { taskId: string; comment: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:add_comment for ${input.taskId}`)
    try {
      const task = await addTaskComment(cwd(), input.taskId, input.comment, input.actor);
      log('INFO', 'Tasks', `tasks:add_comment ${input.taskId} ${task ? 'success' : 'not found'}`)
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:add_comment ${input.taskId} failed`, e)
      throw e
    }
  });
}
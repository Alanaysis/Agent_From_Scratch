import { ipcMain } from "electron";
import { cwd } from "process";
import { listTasks, readTaskInfo, createTask, updateTaskInfo, deleteTaskInfo, getUnblockedTasks, addTaskComment } from "../../../storage/taskIndex";
import type { TaskInfo } from "../../../storage/taskIndex";
import { createId } from "../../../shared/ids";
import { log } from "../logger";
import { getExecutor, startExecutor, forceExecuteTask, stopExecutor } from "../../../runtime/executor/ExecutorAgent";
import { canUseTool } from "../../../permissions/engine";
import { createSubagentContext } from "../../../tools/agent/subagentContext";
import { createInitialAppState } from "../../../runtime/state";
import { initLlmConfig } from "../../../runtime/llm";
import { eventBus } from "../../../shared/eventBus";

interface TaskCreateInput {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  assignee?: string;
  dependsOn?: string[];
  createdBy?: string;
}

interface BatchTaskInput {
  tasks: Array<{
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    assignee?: string;
    dependsOnBatchIndex?: number[];
  }>;
  createdBy?: string;
}

interface TaskUpdateInput {
  taskId: string;
  title?: string;
  description?: string;
  status?: "todo" | "in_progress" | "verify" | "done" | "failed" | "skipped";
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
      // Set assignee and move to in_progress immediately so UI updates right away
      const task = await updateTaskInfo(cwd(), input.taskId, { assignee: input.assignee, status: "in_progress" }, input.actor);
      log('INFO', 'Tasks', `tasks:assign ${input.taskId} ${task ? 'success' : 'not found'}, title="${task?.title}"`)

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
          executor = await startExecutor(mockContext as any, { agentType: input.assignee })

          // Forward executor events to eventBus so IPC push can send them to frontend
          executor.on('taskClaimed', (taskId: string, title: string) => {
            eventBus.emit('executor:task-claimed', { taskId, title })
          })
          executor.on('taskProgress', (taskId: string, text: string) => {
            eventBus.emit('executor:task-progress', { taskId, text })
          })
          executor.on('taskCompleted', (taskId: string, success: boolean, result?: string) => {
            eventBus.emit('executor:task-completed', { taskId, success, result })
          })
          executor.on('cycle', (pendingCount: number) => {
            eventBus.emit('executor:cycle', { pendingCount })
          })
        }
        // Wait for executor to be ready, then force execute
        setTimeout(async () => {
          try {
            log('INFO', 'Tasks', `tasks:assign force executing task ${input.taskId}`)
            await forceExecuteTask(input.taskId)
          } catch (e) {
            log('ERROR', 'Tasks', `tasks:assign force execute failed for ${input.taskId}`, e)
          }
        }, 500)
      }

      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:assign ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:abort", async (_event, input: { taskId: string }): Promise<{ aborted: boolean }> => {
    log('INFO', 'Tasks', `tasks:abort called for ${input.taskId}`)
    try {
      const executor = getExecutor()
      if (executor) {
        const aborted = executor.abortTask(input.taskId)
        if (aborted) {
          await updateTaskInfo(cwd(), input.taskId, { status: "failed", lastError: "Aborted by user" }, "user")
        }
        log('INFO', 'Tasks', `tasks:abort ${input.taskId} ${aborted ? 'aborted' : 'not found'}`)
        return { aborted }
      }
      return { aborted: false }
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:abort ${input.taskId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:approve", async (_event, input: { taskId: string; action: 'execute' | 'later' | 'abort' }): Promise<{ ok: boolean; action: string }> => {
    log('INFO', 'Tasks', `tasks:approve called for ${input.taskId} action=${input.action}`)
    try {
      if (input.action === 'abort') {
        await updateTaskInfo(cwd(), input.taskId, { status: "failed", lastError: "Aborted by user" }, "user")
        return { ok: true, action: "abort" }
      }
      if (input.action === 'later') {
        return { ok: true, action: "later" }
      }
      // action === 'execute' — trigger execution via forceExecuteTask
      const { forceExecuteTask } = await import("../../../runtime/executor/ExecutorAgent");
      const { initLlmConfig } = await import("../../../runtime/llm");
      await initLlmConfig()
      let executor = getExecutor()
      if (!executor || !executor.isRunning()) {
        const { startExecutor } = await import("../../../runtime/executor/ExecutorAgent");
        const { createSubagentContext } = await import("../../../tools/agent/subagentContext");
        const { createInitialAppState } = await import("../../../runtime/state");
        const emptyState = createInitialAppState()
        const mockContext = createSubagentContext({
          cwd: cwd(), messages: [], agentId: 'general-purpose', agentType: 'general-purpose',
          abortController: new AbortController(), setAppState: () => {}, getAppState: () => emptyState,
        }, { agentType: 'general-purpose' })
        executor = await startExecutor(mockContext as any, {})
      }
      setTimeout(async () => {
        try {
          await forceExecuteTask(input.taskId)
        } catch (e) {
          log('ERROR', 'Tasks', `tasks:approve force execute failed for ${input.taskId}`, e)
        }
      }, 100)
      return { ok: true, action: "execute" }
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:approve ${input.taskId} failed`, e)
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

  ipcMain.handle("tasks:update_criterion", async (_event, input: { taskId: string; criterionId: string; status: 'passed' | 'failed'; evidence?: string; actor?: string }): Promise<{ task: TaskInfo | null }> => {
    log('INFO', 'Tasks', `tasks:update_criterion for ${input.taskId}/${input.criterionId}`)
    try {
      const { updateAcceptanceCriterion } = await import("../../../storage/taskIndex");
      const task = await updateAcceptanceCriterion(cwd(), input.taskId, input.criterionId, {
        status: input.status,
        evidence: input.evidence,
      }, input.actor);
      return { task };
    } catch (e) {
      log('ERROR', 'Tasks', `tasks:update_criterion failed`, e)
      throw e
    }
  });

  ipcMain.handle("tasks:createBatch", async (_event, input: BatchTaskInput): Promise<{ tasks: TaskInfo[] }> => {
    log('INFO', 'Tasks', `tasks:createBatch called with ${input.tasks.length} tasks`)
    try {
      // Phase 1: Create all tasks without dependencies
      const createdTasks: TaskInfo[] = [];
      const batchIndexToTaskId = new Map<number, string>();

      for (let i = 0; i < input.tasks.length; i++) {
        const taskInput = input.tasks[i]!;
        const taskId = createId("task");
        batchIndexToTaskId.set(i, taskId);

        const task = await createTask(cwd(), {
          id: taskId,
          title: taskInput.title,
          description: taskInput.description,
          priority: taskInput.priority || "medium",
          status: "todo",
          assignee: taskInput.assignee,
          createdBy: input.createdBy,
        });

        createdTasks.push(task);
      }

      // Phase 2: Resolve dependencies and update tasks
      for (let i = 0; i < input.tasks.length; i++) {
        const taskInput = input.tasks[i]!;
        if (taskInput.dependsOnBatchIndex && taskInput.dependsOnBatchIndex.length > 0) {
          const resolvedDependsOn: string[] = [];
          for (const depIndex of taskInput.dependsOnBatchIndex) {
            const depTaskId = batchIndexToTaskId.get(depIndex);
            if (depTaskId) {
              resolvedDependsOn.push(depTaskId);
            }
          }

          if (resolvedDependsOn.length > 0) {
            const updated = await updateTaskInfo(cwd(), createdTasks[i]!.id, {
              dependsOn: resolvedDependsOn,
            }, input.createdBy);
            if (updated) {
              createdTasks[i] = updated;
            }
          }
        }
      }

      log('INFO', 'Tasks', `tasks:createBatch created ${createdTasks.length} tasks`)
      return { tasks: createdTasks };
    } catch (e) {
      log('ERROR', 'Tasks', 'tasks:createBatch failed', e)
      throw e
    }
  });
}
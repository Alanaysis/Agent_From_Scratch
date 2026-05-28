import { EventEmitter } from "events"
import { cwd } from "process"
import { listTasks, updateTaskInfo, readTaskInfo } from "../../storage/taskIndex"
import { createSession, updateSessionInfo } from "../../storage/sessionIndex"
import { appendTranscript } from "../../storage/transcript"
import { runAgent } from "../../tools/agent/runAgent"
import { createSubagentContext } from "../../tools/agent/subagentContext"
import { canUseTool } from "../../permissions/engine"
import type { ToolUseContext } from "../../tools/Tool"
import { createId } from "../../shared/ids"
import type { Message } from "../../runtime/messages"
import { eventBus } from "../../shared/eventBus"

export type ExecutorEvents = {
  taskClaimed: (taskId: string, title: string) => void
  taskProgress: (taskId: string, text: string) => void
  taskCompleted: (taskId: string, success: boolean, result?: string) => void
  error: (error: Error) => void
  cycle: (pendingCount: number) => void
}

export type ExecutorConfig = {
  pollIntervalMs: number
  maxConcurrentTasks: number
  agentType: string
  executorName: string
}

const DEFAULT_CONFIG: ExecutorConfig = {
  pollIntervalMs: 5000,
  maxConcurrentTasks: 1,
  agentType: "general-purpose",
  executorName: "executor-agent",
}

export class ExecutorAgent extends EventEmitter {
  private config: ExecutorConfig
  private parentContext: ToolUseContext
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private activeTasks = new Map<string, { abortController: AbortController; startTime: number }>()

  constructor(parentContext: ToolUseContext, config: Partial<ExecutorConfig> = {}) {
    super()
    this.parentContext = parentContext
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async start(): Promise<void> {
    if (this.running) {
      console.log("[Executor] Already running")
      return
    }

    this.running = true
    console.log(`[Executor] Starting with config:`, this.config)
    this.emit("cycle", 0)

    this.intervalId = setInterval(() => {
      this.pollAndExecute().catch((e) => {
        console.error("[Executor] Poll error:", e)
        this.emit("error", e)
      })
    }, this.config.pollIntervalMs)

    await this.pollAndExecute()
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    // Abort all active tasks
    for (const [taskId, info] of this.activeTasks) {
      console.log(`[Executor] Aborting task ${taskId}`)
      info.abortController.abort()
    }
    this.activeTasks.clear()
    this.running = false
    console.log("[Executor] Stopped")
  }

  isRunning(): boolean {
    return this.running
  }

  /** Abort a specific running task */
  abortTask(taskId: string): boolean {
    const info = this.activeTasks.get(taskId)
    if (info) {
      console.log(`[Executor] Aborting task ${taskId}`)
      info.abortController.abort()
      this.activeTasks.delete(taskId)
      return true
    }
    return false
  }

  /** Get list of currently active task IDs */
  getActiveTaskIds(): string[] {
    return [...this.activeTasks.keys()]
  }

  private async pollAndExecute(): Promise<void> {
    if (!this.running) return

    try {
      const tasks = await listTasks(cwd())
      // Only execute tasks that have an assignee and are in todo status
      const todoTasks = tasks.filter((t) => t.status === "todo" && t.assignee && !this.activeTasks.has(t.id))

      this.emit("cycle", todoTasks.length)

      if (todoTasks.length === 0) {
        return
      }

      const task = todoTasks[0]!
      await this.executeTask(task.id)
    } catch (e) {
      console.error("[Executor] Error in poll cycle:", e)
    }
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = await readTaskInfo(cwd(), taskId)
    if (!task) {
      console.log(`[Executor] Task ${taskId} not found`)
      return
    }

    if (task.status !== "todo") {
      console.log(`[Executor] Task ${taskId} is not in todo status (${task.status})`)
      return
    }

    const title = task.title || taskId
    const abortController = new AbortController()
    this.activeTasks.set(taskId, { abortController, startTime: Date.now() })
    this.emit("taskClaimed", taskId, title)
    this.emit("taskProgress", taskId, "Preparing agent...")

    try {
      const sessionId = createId("session")

      console.log(`[Executor] Poll creating session for task ${taskId}, task.title="${task.title}", title="${title}"`)
      await createSession(cwd(), sessionId, {
        taskId,
        title: `Executor: ${title}`,
      })

      const updated = await updateTaskInfo(
        cwd(),
        taskId,
        { status: "in_progress", sessionId },
        this.config.executorName,
      )
      if (!updated) {
        throw new Error("Failed to claim task")
      }

      this.emit("taskProgress", taskId, "Agent running...")

      // Re-read task to get the latest data (title, description may have been updated)
      const freshTask = await readTaskInfo(cwd(), taskId)
      const prompt = this.buildTaskPrompt(freshTask || task)
      let messageCount = 0

      const result = await runAgent({
        description: freshTask?.title || title,
        prompt,
        subagentType: this.config.agentType,
        parentContext: this.parentContext,
        canUseTool,
        maxTurns: 16,
        onProgress: (text) => {
          if (!abortController.signal.aborted) {
            this.emit("taskProgress", taskId, text)
          }
        },
        onMessage: async (msg) => {
          messageCount++
          try {
            await appendTranscript(cwd(), sessionId, [msg])
            eventBus.emit('session:message-appended', { sessionId, message: msg })
          } catch (e) {
            console.error(`[Executor] Failed to write message to transcript:`, e)
          }
        },
      })

      // Check if aborted during execution
      if (abortController.signal.aborted) {
        console.log(`[Executor] Task ${taskId} was aborted during execution`)
        return
      }

      // Update session info with final state
      try {
        const { readTranscriptMessages } = await import("../../storage/transcript")
        const allMessages = await readTranscriptMessages(cwd(), sessionId)
        await updateSessionInfo(cwd(), sessionId, allMessages)
      } catch (e) {
        console.error(`[Executor] Failed to update session info:`, e)
      }

      // Always go through verify so the user can review the work
      const finalStatus = "verify"
      await updateTaskInfo(
        cwd(),
        taskId,
        { status: finalStatus },
        this.config.executorName,
      )

      console.log(`[Executor] Task ${taskId} completed with status: ${finalStatus}`)
      this.emit("taskCompleted", taskId, true, result)
    } catch (error) {
      if (abortController.signal.aborted) {
        console.log(`[Executor] Task ${taskId} was aborted`)
        return
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Executor] Task ${taskId} failed:`, errorMessage)

      // Set task to failed with error details
      await updateTaskInfo(
        cwd(),
        taskId,
        { status: "failed", lastError: errorMessage },
        this.config.executorName,
      )

      this.emit("taskCompleted", taskId, false, errorMessage)
    } finally {
      this.activeTasks.delete(taskId)
    }
  }

  private buildTaskPrompt(task: { title?: string; description?: string; id?: string }): string {
    const title = task.title || task.id || "Untitled Task"
    if (!task.title && task.id) {
      console.warn(`[Executor] Task ${task.id} has no title, using ID as fallback`)
    }
    let prompt = `Task: ${title}\n\n`

    if (task.description) {
      prompt += `Description: ${task.description}\n\n`
    }

    prompt += `Please complete this task. Work in the current directory.`

    return prompt
  }

  async forceExecuteTask(taskId: string): Promise<void> {
    await this.executeTaskNow(taskId)
  }

  private async executeTaskNow(taskId: string): Promise<void> {
    console.log(`[Executor] executeTaskNow called for ${taskId}`)
    const task = await readTaskInfo(cwd(), taskId)
    if (!task) {
      console.log(`[Executor] Task ${taskId} not found`)
      return
    }


    if (task.status !== "todo" && task.status !== "in_progress") {
      console.log(`[Executor] Task ${taskId} is in ${task.status} status, skipping`)
      return
    }

    // Don't re-execute if already running
    if (this.activeTasks.has(taskId)) {
      console.log(`[Executor] Task ${taskId} is already being executed`)
      return
    }

    const title = task.title || taskId
    const abortController = new AbortController()
    this.activeTasks.set(taskId, { abortController, startTime: Date.now() })

    this.emit("taskClaimed", taskId, title)
    this.emit("taskProgress", taskId, "Preparing agent...")

    try {
      const sessionId = task.sessionId || createId("session")
      const isNewSession = !task.sessionId

      if (isNewSession) {
        console.log(`[Executor] Creating session for task ${taskId}, task.title="${task.title}", title="${title}", assignee="${task.assignee}"`)
        await createSession(cwd(), sessionId, {
          taskId,
          title: `${task.assignee || this.config.agentType}: ${title}`,
        })
        // Update task with sessionId
        await updateTaskInfo(
          cwd(),
          taskId,
          { sessionId },
          this.config.executorName,
        )
        console.log(`[Executor] Updated task ${taskId} with sessionId ${sessionId}`)
      }

      if (task.status !== "in_progress") {
        await updateTaskInfo(
          cwd(),
          taskId,
          { status: "in_progress", assignee: task.assignee || this.config.executorName, sessionId },
          this.config.executorName,
        )
      }

      this.emit("taskProgress", taskId, "Agent running...")

      // Re-read task to get the latest data (title, description may have been updated)
      const freshTask = await readTaskInfo(cwd(), taskId)
      const prompt = this.buildTaskPrompt(freshTask || task)
      const agentType = (freshTask || task).assignee || this.config.agentType
      console.log(`[Executor] Running agent for task ${taskId}, agentType=${agentType}, sessionId=${sessionId}, title="${(freshTask || task).title}"`)
      let messageCount = 0

      const result = await runAgent({
        description: title,
        prompt,
        subagentType: agentType,
        parentContext: this.parentContext,
        canUseTool,
        maxTurns: 16,
        onProgress: (text) => {
          if (!abortController.signal.aborted) {
            this.emit("taskProgress", taskId, text)
          }
        },
        onMessage: async (msg) => {
          // Write each message to transcript in real-time (Chorus pattern)
          messageCount++
          console.log(`[Executor] onMessage #${messageCount}, type=${msg.type}`)
          try {
            await appendTranscript(cwd(), sessionId, [msg])
            eventBus.emit('session:message-appended', { sessionId, message: msg })
          } catch (e) {
            console.error(`[Executor] Failed to write message to transcript:`, e)
          }
        },
      })

      console.log(`[Executor] runAgent returned, messageCount=${messageCount}, result length=${result?.length}`)

      // Check if aborted during execution
      if (abortController.signal.aborted) {
        console.log(`[Executor] Task ${taskId} was aborted during execution`)
        return
      }

      // Update session info with final state
      try {
        const { readTranscriptMessages } = await import("../../storage/transcript")
        const allMessages = await readTranscriptMessages(cwd(), sessionId)
        await updateSessionInfo(cwd(), sessionId, allMessages)
      } catch (e) {
        console.error(`[Executor] Failed to update session info:`, e)
      }

      // Always go through verify so the user can review the work
      const finalStatus = "verify"
      await updateTaskInfo(
        cwd(),
        taskId,
        { status: finalStatus },
        this.config.executorName,
      )

      console.log(`[Executor] Task ${taskId} completed with status: ${finalStatus}`)
      this.emit("taskCompleted", taskId, true, result)
    } catch (error) {
      if (abortController.signal.aborted) {
        console.log(`[Executor] Task ${taskId} was aborted`)
        return
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Executor] Task ${taskId} failed:`, errorMessage)

      await updateTaskInfo(
        cwd(),
        taskId,
        { status: "failed", lastError: errorMessage },
        this.config.executorName,
      )

      this.emit("taskCompleted", taskId, false, errorMessage)
    } finally {
      this.activeTasks.delete(taskId)
    }
  }
}

let globalExecutor: ExecutorAgent | null = null

export function getExecutor(): ExecutorAgent | null {
  return globalExecutor
}

export function startExecutor(parentContext: ToolUseContext, config?: Partial<ExecutorConfig>): ExecutorAgent {
  if (globalExecutor && globalExecutor.isRunning()) {
    console.log("[Executor] Already running, returning existing instance")
    return globalExecutor
  }

  globalExecutor = new ExecutorAgent(parentContext, config)
  globalExecutor.start()
  return globalExecutor
}

export function stopExecutor(): void {
  if (globalExecutor) {
    globalExecutor.stop()
    globalExecutor = null
  }
}

export function forceExecuteTask(taskId: string): Promise<void> {
  if (!globalExecutor) {
    console.log("[Executor] No executor running, cannot force execute")
    return Promise.reject(new Error("Executor not running"))
  }
  return globalExecutor.forceExecuteTask(taskId)
}

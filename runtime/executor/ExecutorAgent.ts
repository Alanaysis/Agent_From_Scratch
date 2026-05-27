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
    this.running = false
    console.log("[Executor] Stopped")
  }

  isRunning(): boolean {
    return this.running
  }

  private async pollAndExecute(): Promise<void> {
    if (!this.running) return

    try {
      const tasks = await listTasks(cwd())
      const todoTasks = tasks.filter((t) => t.status === "todo")

      this.emit("cycle", todoTasks.length)

      if (todoTasks.length === 0) {
        return
      }

      const task = todoTasks[0]
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

    console.log(`[Executor] Claiming task: ${task.title}`)
    this.emit("taskClaimed", taskId, task.title)

    try {
      const sessionId = createId("session")

      await createSession(cwd(), sessionId, {
        taskId,
        title: `Executor: ${task.title}`,
      })

      const updated = await updateTaskInfo(
        cwd(),
        taskId,
        { status: "in_progress", assignee: this.config.executorName, sessionId },
        this.config.executorName,
      )
      if (!updated) {
        throw new Error("Failed to claim task")
      }

      const prompt = this.buildTaskPrompt(task)
      const allMessages: Message[] = []

      const result = await runAgent({
        description: task.title,
        prompt,
        subagentType: this.config.agentType,
        parentContext: this.parentContext,
        canUseTool,
        maxTurns: 16,
        onProgress: (text) => {
          this.emit("taskProgress", taskId, text)
        },
        onMessage: (msg) => {
          allMessages.push(msg)
        },
      })

      if (allMessages.length > 0) {
        await appendTranscript(cwd(), sessionId, allMessages)
        await updateSessionInfo(cwd(), sessionId, allMessages)
      }

      const finalStatus = task.dependsOn && task.dependsOn.length > 0 ? "verify" : "done"
      await updateTaskInfo(
        cwd(),
        taskId,
        { status: finalStatus },
        this.config.executorName,
      )

      console.log(`[Executor] Task ${taskId} completed with status: ${finalStatus}`)
      this.emit("taskCompleted", taskId, true, result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Executor] Task ${taskId} failed:`, errorMessage)

      await updateTaskInfo(
        cwd(),
        taskId,
        { status: "failed", lastError: errorMessage },
        this.config.executorName,
      )

      this.emit("taskCompleted", taskId, false, errorMessage)
    }
  }

  private buildTaskPrompt(task: { title: string; description?: string }): string {
    let prompt = `Task: ${task.title}\n\n`

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

    console.log(`[Executor] Force executing task: ${task.title}, status: ${task.status}`)
    this.emit("taskClaimed", taskId, task.title)

    try {
      const sessionId = task.sessionId || createId("session")
      const isNewSession = !task.sessionId

      if (isNewSession) {
        await createSession(cwd(), sessionId, {
          taskId,
          title: `${task.assignee}: ${task.title}`,
        })
      }

      if (task.status !== "in_progress") {
        await updateTaskInfo(
          cwd(),
          taskId,
          { status: "in_progress", assignee: this.config.executorName, sessionId },
          this.config.executorName,
        )
      }

      const prompt = this.buildTaskPrompt(task)
      console.log(`[Executor] Running agent for task ${taskId} with prompt: ${prompt.substring(0, 100)}...`)
      const allMessages: any[] = []

      const agentType = task.assignee || this.config.agentType
      const result = await runAgent({
        description: task.title,
        prompt,
        subagentType: agentType,
        parentContext: this.parentContext,
        canUseTool,
        maxTurns: 16,
        onProgress: (text) => {
          this.emit("taskProgress", taskId, text)
        },
        onMessage: (msg) => {
          allMessages.push(msg)
        },
      })

      if (allMessages.length > 0) {
        await appendTranscript(cwd(), sessionId, allMessages)
        await updateSessionInfo(cwd(), sessionId, allMessages)
      }

      const finalStatus = task.dependsOn && task.dependsOn.length > 0 ? "verify" : "done"
      await updateTaskInfo(
        cwd(),
        taskId,
        { status: finalStatus },
        this.config.executorName,
      )

      console.log(`[Executor] Task ${taskId} completed with status: ${finalStatus}`)
      this.emit("taskCompleted", taskId, true, result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Executor] Task ${taskId} failed:`, errorMessage)

      await updateTaskInfo(
        cwd(),
        taskId,
        { status: "failed", lastError: errorMessage },
        this.config.executorName,
      )

      this.emit("taskCompleted", taskId, false, errorMessage)
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
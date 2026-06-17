import { EventEmitter } from "events"
import { cwd } from "process"
import { listTasks, updateTaskInfo, readTaskInfo, getUnblockedTasks } from "../../storage/taskIndex"
import type { TaskInfo } from "../../storage/taskIndex"
import { createSession, updateSessionInfo } from "../../storage/sessionIndex"
import { appendTranscript, readTranscriptMessages } from "../../storage/transcript"
import { runAgent } from "../../tools/agent/runAgent"
import { createSubagentContext } from "../../tools/agent/subagentContext"
import { canUseTool } from "../../permissions/engine"
import type { ToolUseContext } from "../../tools/Tool"
import { createId } from "../../shared/ids"
import type { Message } from "../../runtime/messages"
import { eventBus } from "../../shared/eventBus"
import { evolveAfterSession, DEFAULT_EVOLUTION_CONFIG } from "../../runtime/evolution"

/** Fetch results from dependency tasks for context injection */
async function getDependencyResults(
  task: TaskInfo,
): Promise<Array<{ title: string; status: string; lastActivity?: string }>> {
  if (!task.dependsOn || task.dependsOn.length === 0) return [];

  const deps = await Promise.all(
    task.dependsOn.map(async (depId) => {
      try {
        const dep = await readTaskInfo(cwd(), depId);
        if (!dep) return null;
        const lastActivity = dep.activities?.length > 0
          ? dep.activities[dep.activities.length - 1]?.details
          : undefined;
        return {
          title: dep.title || depId,
          status: dep.status,
          lastActivity: lastActivity || dep.lastError || undefined,
        };
      } catch {
        return null;
      }
    }),
  );
  return deps.filter((d): d is NonNullable<typeof d> => d !== null);
}

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
  private pendingApprovalTasks = new Set<string>()

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
      // Get tasks whose dependencies are all satisfied
      const unblocked = await getUnblockedTasks(cwd())

      // Separate requiresApproval tasks — emit approval requests, don't auto-execute
      const approvalTasks = unblocked.filter(t =>
        t.requiresApproval && t.assignee && !this.activeTasks.has(t.id) && !this.pendingApprovalTasks.has(t.id)
      )
      for (const task of approvalTasks) {
        this.pendingApprovalTasks.add(task.id)
        const approvalReq = {
          taskId: task.id,
          taskTitle: task.title || task.id,
          approvalMessage: task.approvalMessage,
          stepIndex: 0,
          stepTotal: 1,
        }
        console.log(`[Executor] Requesting approval for: ${task.title}`)
        eventBus.emit("approval:required", approvalReq)
      }

      const executable = unblocked.filter((t) => t.assignee && !t.requiresApproval && !this.activeTasks.has(t.id))

      this.emit("cycle", executable.length)

      if (executable.length === 0) {
        return
      }

      const task = executable[0]!
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
      const taskForPrompt = freshTask || task
      const depResults = await getDependencyResults(taskForPrompt)
      const prompt = await this.buildTaskPrompt(taskForPrompt, depResults)
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
      let allMessages: Message[] = []
      try {
        allMessages = await readTranscriptMessages(cwd(), sessionId)
        await updateSessionInfo(cwd(), sessionId, allMessages)
      } catch (e) {
        console.error(`[Executor] Failed to update session info:`, e)
      }

      // Check for tool-level errors (e.g., gRPC failures)
      const hasToolErrors = allMessages.some(m => m.type === 'tool_result' && m.isError)
      if (hasToolErrors) {
        console.log(`[Executor] Task ${taskId} has tool errors, marking as failed`)
        await updateTaskInfo(
          cwd(),
          taskId,
          { status: "failed", lastError: "Tool execution failed" },
          this.config.executorName,
        )
        this.emit("taskCompleted", taskId, false, "Tool execution failed")
        return
      }

      // Trigger reflection for knowledge extraction (fire-and-forget)
      this.triggerReflection(sessionId, `Executor: ${title}`, allMessages)

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

  private async buildTaskPrompt(
    task: { title?: string; description?: string; id?: string; grpcConfig?: any; dependsOn?: string[] },
    dependencyResults?: Array<{ title: string; status: string; lastActivity?: string }>,
  ): Promise<string> {
    const title = task.title || task.id || "Untitled Task"
    if (!task.title && task.id) {
      console.warn(`[Executor] Task ${task.id} has no title, using ID as fallback`)
    }
    let prompt = `Task: ${title}\n\n`

    if (task.description) {
      prompt += `Description: ${task.description}\n\n`
    }

    // Inject dependency task results for flow-aware context
    if (dependencyResults && dependencyResults.length > 0) {
      prompt += `## Dependency Results (upstream tasks):\n`;
      for (const dep of dependencyResults) {
        prompt += `- **${dep.title}** [${dep.status}]`;
        if (dep.lastActivity) prompt += `: ${dep.lastActivity}`;
        prompt += `\n`;
      }
      prompt += `\nUse these results to inform your work. The outputs above are from tasks yours depends on.\n\n`;
    }

    // Include structured gRPC config if available
    if (task.grpcConfig) {
      prompt += `## gRPC Task\n\n`;
      prompt += `You MUST use the **GrpcClient** tool to execute this gRPC call. Do NOT use Shell or any other tool.\n\n`;
      prompt += `Call the GrpcClient tool with these exact parameters:\n`;
      prompt += `- protoFile: "${task.grpcConfig.protoFile || 'protos/AlgoService.proto'}"\n`;
      prompt += `- service: "${task.grpcConfig.service}"\n`;
      prompt += `- method: "${task.grpcConfig.method}"\n`;
      prompt += `- address: "${task.grpcConfig.address}"\n`;
      prompt += `- payload: ${JSON.stringify(task.grpcConfig.payload, null, 2)}\n`;
      if (task.grpcConfig.metadata) prompt += `- metadata: ${JSON.stringify(task.grpcConfig.metadata)}\n`;
      if (task.grpcConfig.deadline) prompt += `- deadline: ${task.grpcConfig.deadline}\n`;
      prompt += `\nAfter the GrpcClient call completes, report the response. If it fails, use the Checkpoint tool to ask the user.\n`;
    }

    // Inject irg.md project instructions + referenced documents
    try {
      const { getFullInjectionContent } = await import("../../storage/irgMd");
      const irgContent = await getFullInjectionContent(cwd());
      if (irgContent.trim()) {
        prompt += `\n## Project Instructions\n\n${irgContent}\n`;
      }
    } catch {
      // irg.md loading is best-effort
    }

    prompt += `\nPlease complete this task. Work in the current directory.`

    return prompt
  }

  /** Trigger reflection for knowledge extraction (fire-and-forget) */
  private triggerReflection(sessionId: string, title: string, allMessages: Message[]): void {
    if (allMessages.length === 0) return;
    const sessionInfo = {
      id: sessionId,
      title,
      messageCount: allMessages.length,
      toolUseCount: allMessages.filter(m => m.type === "tool_result").length,
      errorCount: allMessages.filter(m => m.type === "tool_result" && m.isError).length,
      status: "completed" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    evolveAfterSession(cwd(), sessionInfo, allMessages, this.parentContext, {
      ...DEFAULT_EVOLUTION_CONFIG,
      reflectionOnComplete: false,
      reflectionOnError: true,
    }).catch(e => console.error("[Executor] Reflection failed:", e));
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

    console.log(`[Executor] readTaskInfo result: title="${task.title}", id="${task.id}"`)

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
      const taskForPrompt = freshTask || task
      const depResults = await getDependencyResults(taskForPrompt)
      const prompt = await this.buildTaskPrompt(taskForPrompt, depResults)
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
      let allMessages: Message[] = []
      try {
        allMessages = await readTranscriptMessages(cwd(), sessionId)
        await updateSessionInfo(cwd(), sessionId, allMessages)
      } catch (e) {
        console.error(`[Executor] Failed to update session info:`, e)
      }

      // Check for tool-level errors (e.g., gRPC failures)
      const hasToolErrors = allMessages.some(m => m.type === 'tool_result' && m.isError)
      if (hasToolErrors) {
        console.log(`[Executor] Task ${taskId} has tool errors, marking as failed`)
        await updateTaskInfo(cwd(), taskId, { status: "failed", lastError: "Tool execution failed" }, this.config.executorName)
        this.emit("taskCompleted", taskId, false, "Tool execution failed")
        return
      }

      // Trigger reflection for knowledge extraction (fire-and-forget)
      this.triggerReflection(sessionId, `${task.assignee || this.config.agentType}: ${title}`, allMessages)

      // Always go to verify first (state machine requires in_progress → verify)
      await updateTaskInfo(cwd(), taskId, { status: "verify" }, this.config.executorName)

      // Auto-approve if no acceptance criteria
      const updatedTask = await readTaskInfo(cwd(), taskId)
      const hasCriteria = updatedTask?.acceptanceCriteria && updatedTask.acceptanceCriteria.length > 0
      if (!hasCriteria) {
        await updateTaskInfo(cwd(), taskId, { status: "done" }, this.config.executorName)
        console.log(`[Executor] Task ${taskId} auto-approved → done`)
      } else {
        console.log(`[Executor] Task ${taskId} → verify, waiting for manual review`)
      }

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

export async function startExecutor(parentContext: ToolUseContext, config?: Partial<ExecutorConfig>): Promise<ExecutorAgent> {
  if (globalExecutor && globalExecutor.isRunning()) {
    console.log("[Executor] Already running, returning existing instance")
    return globalExecutor
  }

  globalExecutor = new ExecutorAgent(parentContext, config)
  await globalExecutor.start()
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

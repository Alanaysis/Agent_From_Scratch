import { ipcMain } from "electron"
import { cwd } from "process"
import { startExecutor, stopExecutor, getExecutor } from "../../../runtime/executor/ExecutorAgent"
import { canUseTool } from "../../../permissions/engine"
import { createSubagentContext } from "../../../tools/agent/subagentContext"
import { log } from "../logger"
import { createInitialAppState } from "../../../runtime/state"

export function registerExecutorHandlers() {
  log('INFO', 'Executor', 'Registering executor handlers')

  ipcMain.handle("executor:start", async (_event, config?: { pollIntervalMs?: number; agentType?: string }): Promise<{ started: boolean; message: string }> => {
    log('INFO', 'Executor', 'executor:start called')
    try {
      const executor = getExecutor()
      if (executor && executor.isRunning()) {
        return { started: true, message: "Executor already running" }
      }

      const emptyState = createInitialAppState()
      const mockContext = createSubagentContext({
        cwd: cwd(),
        messages: [],
        agentId: "executor",
        agentType: "executor",
        abortController: new AbortController(),
        setAppState: () => {},
        getAppState: () => emptyState,
      }, { agentType: "executor" })

      await startExecutor(mockContext as any, config)
      log('INFO', 'Executor', 'executor:start success')
      return { started: true, message: "Executor started" }
    } catch (e) {
      log('ERROR', 'Executor', 'executor:start failed', e)
      throw e
    }
  })

  ipcMain.handle("executor:stop", async (): Promise<{ stopped: boolean; message: string }> => {
    log('INFO', 'Executor', 'executor:stop called')
    try {
      const executor = getExecutor()
      if (!executor || !executor.isRunning()) {
        return { stopped: true, message: "Executor not running" }
      }

      stopExecutor()
      log('INFO', 'Executor', 'executor:stop success')
      return { stopped: true, message: "Executor stopped" }
    } catch (e) {
      log('ERROR', 'Executor', 'executor:stop failed', e)
      throw e
    }
  })

  ipcMain.handle("executor:status", async (): Promise<{ running: boolean; message: string }> => {
    const executor = getExecutor()
    const running = !!(executor && executor.isRunning())
    return {
      running,
      message: running ? "Executor is running" : "Executor is not running",
    }
  })
}
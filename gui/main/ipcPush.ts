import type { BrowserWindow } from 'electron'
import { eventBus } from '../../shared/eventBus'
import { log } from './logger'

let cleanupFns: Array<() => void> = []

function forward(window: BrowserWindow, busEvent: string, ipcChannel: string) {
  const handler = (data: unknown) => {
    if (!window.isDestroyed()) {
      window.webContents.send(ipcChannel, data)
    }
  }
  eventBus.on(busEvent as any, handler)
  cleanupFns.push(() => eventBus.off(busEvent as any, handler))
}

export function initIpcPush(window: BrowserWindow) {
  // Clean up previous listeners if window was recreated
  cleanup()
  log('INFO', 'IpcPush', 'Initializing IPC push bridge')

  // Tool lifecycle
  forward(window, 'tool:start', 'event:tool:start')
  forward(window, 'tool:progress', 'event:tool:progress')
  forward(window, 'tool:result', 'event:tool:result')
  forward(window, 'tool:error', 'event:tool:error')

  // Chat lifecycle
  forward(window, 'chat:text-delta', 'event:chat:text-delta')
  forward(window, 'chat:message', 'event:chat:message')
  forward(window, 'chat:turn-start', 'event:chat:turn-start')
  forward(window, 'chat:turn-end', 'event:chat:turn-end')

  // Session lifecycle
  forward(window, 'session:created', 'event:session:created')
  forward(window, 'session:heartbeat', 'event:session:heartbeat')
  forward(window, 'session:closed', 'event:session:closed')

  // Permission
  forward(window, 'permission:request', 'event:permission:request')
  forward(window, 'permission:response', 'event:permission:response')

  // Executor
  forward(window, 'executor:task-claimed', 'event:executor:task-claimed')
  forward(window, 'executor:task-progress', 'event:executor:task-progress')
  forward(window, 'executor:task-completed', 'event:executor:task-completed')
  forward(window, 'executor:cycle', 'event:executor:cycle')

  // Real-time session messages
  forward(window, 'session:message-appended', 'event:session:message-appended')

  // Approval workflow
  forward(window, 'approval:required', 'event:approval:required')
  forward(window, 'approval:resolved', 'event:approval:resolved')

  log('INFO', 'IpcPush', 'IPC push bridge initialized')
}

export function cleanup() {
  for (const fn of cleanupFns) fn()
  cleanupFns = []
}

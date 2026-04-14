import type { PermissionContext } from '../permissions/types'
import type { Message } from './messages'

export type TaskState = {
  id: string
  title: string
  status: 'queued' | 'running' | 'completed' | 'failed'
}

export type AppState = {
  permissionContext: PermissionContext
  messages: Message[]
  tasks: Record<string, TaskState>
}

export function createInitialAppState(): AppState {
  return {
    permissionContext: {
      mode: 'default',
      allowRules: [],
      denyRules: [],
      askRules: [],
    },
    messages: [],
    tasks: {},
  }
}

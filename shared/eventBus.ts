import { EventEmitter } from 'events'

export interface ToolStartEvent {
  sessionId: string
  toolUseId: string
  toolName: string
  input: unknown
  timestamp: number
}

export interface ToolProgressEvent {
  sessionId: string
  toolUseId: string
  toolName: string
  progress: unknown
  timestamp: number
}

export interface ToolResultEvent {
  sessionId: string
  toolUseId: string
  toolName: string
  durationMs: number
  isError: boolean
  result?: string
  timestamp: number
}

export interface ToolErrorEvent {
  sessionId: string
  toolUseId: string
  toolName: string
  error: string
  durationMs: number
  timestamp: number
}

export interface ChatTextDeltaEvent {
  sessionId: string
  text: string
}

export interface ChatMessageEvent {
  sessionId: string
  message: unknown
}

export interface SessionLifecycleEvent {
  sessionId: string
  timestamp?: number
}

export interface PermissionRequestEvent {
  sessionId: string
  toolName: string
  input: unknown
  message: string
}

export interface PermissionResponseEvent {
  sessionId: string
  approved: boolean
}

export interface ExecutorTaskEvent {
  taskId: string
  title?: string
  text?: string
  success?: boolean
  result?: string
}

export interface ExecutorCycleEvent {
  pendingCount: number
}

export interface SessionMessageEvent {
  sessionId: string
  message: unknown
}

export interface ApprovalRequestEvent {
  taskId: string
  taskTitle: string
  approvalMessage?: string
  stepIndex: number
  stepTotal: number
  proposalTitle?: string
}

export interface ApprovalResponseEvent {
  taskId: string
  action: 'execute' | 'later' | 'abort'
}

export interface EventBusEvents {
  // Tool lifecycle
  'tool:start': ToolStartEvent
  'tool:progress': ToolProgressEvent
  'tool:result': ToolResultEvent
  'tool:error': ToolErrorEvent

  // Chat lifecycle
  'chat:text-delta': ChatTextDeltaEvent
  'chat:message': ChatMessageEvent
  'chat:turn-start': SessionLifecycleEvent
  'chat:turn-end': SessionLifecycleEvent

  // Session lifecycle
  'session:created': SessionLifecycleEvent
  'session:heartbeat': SessionLifecycleEvent
  'session:closed': SessionLifecycleEvent

  // Permission
  'permission:request': PermissionRequestEvent
  'permission:response': PermissionResponseEvent

  // Executor
  'executor:task-claimed': ExecutorTaskEvent
  'executor:task-progress': ExecutorTaskEvent
  'executor:task-completed': ExecutorTaskEvent
  'executor:cycle': ExecutorCycleEvent

  // Real-time session messages
  'session:message-appended': SessionMessageEvent

  // Approval workflow
  'approval:required': ApprovalRequestEvent
  'approval:resolved': ApprovalResponseEvent
}

class TypedEventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(0)
  }

  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): boolean {
    return super.emit(event as string, data)
  }

  on<K extends keyof EventBusEvents>(event: K, listener: (data: EventBusEvents[K]) => void): this {
    return super.on(event as string, listener)
  }

  off<K extends keyof EventBusEvents>(event: K, listener: (data: EventBusEvents[K]) => void): this {
    return super.off(event as string, listener)
  }

  once<K extends keyof EventBusEvents>(event: K, listener: (data: EventBusEvents[K]) => void): this {
    return super.once(event as string, listener)
  }
}

export const eventBus = new TypedEventBus()

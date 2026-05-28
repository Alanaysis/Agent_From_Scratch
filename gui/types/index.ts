export type MessageRole = 'user' | 'assistant' | 'system' | 'tool_result' | 'tool_error'

export interface ToolCallEvent {
  toolUseId: string
  toolName: string
  input: unknown
  status: 'pending' | 'running' | 'completed' | 'failed' | 'denied'
  startTime: number
  endTime?: number
  durationMs?: number
  progress?: unknown[]
  result?: string
  error?: string
}

export type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolUseId: string; toolName: string; input: unknown; status: ToolCallEvent['status']; durationMs?: number }
  | { type: 'tool_result'; toolUseId: string; content: string; isError: boolean }

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  toolName?: string
  toolUseId?: string
  blocks?: MessageBlock[]
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  status: 'active' | 'paused' | 'completed' | 'failed'
  lastPrompt?: string
  provider?: string
  model?: string
  parentId?: string
  taskId?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'verify' | 'done' | 'failed'
  priority: 'low' | 'medium' | 'high'
  assignee?: string
  dependsOn?: string[]
  createdAt: number
  updatedAt: number
  errorCount?: number
  lastError?: string
  sessionId?: string
}

export interface TaskActivity {
  id: string
  action: 'created' | 'assigned' | 'released' | 'status_changed' | 'updated' | 'comment_added'
  actor?: string
  details?: string
  timestamp: number
}

export interface TaskDetail extends Task {
  activities: TaskActivity[]
  statusHistory: Array<{ status: string; timestamp: number; actor?: string }>
  sessionId?: string
}

export interface AgentPresence {
  agentId: string
  agentName: string
  status: 'idle' | 'thinking' | 'running' | 'waiting' | 'error'
  currentTask?: string
  lastSeen: number
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  read: boolean
}

export interface PermissionRequest {
  id: string
  toolName: string
  input: unknown
  message: string
  resolve: (approved: boolean) => void
}

export interface Agent {
  id: string
  name: string
  description: string
  systemPrompt: string[]
  allowedTools: string[] | '*'
  maxTurns?: number
  isReadOnly?: boolean
  isBuiltIn?: boolean
  capabilities?: string[]  // e.g. ["frontend", "backend", "testing", "devops", "documentation", "planning", "orchestration"]
  permission?: {
    allowed?: string[]
    denied?: string[]
  }
}

export type ViewMode = 'chat' | 'kanban' | 'sessions' | 'settings'

export interface AppState {
  viewMode: ViewMode
  sidebarCollapsed: boolean
  currentSession: Session | null
  sessions: Session[]
  messages: Message[]
  isLoading: boolean
  tasks: Task[]
  agentPresences: AgentPresence[]
  notifications: Notification[]
  backendConnected: boolean
}
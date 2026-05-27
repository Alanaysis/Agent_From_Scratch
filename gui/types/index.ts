export type MessageRole = 'user' | 'assistant' | 'system' | 'tool_result' | 'tool_error'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  toolName?: string
  toolUseId?: string
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
  status: 'idle' | 'thinking' | 'running' | 'waiting'
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
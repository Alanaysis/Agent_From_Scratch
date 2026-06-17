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
  | { type: 'image'; data: string; mimeType: string }
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
  proposalId?: string
  createdAt: number
  updatedAt: number
  errorCount?: number
  lastError?: string
  sessionId?: string
  acceptanceCriteria?: AcceptanceCriterion[]
  relatedDocumentIds?: string[]
  requiresApproval?: boolean
  approvalMessage?: string
  checkpointAfter?: boolean
  checkpointMessage?: string
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
  requestType?: 'permission' | 'approval' | 'error_choice' | 'data_input'
  options?: string[]
  schema?: Array<{ name: string; label: string; type: string; options?: string[]; required?: boolean; default?: unknown }>
  resolve: (response: PermissionResponse) => void
}

export interface PermissionResponse {
  approved: boolean
  choice?: string
  data?: Record<string, unknown>
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

export type ViewMode = 'chat' | 'kanban' | 'proposals' | 'proposal-editor' | 'documents' | 'sessions' | 'settings'

export interface TaskDraft {
  tempId: string
  title: string
  description?: string
  agent?: string
  priority?: 'low' | 'medium' | 'high'
  dependsOnTempIds?: string[]
  acceptanceCriteria?: string[]
  relatedDocumentTempIds?: string[]
  requiresApproval?: boolean
  approvalMessage?: string
  checkpointAfter?: boolean
  checkpointMessage?: string
  grpcConfig?: {
    protoFile: string
    service: string
    method: string
    address: string
    payload: Record<string, unknown>
    metadata?: Record<string, string>
    deadline?: number
  }
  condition?: {
    type: 'step_result' | 'llm_judge'
    source?: string
    field?: string
    equals?: string
    prompt?: string
    options?: string[]
  }
  loop?: {
    max: number
    steps: string[]
    until?: {
      type: 'step_result' | 'llm_judge'
      source?: string
      field?: string
      equals?: string
    }
    onExhausted?: 'abort' | 'continue' | 'skip'
  }
}

export interface DocumentDraft {
  tempId: string
  type: string
  title: string
  content: string
  relatedTaskTempIds?: string[]
}

export interface Proposal {
  id: string
  title: string
  description?: string
  inputType: 'idea' | 'manual'
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  taskDrafts: TaskDraft[]
  documentDrafts: DocumentDraft[]
  sourceYamlPath?: string
  createdAt: number
  updatedAt: number
  approvedAt?: number
  createdBy?: string
}

export interface AcceptanceCriterion {
  id: string
  text: string
  status: 'pending' | 'passed' | 'failed'
  evidence?: string
}

export interface StoredDocument {
  id: string
  title: string
  type: 'prd' | 'tech_design' | 'adr' | 'spec' | 'guide' | 'report'
  content: string
  proposalId?: string
  relatedTaskIds?: string[]
  createdAt: number
  updatedAt: number
  createdBy?: string
}

export interface ApprovalRequest {
  taskId: string
  taskTitle: string
  approvalMessage?: string
  stepIndex: number
  stepTotal: number
  proposalTitle?: string
  requestType?: 'approval' | 'task_failure' | 'checkpoint'
  errorMessage?: string
}

export interface ActivityEvent {
  id: string
  type: 'task_status' | 'task_progress' | 'approval_required' | 'approval_resolved' | 'task_error'
  taskId: string
  taskTitle: string
  agentName?: string
  timestamp: number
  // Status change details
  fromStatus?: string
  toStatus?: string
  // Progress details
  progressText?: string
  // Approval details
  approvalAction?: 'execute' | 'later' | 'abort'
  approvalMessage?: string
  // Error details
  errorMessage?: string
  // Summary
  summary?: string
}

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
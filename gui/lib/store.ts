import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, Message, Session, Task, ViewMode, Agent, AgentPresence, Notification, PermissionRequest, ApprovalRequest, ToolCallEvent, Proposal, TaskDraft, StoredDocument } from '@/types'

// HTTP API fallback for browser (non-Electron) access
const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : ''

const IPC_TO_HTTP: Record<string, { method: string; path: string; bodyKey?: string }> = {
  // Sessions
  'sessions:list':          { method: 'GET',  path: '/api/sessions' },
  'sessions:get':           { method: 'GET',  path: '/api/sessions/{0}' },
  'sessions:delete':        { method: 'DELETE', path: '/api/sessions/{0}', bodyKey: 'sessionId' },
  'sessions:heartbeat':     { method: 'POST', path: '/api/sessions/{0}/heartbeat', bodyKey: 'sessionId' },
  'sessions:close':         { method: 'POST', path: '/api/sessions/{0}/close', bodyKey: 'sessionId' },
  'sessions:update':        { method: 'PATCH', path: '/api/sessions/{0}', bodyKey: 'sessionId' },
  'sessions:messages':      { method: 'GET',  path: '/api/sessions/{0}/messages' },

  // Tasks
  'tasks:list':             { method: 'GET',  path: '/api/tasks' },
  'tasks:get':              { method: 'GET',  path: '/api/tasks/{0}' },
  'tasks:create':           { method: 'POST', path: '/api/tasks' },
  'tasks:update':           { method: 'PATCH', path: '/api/tasks/{0}', bodyKey: 'taskId' },
  'tasks:delete':           { method: 'DELETE', path: '/api/tasks/{0}', bodyKey: 'taskId' },
  'tasks:assign':           { method: 'POST', path: '/api/tasks/{0}/assign', bodyKey: 'taskId' },
  'tasks:release':          { method: 'POST', path: '/api/tasks/{0}/release', bodyKey: 'taskId' },
  'tasks:claim':            { method: 'POST', path: '/api/tasks/{0}/claim', bodyKey: 'taskId' },
  'tasks:complete':         { method: 'POST', path: '/api/tasks/{0}/complete', bodyKey: 'taskId' },
  'tasks:fail':             { method: 'POST', path: '/api/tasks/{0}/fail', bodyKey: 'taskId' },
  'tasks:submit_verify':    { method: 'POST', path: '/api/tasks/{0}/submit-verify', bodyKey: 'taskId' },
  'tasks:add_comment':      { method: 'POST', path: '/api/tasks/{0}/comment', bodyKey: 'taskId' },
  'tasks:get_unblocked':    { method: 'GET',  path: '/api/tasks/unblocked' },
  'tasks:createBatch':      { method: 'POST', path: '/api/tasks/batch' },
  'tasks:update_criterion': { method: 'POST', path: '/api/tasks/{0}/criterion', bodyKey: 'taskId' },
  'tasks:abort':            { method: 'POST', path: '/api/tasks/{0}/abort' },
  'tasks:execute':          { method: 'POST', path: '/api/tasks/{0}/execute' },
  'tasks:approve':          { method: 'POST', path: '/api/tasks/{0}/approve' },

  // Proposals
  'proposals:list':         { method: 'GET',  path: '/api/proposals' },
  'proposals:get':          { method: 'GET',  path: '/api/proposals/{0}' },
  'proposals:create':       { method: 'POST', path: '/api/proposals' },
  'proposals:update':       { method: 'PATCH', path: '/api/proposals/{0}', bodyKey: 'proposalId' },
  'proposals:delete':       { method: 'DELETE', path: '/api/proposals/{0}' },
  'proposals:delete_with_tasks': { method: 'DELETE', path: '/api/proposals/{0}/with-tasks' },
  'proposals:revert':       { method: 'POST', path: '/api/proposals/{0}/revert' },
  'proposals:submit':       { method: 'POST', path: '/api/proposals/{0}/submit' },
  'proposals:approve':      { method: 'POST', path: '/api/proposals/{0}/approve' },
  'proposals:reject':       { method: 'POST', path: '/api/proposals/{0}/reject' },
  'proposals:add_task_draft':     { method: 'POST', path: '/api/proposals/{0}/task-drafts', bodyKey: 'proposalId' },
  'proposals:remove_task_draft':  { method: 'DELETE', path: '/api/proposals/{0}/task-drafts/{1}', bodyKey: 'proposalId' },
  'proposals:update_task_draft':  { method: 'PATCH', path: '/api/proposals/{0}/task-drafts/{1}' },
  'proposals:add_document_draft': { method: 'POST', path: '/api/proposals/{0}/document-drafts' },
  'proposals:remove_document_draft': { method: 'DELETE', path: '/api/proposals/{0}/document-drafts/{1}' },
  'proposals:update_document_draft': { method: 'PATCH', path: '/api/proposals/{0}/document-drafts/{1}' },

  // Documents
  'documents:list':             { method: 'GET',  path: '/api/documents' },
  'documents:get':              { method: 'GET',  path: '/api/documents/{0}' },
  'documents:create':           { method: 'POST', path: '/api/documents' },
  'documents:update':           { method: 'PATCH', path: '/api/documents/{0}', bodyKey: 'docId' },
  'documents:delete':           { method: 'DELETE', path: '/api/documents/{0}' },
  'documents:list_by_proposal': { method: 'GET',  path: '/api/documents/by-proposal/{0}' },
  'documents:is_injected':      { method: 'GET',  path: '/api/documents/{0}/is-injected' },
  'documents:toggle_inject':    { method: 'POST', path: '/api/documents/{0}/toggle-inject', bodyKey: 'docId' },

  // Agents
  'agents:list':            { method: 'GET',  path: '/api/agents' },
  'agents:get':             { method: 'GET',  path: '/api/agents/{0}' },
  'agents:create':          { method: 'POST', path: '/api/agents' },
  'agents:update':          { method: 'PATCH', path: '/api/agents/{0}', bodyKey: 'agentId' },
  'agents:delete':          { method: 'DELETE', path: '/api/agents/{0}', bodyKey: 'agentId' },
  'agents:generate':        { method: 'POST', path: '/api/agents/generate' },
  'agents:list_by_capability': { method: 'GET', path: '/api/agents/by-capability' },

  // Workflows
  'workflows:list':         { method: 'GET',  path: '/api/workflows' },
  'workflows:get':          { method: 'GET',  path: '/api/workflows/{0}' },
  'workflows:delete':       { method: 'DELETE', path: '/api/workflows/{0}' },
  'workflows:import_yaml':  { method: 'POST', path: '/api/workflows/import' },
  'workflows:import_file':  { method: 'POST', path: '/api/workflows/import-file' },
  'workflows:list_files':   { method: 'GET',  path: '/api/workflows/files' },
  'workflows:import_remote':{ method: 'POST', path: '/api/workflows/import-remote' },
  'workflows:import_and_execute': { method: 'POST', path: '/api/workflows/import-and-execute' },
  'workflows:save-yaml':    { method: 'POST', path: '/api/workflows/save-yaml' },

  // Skills
  'skills:list':            { method: 'GET',  path: '/api/skills' },

  // Plans
  'plans:list':             { method: 'GET',  path: '/api/plans' },
  'plans:get':              { method: 'GET',  path: '/api/plans/{0}' },
  'plans:create':           { method: 'POST', path: '/api/plans' },
  'plans:update':           { method: 'PATCH', path: '/api/plans/{0}' },
  'plans:delete':           { method: 'DELETE', path: '/api/plans/{0}' },
  'plans:confirm':          { method: 'POST', path: '/api/plans/{0}/confirm' },

  // Config
  'config:get':             { method: 'GET',  path: '/api/config' },
  'config:set':             { method: 'PATCH', path: '/api/config' },

  // Executor
  'executor:status':        { method: 'GET',  path: '/api/health' },
  'approvals:pending':      { method: 'GET',  path: '/api/approvals/pending' },
  'executor:start':         { method: 'POST', path: '/api/executor/start' },
  'executor:stop':          { method: 'POST', path: '/api/executor/stop' },

  // Chat
  'chat:send':              { method: 'POST', path: '/api/chat' },
  'chat:cancel':            { method: 'POST', path: '/api/chat/cancel' },
  'chat:permission-response': { method: 'POST', path: '/api/chat/permission-response' },
}

async function sendViaHttp(channel: string, data?: unknown): Promise<any> {
  const route = IPC_TO_HTTP[channel]
  if (!route) {
    console.warn(`[HTTP] No mapping for IPC channel: ${channel}`)
    return null
  }

  let path = route.path
  const body = data && typeof data === 'object' ? { ...data as Record<string, unknown> } : data

  // Replace path params from body object
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const bodyObj = body as Record<string, unknown>
    const bodyKeys = Object.keys(bodyObj)
    const paramRegex = /\{(\d+)\}/g
    const usedKeys = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = paramRegex.exec(path)) !== null) {
      const idx = parseInt(match[1])
      const key = bodyKeys[idx]
      if (key && bodyObj[key] !== undefined) {
        path = path.replace(`{${idx}}`, String(bodyObj[key]))
        usedKeys.add(key)
      }
    }
    for (const key of usedKeys) {
      delete bodyObj[key]
    }
  } else if (typeof data === 'string') {
    path = path.replace('{0}', data)
  }

  if (Array.isArray(data)) {
    data.forEach((v, i) => { path = path.replace(`{${i}}`, String(v)) })
  }

  const url = `${API_BASE}${path}`
  const opts: RequestInit = {
    method: route.method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (route.method !== 'GET' && route.method !== 'DELETE' && body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface LlmConfig {
  provider: 'openai' | 'anthropic'
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt?: string
  anthropicVersion: string
  contextWindow?: number
  maxOutputTokens?: number
}

type Actions = {
  setViewMode: (mode: ViewMode) => void
  goBack: () => void
  newChat: () => void
  toggleSidebar: () => void
  setCurrentSession: (session: Session | null) => void
  jumpToSession: (sessionId: string) => Promise<void>
  loadSessionMessages: (sessionId: string) => Promise<void>
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  deleteSession: (id: string) => Promise<void>
  loadSessions: () => Promise<void>
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setStreamingText: (text: string) => void
  setPermissionRequest: (request: PermissionRequest | null) => void
  setApprovalRequest: (request: ApprovalRequest | null) => void
  resolveApproval: (taskId: string, action: string) => Promise<void>
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  loadTasks: () => Promise<void>
  createTask: (input: { title: string; description?: string; priority?: 'low' | 'medium' | 'high'; assignee?: string; dependsOn?: string[]; status?: Task['status'] }) => Promise<Task | null>
  updateTaskStatus: (id: string, status: Task['status']) => Promise<Task | null>
  deleteTaskBackend: (id: string) => Promise<void>
  executorRunning: boolean
  startExecutor: (config?: { pollIntervalMs?: number; agentType?: string }) => Promise<void>
  stopExecutor: () => Promise<void>
  checkExecutorStatus: () => Promise<void>
  agents: Agent[]
  loadAgents: () => Promise<void>
  createAgent: (input: { name: string; description: string; systemPrompt: string[]; allowedTools: string[] | "*"; maxTurns?: number; isReadOnly?: boolean; permission?: Agent['permission'] }) => Promise<Agent | null>
  updateAgent: (id: string, updates: { name?: string; description?: string; systemPrompt?: string[]; allowedTools?: string[] | "*"; maxTurns?: number; isReadOnly?: boolean; permission?: Agent['permission'] }) => Promise<Agent | null>
  deleteAgent: (id: string) => Promise<void>
  generateAgent: (description: string) => Promise<{ name: string; description: string; systemPrompt: string[]; allowedTools: string[] | "*"; maxTurns: number; isReadOnly: boolean } | null>
  updateAgentPresence: (presence: AgentPresence) => void
  removeAgentPresence: (agentId: string) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  addActivityEvent: (event: Omit<import('@/types').ActivityEvent, 'id' | 'timestamp'>) => void
  clearActivityFeed: () => void
  setBackendConnected: (connected: boolean) => void
  sendToBackend: (channel: string, data?: unknown) => Promise<unknown>
  loadConfig: () => Promise<void>
  setLlmConfig: (config: Partial<LlmConfig>) => Promise<void>
  getLlmConfig: () => LlmConfig | null
  sendChatMessage: (message: string | { text: string; images?: Array<{ data: string; mimeType: string }> }, sessionId?: string) => Promise<{ sessionId: string }>
  sendChatMessageSse: (message: string | { text: string; images?: Array<{ data: string; mimeType: string }> }, sessionId?: string) => Promise<{ sessionId: string }>
  cancelChat: () => Promise<void>
  startHeartbeat: () => void
  stopHeartbeat: () => void
  initBackendConnection: () => void
  // Proposals
  proposals: Proposal[]
  editingProposalId: string | null
  loadProposals: () => Promise<void>
  createProposal: (input: { title: string; description?: string }) => Promise<Proposal | null>
  updateProposal: (id: string, updates: { title?: string; description?: string; status?: string }) => Promise<void>
  deleteProposal: (id: string) => Promise<void>
  addTaskDraft: (proposalId: string, draft: Partial<TaskDraft> & { title: string }) => Promise<void>
  removeTaskDraft: (proposalId: string, tempId: string) => Promise<void>
  updateTaskDraft: (proposalId: string, tempId: string, updates: Partial<TaskDraft>) => Promise<void>
  addDocumentDraft: (proposalId: string, draft: { type: string; title: string; content: string }) => Promise<void>
  removeDocumentDraft: (proposalId: string, tempId: string) => Promise<void>
  submitProposal: (id: string) => Promise<void>
  approveProposal: (id: string) => Promise<{ tasks: Array<{ id: string; title: string }> } | null>
  rejectProposal: (id: string) => Promise<void>
  // Documents
  documents: StoredDocument[]
  loadDocuments: () => Promise<void>
  createDocument: (input: { title: string; type: string; content?: string }) => Promise<void>
  updateDocument: (id: string, updates: { title?: string; content?: string }) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  toggleDocumentInject: (docId: string, inject: boolean) => Promise<void>
  isDocumentInjected: (docId: string) => Promise<boolean>
}

interface AppStoreState extends AppState {
  llmConfig: LlmConfig | null
  streamingText: string
  proposals: Proposal[]
  documents: StoredDocument[]
  backendInitialized: boolean
  listenersRegistered: boolean
  executorRunning: boolean
  agents: Agent[]
  permissionRequest: PermissionRequest | null
  approvalRequest: import('@/types').ApprovalRequest | null
  activeToolCalls: Map<string, ToolCallEvent>
  heartbeatTimer: ReturnType<typeof setInterval> | null
  activityFeed: import('@/types').ActivityEvent[]
  previousViewMode: ViewMode | null
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function rawMessageToMessage(m: any, activeToolCalls?: Map<string, any>): Message {
  let content = ''
  let role: 'user' | 'assistant' | 'tool_result' | 'tool_error' = m.role || (m.type === 'user' ? 'user' : m.type === 'tool_result' ? 'tool_result' : 'assistant')
  const blocks: import('@/types').MessageBlock[] = []

  // If backend sent pre-built blocks, use them directly
  if (Array.isArray(m.blocks) && m.blocks.length > 0) {
    for (const b of m.blocks) {
      if (b.type === 'text') {
        blocks.push({ type: 'text', text: b.text || '' })
      } else if (b.type === 'image') {
        blocks.push({ type: 'image', data: b.data, mimeType: b.mimeType || 'image/png' })
      } else if (b.type === 'tool_use') {
        // Look up status from activeToolCalls if available
        const active = activeToolCalls?.get(b.id)
        blocks.push({
          type: 'tool_use',
          toolUseId: b.id,
          toolName: b.name,
          input: b.input,
          status: active?.status || 'pending',
          durationMs: active?.durationMs,
        })
      }
    }
    content = m.content || blocks.filter(b => b.type === 'text').map(b => (b as any).text).join('')
    return {
      id: m.id || `msg-${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: m.timestamp || Date.now(),
      blocks: blocks.length > 0 ? blocks : undefined,
    }
  }

  // Fallback: parse from content field
  if (role === 'user') {
    if (Array.isArray(m.content)) {
      const textParts: string[] = []
      for (const block of m.content) {
        if (block.type === 'text') {
          textParts.push(block.text || '')
          blocks.push({ type: 'text', text: block.text || '' })
        } else if (block.type === 'image') {
          blocks.push({ type: 'image', data: block.data, mimeType: block.mimeType || 'image/png' })
        }
      }
      content = textParts.join('\n')
    } else {
      content = m.content || ''
      blocks.push({ type: 'text', text: content })
    }
  } else if (role === 'tool_result' || role === 'tool_error') {
    content = m.content || ''
    blocks.push({ type: 'text', text: content })
  } else {
    if (Array.isArray(m.content)) {
      const textParts: string[] = []
      for (const block of m.content) {
        if (block.type === 'text') {
          textParts.push(block.text || '')
          blocks.push({ type: 'text', text: block.text || '' })
        } else if (block.type === 'tool_use') {
          const toolBlock: import('@/types').MessageBlock = {
            type: 'tool_use',
            toolUseId: block.id,
            toolName: block.name,
            input: block.input,
            status: 'completed',
          }
          blocks.push(toolBlock)
          textParts.push(`[tool: ${block.name}]`)
        }
      }
      content = textParts.join('')
    } else {
      content = m.content || ''
      blocks.push({ type: 'text', text: content })
    }
  }

  return {
    id: m.id || `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    timestamp: m.timestamp || Date.now(),
    blocks: blocks.length > 0 ? blocks : undefined,
  }
}

export const useAppStore = create<AppStoreState & Actions>()(
  persist(
    (set, get) => ({
      viewMode: 'chat',
      previousViewMode: null,
      sidebarCollapsed: false,
      currentSession: null,
      sessions: [],
      messages: [],
      isLoading: false,
      tasks: [],
      proposals: [],
      editingProposalId: null,
      documents: [],
      agentPresences: [],
      notifications: [],
      backendConnected: false,
      backendInitialized: false,
      listenersRegistered: false,
      llmConfig: null,
      streamingText: '',
      permissionRequest: null,
      approvalRequest: null,
      activeToolCalls: new Map<string, ToolCallEvent>(),
      heartbeatTimer: null,
      activityFeed: [],

      setViewMode: (mode) => {
        const current = get().viewMode
        if (mode === 'chat' && current !== 'chat') {
          set({ previousViewMode: current, viewMode: mode })
        } else {
          set({ viewMode: mode })
        }
      },
      goBack: () => {
        const prev = get().previousViewMode
        if (prev) {
          set({ viewMode: prev, previousViewMode: null })
        }
      },
      newChat: () => {
        get().stopHeartbeat()
        set({ currentSession: null, messages: [], streamingText: '', previousViewMode: null })
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setCurrentSession: (session) => {
        get().stopHeartbeat()
        set({ currentSession: session, messages: [] })
      },
      setPermissionRequest: (request) => set({ permissionRequest: request }),
      setApprovalRequest: (request) => set({ approvalRequest: request }),
      resolveApproval: async (taskId, action) => {
        try {
          await get().sendToBackend('tasks:approve', { taskId, action })
          set({ approvalRequest: null })
          // Refresh tasks after action
          setTimeout(() => get().loadTasks(), 500)
        } catch (e) {
          console.error('[Store] resolveApproval error:', e)
        }
      },
      jumpToSession: async (sessionId: string) => {
        try {
          const current = get().viewMode
          const result = await get().sendToBackend('sessions:get', sessionId) as { session: Session; messages: any[] }
          if (result?.session) {
            const msgs = result.messages ? result.messages.map(m => rawMessageToMessage(m, get().activeToolCalls)) : []
            set({
              previousViewMode: current !== 'chat' ? current : get().previousViewMode,
              viewMode: 'chat',
              currentSession: result.session,
              messages: msgs,
            })
          }
        } catch (e) {
          console.error('[Store] jumpToSession error:', e)
        }
      },
      loadSessionMessages: async (sessionId) => {
        try {
          const result = await get().sendToBackend('sessions:get', sessionId) as { session: Session; messages: any[] }
          if (result?.messages) {
            set({
              currentSession: result.session,
              messages: result.messages.map((m: any) => rawMessageToMessage(m, get().activeToolCalls)),
              isLoading: false,
              streamingText: '',
            })
          }
        } catch (e) {
          console.error('[Store] loadSessionMessages error:', e)
        }
      },
      addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
      updateSession: (id, updates) =>
        set((s) => ({
          sessions: s.sessions.map(( sess ) => sess.id === id ? { ...sess, ...updates, updatedAt: Date.now() } : sess),
          currentSession: s.currentSession?.id === id ? { ...s.currentSession, ...updates, updatedAt: Date.now() } : s.currentSession,
        })),
      deleteSession: async (id) => {
        console.log('[Store] deleteSession called:', id)
        // Optimistic delete — remove from local state immediately
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== id),
          currentSession: s.currentSession?.id === id ? null : s.currentSession,
          messages: s.currentSession?.id === id ? [] : s.messages,
          streamingText: s.currentSession?.id === id ? '' : s.streamingText,
        }))
        // Also clear from localStorage to prevent stale data on refresh
        try {
          const stored = localStorage.getItem('irg-store')
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.state?.sessions) {
              parsed.state.sessions = parsed.state.sessions.filter((s: any) => s.id !== id)
              localStorage.setItem('irg-store', JSON.stringify(parsed))
            }
          }
        } catch {}
        try {
          await get().sendToBackend('sessions:delete', { sessionId: id })
          console.log('[Store] deleteSession backend call succeeded')
        } catch (e) {
          console.error('[Store] deleteSession backend failed (session already removed from UI):', e)
        }
      },
      loadSessions: async () => {
        try {
          console.log('[Store] loadSessions: calling backend')
          const result = await get().sendToBackend('sessions:list', {}) as { sessions: any[] }
          console.log('[Store] loadSessions: received result:', result)
          if (result?.sessions) {
            // Map backend status to frontend status
            const statusMap: Record<string, Session['status']> = {
              'ready': 'active',
              'active': 'active',
              'needs_attention': 'failed',
              'closed': 'completed',
            }
            const mappedSessions: Session[] = result.sessions.map((s: any) => ({
              id: s.id,
              title: s.title || 'Untitled Session',
              createdAt: s.createdAt || Date.now(),
              updatedAt: s.updatedAt || Date.now(),
              messageCount: s.messageCount || 0,
              status: statusMap[s.status] || 'active',
              lastPrompt: s.lastPrompt,
              provider: s.provider,
              model: s.model,
              parentId: s.parentId,
              taskId: s.taskId,
            }))
            console.log('[Store] loadSessions: setting', mappedSessions.length, 'sessions')
            // Sort by updatedAt descending (newest first)
            mappedSessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            set({ sessions: mappedSessions })
          }
        } catch (e) {
          console.error('[Store] loadSessions: error:', e)
        }
      },

      addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, { ...msg, id: createId(), timestamp: Date.now() }] })),
      clearMessages: () => set({ messages: [], streamingText: '' }),
      setLoading: (loading) => set({ isLoading: loading }),
      setStreamingText: (text) => set({ streamingText: text }),

      addTask: (task) =>
        set((s) => ({ tasks: [...s.tasks, { ...task, id: createId(), createdAt: Date.now(), updatedAt: Date.now() }] })),
      updateTask: (id, updates) =>
        set((s) => ({ tasks: s.tasks.map(( t ) => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter(( t ) => t.id !== id) })),
      loadTasks: async () => {
        try {
          const result = await get().sendToBackend('tasks:list', {}) as { tasks: Task[] }
          if (result?.tasks) {
            const tasks = result.tasks.map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assignee: t.assignee,
              dependsOn: t.dependsOn,
              proposalId: t.proposalId,
              sessionId: t.sessionId,
              errorCount: t.errorCount,
              lastError: t.lastError,
              acceptanceCriteria: t.acceptanceCriteria,
              relatedDocumentIds: t.relatedDocumentIds,
              createdAt: new Date(t.createdAt).getTime(),
              updatedAt: new Date(t.updatedAt).getTime(),
              skipped: t.skipped,
              condition: t.condition,
              loop: t.loop,
            }))
            // Sort by updatedAt descending (newest first)
            tasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            set({ tasks })

            // Update agent presence based on task status (for browser mode)
            if (!window.electronAPI?.invoke) {
              const runningTasks = tasks.filter(t => t.status === 'in_progress' && t.assignee)
              for (const t of runningTasks) {
                get().updateAgentPresence({
                  agentId: t.assignee!,
                  agentName: t.assignee!,
                  status: 'running',
                  currentTask: t.title?.slice(0, 60) || 'Working...',
                  lastSeen: Date.now(),
                })
              }
              // Clear presence for agents with no running tasks
              const activeAgents = new Set(runningTasks.map(t => t.assignee))
              for (const p of get().agentPresences) {
                if (p.status === 'running' && !activeAgents.has(p.agentId)) {
                  get().updateAgentPresence({ ...p, status: 'idle', currentTask: undefined, lastSeen: Date.now() })
                }
              }
            }
          }
        } catch (e) {
          console.error('[Store] loadTasks error:', e)
        }
      },
      createTask: async (input: { title: string; description?: string; priority?: 'low' | 'medium' | 'high'; assignee?: string; dependsOn?: string[]; status?: Task['status'] }) => {
        try {
          const result = await get().sendToBackend('tasks:create', input) as { task: any }
          if (result?.task) {
            const task: Task = {
              id: result.task.id,
              title: result.task.title,
              description: result.task.description,
              status: result.task.status,
              priority: result.task.priority,
              assignee: result.task.assignee,
              createdAt: new Date(result.task.createdAt).getTime(),
              updatedAt: new Date(result.task.updatedAt).getTime(),
            }
            set((s) => ({ tasks: [task, ...s.tasks] }))
            return task
          }
        } catch (e) {
          console.error('[Store] createTask error:', e)
        }
        return null
      },
      updateTaskStatus: async (id: string, status: Task['status']) => {
        try {
          const result = await get().sendToBackend('tasks:update', { taskId: id, status }) as { task: any }
          if (result?.task) {
            const task: Task = {
              id: result.task.id,
              title: result.task.title,
              description: result.task.description,
              status: result.task.status,
              priority: result.task.priority,
              assignee: result.task.assignee,
              createdAt: new Date(result.task.createdAt).getTime(),
              updatedAt: new Date(result.task.updatedAt).getTime(),
            }
            set((s) => ({ tasks: s.tasks.map(( t ) => t.id === id ? task : t) }))
            return task
          }
        } catch (e) {
          console.error('[Store] updateTaskStatus error:', e)
        }
        return null
      },
      deleteTaskBackend: async (id: string) => {
        const previousTasks = get().tasks
        set({ tasks: previousTasks.filter(t => t.id !== id) })
        try {
          await get().sendToBackend('tasks:delete', { taskId: id })
          const result = await get().sendToBackend('tasks:list', {}) as { tasks: any[] }
          if (result?.tasks) {
            set({ tasks: result.tasks.map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assignee: t.assignee,
              createdAt: new Date(t.createdAt).getTime(),
              updatedAt: new Date(t.updatedAt).getTime(),
            })) })
          }
        } catch (e) {
          console.error('[Store] deleteTaskBackend error, restoring:', e)
          set({ tasks: previousTasks })
        }
      },

      // Proposal actions
      loadProposals: async () => {
        try {
          const result = await get().sendToBackend('proposals:list') as { proposals: any[] }
          if (result?.proposals) {
            set({
              proposals: result.proposals.map((p: any) => ({
                id: p.id,
                title: p.title,
                description: p.description,
                inputType: p.inputType,
                status: p.status,
                taskDrafts: p.taskDrafts || [],
                documentDrafts: p.documentDrafts || [],
                createdAt: new Date(p.createdAt).getTime(),
                updatedAt: new Date(p.updatedAt).getTime(),
                approvedAt: p.approvedAt ? new Date(p.approvedAt).getTime() : undefined,
                createdBy: p.createdBy,
              })),
            })
          }
        } catch (e) {
          console.error('[Store] loadProposals error:', e)
        }
      },

      createProposal: async (input) => {
        try {
          const result = await get().sendToBackend('proposals:create', input) as { proposal: any }
          if (result?.proposal) {
            const p = result.proposal
            const proposal: Proposal = {
              id: p.id,
              title: p.title,
              description: p.description,
              inputType: p.inputType,
              status: p.status,
              taskDrafts: p.taskDrafts || [],
              documentDrafts: p.documentDrafts || [],
              createdAt: new Date(p.createdAt).getTime(),
              updatedAt: new Date(p.updatedAt).getTime(),
              createdBy: p.createdBy,
            }
            set((s) => ({ proposals: [proposal, ...s.proposals] }))
            return proposal
          }
          return null
        } catch (e) {
          console.error('[Store] createProposal error:', e)
          return null
        }
      },

      updateProposal: async (id, updates) => {
        try {
          await get().sendToBackend('proposals:update', { proposalId: id, ...updates })
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] updateProposal error:', e)
        }
      },

      deleteProposal: async (id) => {
        const previous = get().proposals
        const proposal = previous.find(p => p.id === id)
        set({ proposals: previous.filter(p => p.id !== id) })
        try {
          // Draft proposals have no real tasks, use simple delete
          if (proposal?.status === 'draft') {
            await get().sendToBackend('proposals:delete', id)
          } else {
            await get().sendToBackend('proposals:delete_with_tasks', id)
            await Promise.all([get().loadTasks(), get().loadSessions()])
          }
        } catch (e) {
          console.error('[Store] deleteProposal error, restoring:', e)
          set({ proposals: previous })
        }
      },

      addTaskDraft: async (proposalId, draft) => {
        try {
          await get().sendToBackend('proposals:add_task_draft', { proposalId, draft })
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] addTaskDraft error:', e)
        }
      },

      removeTaskDraft: async (proposalId, tempId) => {
        try {
          await get().sendToBackend('proposals:remove_task_draft', { proposalId, tempId })
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] removeTaskDraft error:', e)
        }
      },

      updateTaskDraft: async (proposalId, tempId, updates) => {
        try {
          await get().sendToBackend('proposals:update_task_draft', { proposalId, tempId, updates })
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] updateTaskDraft error:', e)
        }
      },

      addDocumentDraft: async (proposalId, draft) => {
        try {
          await get().sendToBackend('proposals:add_document_draft', { proposalId, draft })
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] addDocumentDraft error:', e)
        }
      },

      removeDocumentDraft: async (proposalId, tempId) => {
        try {
          await get().sendToBackend('proposals:remove_document_draft', { proposalId, tempId })
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] removeDocumentDraft error:', e)
        }
      },

      submitProposal: async (id) => {
        try {
          await get().sendToBackend('proposals:submit', id)
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] submitProposal error:', e)
        }
      },

      approveProposal: async (id) => {
        try {
          const result = await get().sendToBackend('proposals:approve', id) as { tasks: Array<{ id: string; title: string }> }
          await get().loadProposals()
          await get().loadTasks()
          await get().loadDocuments()

          // Only assign tasks whose dependencies are all satisfied
          if (result?.tasks) {
            const allTasks = get().tasks
            for (const task of result.tasks) {
              const fullTask = allTasks.find(t => t.id === task.id)
              if (!fullTask) continue
              const deps = fullTask.dependsOn || []
              const allDepsDone = deps.length === 0 || deps.every(depId => {
                const dep = allTasks.find(t => t.id === depId)
                return dep && (dep.status === 'done' || dep.status === 'failed')
              })
              if (allDepsDone) {
                try {
                  await get().sendToBackend('tasks:assign', { taskId: task.id, assignee: fullTask.assignee || 'general-purpose' })
                } catch (e) {
                  console.error(`[Store] Failed to assign task ${task.id}:`, e)
                }
              }
            }
            await get().loadTasks()
          }

          return result
        } catch (e) {
          console.error('[Store] approveProposal error:', e)
          return null
        }
      },

      rejectProposal: async (id) => {
        try {
          await get().sendToBackend('proposals:reject', id)
          await get().loadProposals()
        } catch (e) {
          console.error('[Store] rejectProposal error:', e)
        }
      },

      // Document actions
      loadDocuments: async () => {
        try {
          const result = await get().sendToBackend('documents:list') as { documents: any[] }
          if (result?.documents) {
            set({
              documents: result.documents.map((d: any) => ({
                id: d.id,
                title: d.title,
                type: d.type,
                content: d.content,
                proposalId: d.proposalId,
                relatedTaskIds: d.relatedTaskIds,
                createdAt: new Date(d.createdAt).getTime(),
                updatedAt: new Date(d.updatedAt).getTime(),
                createdBy: d.createdBy,
              })),
            })
          }
        } catch (e) {
          console.error('[Store] loadDocuments error:', e)
        }
      },

      createDocument: async (input) => {
        try {
          await get().sendToBackend('documents:create', input)
          await get().loadDocuments()
        } catch (e) {
          console.error('[Store] createDocument error:', e)
        }
      },

      updateDocument: async (id, updates) => {
        try {
          await get().sendToBackend('documents:update', { docId: id, ...updates })
          await get().loadDocuments()
        } catch (e) {
          console.error('[Store] updateDocument error:', e)
        }
      },

      deleteDocument: async (id) => {
        const previous = get().documents
        set({ documents: previous.filter(d => d.id !== id) })
        try {
          await get().sendToBackend('documents:delete', id)
        } catch (e) {
          console.error('[Store] deleteDocument error, restoring:', e)
          set({ documents: previous })
        }
      },

      toggleDocumentInject: async (docId, inject) => {
        try {
          await get().sendToBackend('documents:toggle_inject', { docId, inject })
        } catch (e) {
          console.error('[Store] toggleDocumentInject error:', e)
        }
      },

      isDocumentInjected: async (docId) => {
        try {
          const result = await get().sendToBackend('documents:is_injected', docId) as { injected: boolean }
          return result?.injected ?? false
        } catch (e) {
          console.error('[Store] isDocumentInjected error:', e)
          return false
        }
      },

      updateAgentPresence: (presence) =>
        set((s) => {
          const idx = s.agentPresences.findIndex(( a ) => a.agentId === presence.agentId)
          if (idx >= 0) { const u = [...s.agentPresences]; u[idx] = presence; return { agentPresences: u } }
          return { agentPresences: [...s.agentPresences, presence] }
        }),
      removeAgentPresence: (agentId) => set((s) => ({ agentPresences: s.agentPresences.filter(( a ) => a.agentId !== agentId) })),

      addNotification: (notification) =>
        set((s) => ({
          notifications: [{ ...notification, id: createId(), timestamp: Date.now(), read: false }, ...s.notifications].slice(0, 50),
        })),
      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map(( n ) => n.id === id ? { ...n, read: true } : n) })),
      clearNotifications: () => set({ notifications: [] }),

      addActivityEvent: (event) =>
        set((s) => ({
          activityFeed: [...s.activityFeed, { ...event, id: createId(), timestamp: Date.now() }]
            .sort((a, b) => a.timestamp - b.timestamp) // sort chronologically
            .slice(-200), // keep last 200
        })),
      clearActivityFeed: () => set({ activityFeed: [] }),

      setBackendConnected: (connected) => {
        console.log('[Store] setBackendConnected called with:', connected)
        console.log('[Store] setBackendConnected current state:', get().backendConnected)
        set({ backendConnected: connected })
        console.log('[Store] setBackendConnected new state:', get().backendConnected)
      },

      sendToBackend: async (channel, data) => {
        console.log('[Store] sendToBackend:', channel, data)
        if (window.electronAPI?.invoke) {
          const result = await window.electronAPI.invoke(channel, data)
          console.log('[Store] sendToBackend result:', result)
          return result
        }
        // HTTP fallback for browser access
        return await sendViaHttp(channel, data)
      },

      loadConfig: async () => {
        try {
          console.log('[Store] loadConfig: calling backend')
          const result = await get().sendToBackend('config:get', {}) as { llm: LlmConfig, source: string }
          console.log('[Store] loadConfig: received result:', result)
          if (result?.llm) {
            console.log('[Store] loadConfig: setting llmConfig')
            set({ llmConfig: result.llm })
          } else {
            console.log('[Store] loadConfig: no llm in result')
          }
        } catch (e) { 
          console.error('[Store] loadConfig: error:', e)
          console.error('[Store] loadConfig: failed with', e)
        }
      },

      setLlmConfig: async (updates) => {
        const result = await get().sendToBackend('config:set', updates) as { llm: LlmConfig }
        if (result?.llm) set({ llmConfig: result.llm })
      },

      getLlmConfig: () => get().llmConfig,

      executorRunning: false,

      startExecutor: async (config?: { pollIntervalMs?: number; agentType?: string }) => {
        try {
          await get().sendToBackend('executor:start', config)
          set({ executorRunning: true })
        } catch (e) {
          console.error('[Store] startExecutor error:', e)
        }
      },

      stopExecutor: async () => {
        try {
          await get().sendToBackend('executor:stop', {})
          set({ executorRunning: false })
        } catch (e) {
          console.error('[Store] stopExecutor error:', e)
        }
      },

      checkExecutorStatus: async () => {
        try {
          const result = await get().sendToBackend('executor:status', {}) as { running: boolean }
          set({ executorRunning: result.running })
        } catch (e) {
          console.error('[Store] checkExecutorStatus error:', e)
        }
      },

      agents: [],

      loadAgents: async () => {
        try {
          const result = await get().sendToBackend('agents:list', {}) as { agents: any[] }
          set({ agents: result.agents })
        } catch (e) {
          console.error('[Store] loadAgents error:', e)
        }
      },

      createAgent: async (input) => {
        try {
          const result = await get().sendToBackend('agents:create', input) as { agent: any }
          if (result?.agent) {
            set((s) => ({ agents: [...s.agents, result.agent] }))
            return result.agent
          }
          return null
        } catch (e) {
          console.error('[Store] createAgent error:', e)
          return null
        }
      },

      updateAgent: async (id, updates) => {
        try {
          const result = await get().sendToBackend('agents:update', { agentId: id, updates }) as { agent: any }
          if (result?.agent) {
            set((s) => ({ agents: s.agents.map((a) => a.id === id ? result.agent : a) }))
            return result.agent
          }
          return null
        } catch (e) {
          console.error('[Store] updateAgent error:', e)
          return null
        }
      },

      deleteAgent: async (id) => {
        try {
          const result = await get().sendToBackend('agents:delete', { agentId: id }) as { success: boolean }
          if (result?.success) {
            set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }))
          } else {
            console.warn('[Store] deleteAgent: agent may be built-in or not found:', id)
          }
        } catch (e) {
          console.error('[Store] deleteAgent error:', e)
        }
      },

      generateAgent: async (description) => {
        try {
          const result = await get().sendToBackend('agents:generate', description) as { generated: any }
          return result?.generated || null
        } catch (e) {
          console.error('[Store] generateAgent error:', e)
          return null
        }
      },

      startHeartbeat: () => {
        const existing = get().heartbeatTimer
        if (existing) clearInterval(existing)
        const timer = setInterval(() => {
          const session = get().currentSession
          if (session?.id) {
            get().sendToBackend('sessions:heartbeat', { sessionId: session.id }).catch(() => {})
          }
        }, 5 * 60 * 1000) // 5 minutes
        set({ heartbeatTimer: timer })
      },

      stopHeartbeat: () => {
        const timer = get().heartbeatTimer
        if (timer) {
          clearInterval(timer)
          set({ heartbeatTimer: null })
        }
      },

      cancelChat: async () => {
        get().stopHeartbeat()
        try {
          await get().sendToBackend('chat:cancel', {})
          set({ isLoading: false, streamingText: '' })
        } catch (e) {
          console.error('[Store] cancelChat error:', e)
        }
      },

      sendChatMessage: async (message, sessionId) => {
        set({ isLoading: true, streamingText: '', activeToolCalls: new Map() })
        get().startHeartbeat()

        // Normalize message format
        const msgPayload = typeof message === 'string' ? { text: message } : message

        // Browser mode — use SSE
        if (!window.electronAPI?.invoke) {
          return await get().sendChatMessageSse(msgPayload, sessionId)
        }

        // Electron mode — use IPC
        try {
          const result = await get().sendToBackend('chat:send', { message: msgPayload, sessionId }) as {
            messages: any[]
            sessionId: string
          }
          if (result?.messages) {
            const newMessages = result.messages.map(m => rawMessageToMessage(m, get().activeToolCalls))
            get().stopHeartbeat()
            set({
              currentSession: result.sessionId ? {
                id: result.sessionId,
                title: msgPayload.text.slice(0, 50),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: newMessages.length,
                status: 'active'
              } : get().currentSession,
              messages: newMessages,
              isLoading: false,
              streamingText: '',
            })
            return { sessionId: result.sessionId }
          }
          get().stopHeartbeat()
          set({ isLoading: false, streamingText: '' })
        } catch (e) {
          get().stopHeartbeat()
          console.error('[Store] Chat error:', e)
          set({ isLoading: false, streamingText: '' })
        }
        return { sessionId: '' }
      },

      sendChatMessageSse: async (message, sessionId?: string) => {
        const collectedMessages: any[] = []
        let resultSessionId = ''

        // Normalize message format
        const msgPayload = typeof message === 'string' ? { text: message } : message

        try {
          const res = await fetch(`${API_BASE}/api/chat/sse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msgPayload, sessionId }),
          })

          if (!res.ok || !res.body) {
            throw new Error(`HTTP ${res.status}`)
          }

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            let currentEvent = ''
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7)
              } else if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))

                  if (currentEvent === 'delta') {
                    // Replace, not append — the server sends accumulated text
                    get().setStreamingText(data.text)
                  } else if (currentEvent === 'tool:start') {
                    // Track active tool calls in real-time
                    set(state => {
                      const newMap = new Map(state.activeToolCalls)
                      newMap.set(data.toolUseId, {
                        toolUseId: data.toolUseId,
                        toolName: data.toolName,
                        input: data.input,
                        status: 'running',
                        startTime: data.timestamp || Date.now(),
                      })
                      return { activeToolCalls: newMap }
                    })
                  } else if (currentEvent === 'tool:result') {
                    // Update tool call status to completed
                    set(state => {
                      const newMap = new Map(state.activeToolCalls)
                      const existing = newMap.get(data.toolUseId)
                      if (existing) {
                        newMap.set(data.toolUseId, { ...existing, status: 'completed', result: data.result, endTime: Date.now(), durationMs: data.durationMs })
                      }
                      // Also update message blocks with final status
                      const newMessages = state.messages.map(msg => {
                        if (!msg.blocks) return msg
                        const newBlocks = msg.blocks.map(b => {
                          if (b.type === 'tool_use' && b.toolUseId === data.toolUseId) {
                            return { ...b, status: 'completed' as const, durationMs: data.durationMs }
                          }
                          return b
                        })
                        return { ...msg, blocks: newBlocks }
                      })
                      return { activeToolCalls: newMap, messages: newMessages }
                    })
                  } else if (currentEvent === 'tool:error') {
                    // Update tool call status to failed
                    set(state => {
                      const newMap = new Map(state.activeToolCalls)
                      const existing = newMap.get(data.toolUseId)
                      if (existing) {
                        newMap.set(data.toolUseId, { ...existing, status: 'failed', error: data.error, endTime: Date.now(), durationMs: data.durationMs })
                      }
                      // Also update message blocks with failed status
                      const newMessages = state.messages.map(msg => {
                        if (!msg.blocks) return msg
                        const newBlocks = msg.blocks.map(b => {
                          if (b.type === 'tool_use' && b.toolUseId === data.toolUseId) {
                            return { ...b, status: 'failed' as const, durationMs: data.durationMs }
                          }
                          return b
                        })
                        return { ...msg, blocks: newBlocks }
                      })
                      return { activeToolCalls: newMap, messages: newMessages }
                    })
                  } else if (currentEvent === 'session:message-appended') {
                    // Handle real-time session messages from executor
                    const event = data as { sessionId: string; message: any }
                    const currentSession = get().currentSession
                    if (currentSession && currentSession.id === event.sessionId) {
                      const msg = rawMessageToMessage(event.message, get().activeToolCalls)
                      set((s) => ({ messages: [...s.messages, msg] }))
                    }
                  } else if (currentEvent === 'message') {
                    collectedMessages.push(data)
                    // Immediately display user messages in the UI
                    if (data.role === 'user') {
                      const userMsg = rawMessageToMessage(data)
                      set(state => ({ messages: [...state.messages, userMsg] }))
                    }
                    set({ streamingText: '' })
                  } else if (currentEvent === 'permission') {
                    const permPromise = new Promise<boolean>((resolve) => {
                      get().setPermissionRequest({
                        id: data.id,
                        toolName: data.toolName || 'Unknown',
                        input: data.input,
                        message: data.message || 'Permission required',
                        requestType: (data.requestType as any) || 'permission',
                        options: data.options,
                        schema: data.schema,
                        resolve: (resp: any) => resolve(typeof resp === 'boolean' ? resp : resp.approved !== false),
                      })
                    })

                    const approved = await permPromise
                    await fetch(`${API_BASE}/api/chat/permission-response`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: data.id, approved }),
                    })
                    get().setPermissionRequest(null)
                  } else if (currentEvent === 'done') {
                    resultSessionId = data.sessionId
                  } else if (currentEvent === 'error') {
                    console.error('[SSE] Error:', data.message)
                  }
                } catch (parseErr) {
                  console.warn('[SSE] Failed to parse data line:', line, parseErr)
                }
              }
            }
          }
        } catch (e) {
          console.error('[SSE] Chat error:', e)
        }

        get().stopHeartbeat()
        // Append new messages (skip user message since it was already shown immediately)
        const currentActiveTools = get().activeToolCalls
        const newMessages = collectedMessages
          .filter(m => m.role !== 'user')
          .map(m => rawMessageToMessage(m, currentActiveTools))
        set({
          currentSession: resultSessionId ? {
            id: resultSessionId,
            title: msgPayload.text.slice(0, 50),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: get().messages.length + newMessages.length,
            status: 'active',
          } : get().currentSession,
          messages: [...get().messages, ...newMessages],
          isLoading: false,
          streamingText: '',
        })

        return { sessionId: resultSessionId }
      },

      initBackendConnection: async () => {
        console.log('[Store] initBackendConnection called, initialized:', get().backendInitialized)
        if (get().backendInitialized) {
          console.log('[Store] Already initialized, skipping')
          return
        }
        console.log('[Store] window.electronAPI exists:', !!window.electronAPI)

        // Clear stale localStorage sessions — always load fresh from backend
        try {
          const stored = localStorage.getItem('irg-store')
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.state?.sessions) {
              parsed.state.sessions = []
              localStorage.setItem('irg-store', JSON.stringify(parsed))
            }
          }
        } catch {}

        try {
          const api = window.electronAPI
          if (api) {
            console.log('[Store] API found, awaiting loadConfig()')
            await get().loadConfig()
            console.log('[Store] loadConfig complete')
            set({ backendInitialized: true })
            get().setBackendConnected(true)
            get().loadSessions()

            if (api.on && !get().listenersRegistered) {
              set({ listenersRegistered: true })

              const onDelta = (data: unknown) => {
                get().setStreamingText((data as { text: string }).text)
              }

              const onPermission = (data: unknown) => {
                const perm = data as {
                  toolName: string
                  input: unknown
                  message: string
                  requestType?: string
                  options?: string[]
                  schema?: Array<{ name: string; label: string; type: string; options?: string[]; required?: boolean; default?: unknown }>
                }
                const permissionPromise = new Promise<any>((resolve) => {
                  get().setPermissionRequest({
                    id: `perm-${Date.now()}`,
                    toolName: perm.toolName,
                    input: perm.input,
                    message: perm.message,
                    requestType: (perm.requestType as any) || 'permission',
                    options: perm.options,
                    schema: perm.schema,
                    resolve,
                  })
                })
                permissionPromise.then((response) => {
                  // Backward compatibility: if response is a boolean, wrap it
                  const resp = typeof response === 'boolean' ? { approved: response } : response
                  get().sendToBackend('chat:permission-response', resp)
                })
              }

              const onToolStart = (data: unknown) => {
                const event = data as { toolUseId: string; toolName: string; input: unknown; timestamp: number }
                const map = new Map(get().activeToolCalls)
                map.set(event.toolUseId, {
                  toolUseId: event.toolUseId,
                  toolName: event.toolName,
                  input: event.input,
                  status: 'running',
                  startTime: event.timestamp,
                  progress: [],
                })
                set({ activeToolCalls: map })
                // Update agent presence
                get().updateAgentPresence({
                  agentId: 'chat-agent',
                  agentName: 'Chat Agent',
                  status: 'running',
                  currentTask: `Using ${event.toolName}`,
                  lastSeen: Date.now(),
                })
              }

              const onToolProgress = (data: unknown) => {
                const event = data as { toolUseId: string; progress: unknown; timestamp: number }
                const map = new Map(get().activeToolCalls)
                const existing = map.get(event.toolUseId)
                if (existing) {
                  map.set(event.toolUseId, {
                    ...existing,
                    progress: [...(existing.progress || []), event.progress],
                  })
                  set({ activeToolCalls: map })
                }
              }

              const onToolResult = (data: unknown) => {
                const event = data as { toolUseId: string; toolName: string; durationMs: number; isError: boolean; result?: string; timestamp: number }
                const map = new Map(get().activeToolCalls)
                const existing = map.get(event.toolUseId)
                if (existing) {
                  map.set(event.toolUseId, {
                    ...existing,
                    status: event.isError ? 'failed' : 'completed',
                    endTime: event.timestamp,
                    durationMs: event.durationMs,
                    result: event.result,
                  })
                  set({ activeToolCalls: map })
                }
                // Update message block status
                set((s) => ({
                  messages: s.messages.map(m => {
                    if (!m.blocks) return m
                    const updatedBlocks = m.blocks.map(b =>
                      b.type === 'tool_use' && b.toolUseId === event.toolUseId
                        ? { ...b, status: (event.isError ? 'failed' : 'completed') as 'completed' | 'failed', durationMs: event.durationMs }
                        : b
                    )
                    return updatedBlocks === m.blocks ? m : { ...m, blocks: updatedBlocks }
                  })
                }))
                // Check if all tools are done
                const remaining = Array.from(get().activeToolCalls.values()).filter(
                  tc => tc.status === 'running' && tc.toolUseId !== event.toolUseId
                )
                if (remaining.length === 0) {
                  get().updateAgentPresence({
                    agentId: 'chat-agent',
                    agentName: 'Chat Agent',
                    status: 'idle',
                    currentTask: undefined,
                    lastSeen: Date.now(),
                  })
                }
              }

              const onToolError = (data: unknown) => {
                const event = data as { toolUseId: string; toolName: string; error: string; durationMs: number; timestamp: number }
                const map = new Map(get().activeToolCalls)
                const existing = map.get(event.toolUseId)
                if (existing) {
                  map.set(event.toolUseId, {
                    ...existing,
                    status: 'failed',
                    endTime: event.timestamp,
                    durationMs: event.durationMs,
                    error: event.error,
                  })
                  set({ activeToolCalls: map })
                }
                // Update message block status
                set((s) => ({
                  messages: s.messages.map(m => {
                    if (!m.blocks) return m
                    const updatedBlocks = m.blocks.map(b =>
                      b.type === 'tool_use' && b.toolUseId === event.toolUseId
                        ? { ...b, status: 'failed' as 'failed', durationMs: event.durationMs }
                        : b
                    )
                    return updatedBlocks === m.blocks ? m : { ...m, blocks: updatedBlocks }
                  })
                }))
                // Check if all tools are done
                const remaining = Array.from(get().activeToolCalls.values()).filter(
                  tc => tc.status === 'running' && tc.toolUseId !== event.toolUseId
                )
                if (remaining.length === 0) {
                  get().updateAgentPresence({
                    agentId: 'chat-agent',
                    agentName: 'Chat Agent',
                    status: 'idle',
                    currentTask: undefined,
                    lastSeen: Date.now(),
                  })
                }
              }

              const onExecutorTaskClaimed = (data: unknown) => {
                const event = data as { taskId: string; title: string }
                const task = get().tasks.find(t => t.id === event.taskId)
                const agentName = task?.assignee || 'executor'
                get().updateAgentPresence({
                  agentId: agentName,
                  agentName,
                  status: 'running',
                  currentTask: event.title,
                  lastSeen: Date.now(),
                })
                get().addActivityEvent({
                  type: 'task_status',
                  taskId: event.taskId,
                  taskTitle: event.title,
                  agentName,
                  toStatus: 'in_progress',
                  summary: `Task claimed by ${agentName}`,
                })
              }

              const onExecutorTaskProgress = (data: unknown) => {
                const event = data as { taskId: string; text: string }
                const task = get().tasks.find(t => t.id === event.taskId)
                const agentName = task?.assignee || 'executor'
                get().updateAgentPresence({
                  agentId: agentName,
                  agentName,
                  status: 'running',
                  currentTask: event.text?.slice(0, 80) || 'Working...',
                  lastSeen: Date.now(),
                })
                get().addActivityEvent({
                  type: 'task_progress',
                  taskId: event.taskId,
                  taskTitle: task?.title || event.taskId,
                  agentName,
                  progressText: event.text,
                  summary: event.text?.slice(0, 120),
                })
              }

              const onExecutorTaskCompleted = (data: unknown) => {
                const event = data as { taskId: string; success: boolean; result?: string }
                const task = get().tasks.find(t => t.id === event.taskId)
                const agentName = task?.assignee || 'executor'

                // Update session status if task has an associated session
                if (task?.sessionId) {
                  const sessionStatus = event.success ? 'completed' as const : 'failed' as const
                  get().sendToBackend('sessions:update', {
                    sessionId: task.sessionId,
                    status: sessionStatus,
                  }).catch(() => {})
                  // Update local session state
                  set((s) => ({
                    sessions: s.sessions.map(sess =>
                      sess.id === task.sessionId
                        ? { ...sess, status: sessionStatus, updatedAt: Date.now() }
                        : sess
                    ),
                  }))
                }

                if (event.success) {
                  get().updateAgentPresence({
                    agentId: agentName,
                    agentName,
                    status: 'idle',
                    currentTask: undefined,
                    lastSeen: Date.now(),
                  })
                  get().addActivityEvent({
                    type: 'task_status',
                    taskId: event.taskId,
                    taskTitle: task?.title || event.taskId,
                    agentName,
                    toStatus: 'done',
                    summary: 'Task completed successfully',
                  })
                } else {
                  get().updateAgentPresence({
                    agentId: agentName,
                    agentName,
                    status: 'error',
                    currentTask: event.result?.slice(0, 60) || 'Task failed',
                    lastSeen: Date.now(),
                  })
                  get().addActivityEvent({
                    type: 'task_error',
                    taskId: event.taskId,
                    taskTitle: task?.title || event.taskId,
                    agentName,
                    errorMessage: event.result,
                    summary: `Task failed: ${event.result?.slice(0, 100) || 'Unknown error'}`,
                  })
                }
              }

              const onExecutorCycle = (data: unknown) => {
                const event = data as { pendingCount: number }
                if (event.pendingCount === 0) {
                  // Clear running presences when idle (but not error presences)
                  for (const p of get().agentPresences) {
                    if (p.status === 'running') {
                      get().updateAgentPresence({ ...p, status: 'idle', currentTask: undefined, lastSeen: Date.now() })
                    }
                  }
                }
              }

              const onSessionMessageAppended = (data: unknown) => {
                const event = data as { sessionId: string; message: any }
                const currentSession = get().currentSession
                if (currentSession && currentSession.id === event.sessionId) {
                  const msg = rawMessageToMessage(event.message, get().activeToolCalls)
                  set((s) => ({ messages: [...s.messages, msg] }))
                }
              }

              const onApprovalRequired = (data: unknown) => {
                const event = data as ApprovalRequest
                get().setApprovalRequest(event)
                get().addActivityEvent({
                  type: 'approval_required',
                  taskId: event.taskId,
                  taskTitle: event.taskTitle,
                  approvalMessage: event.approvalMessage,
                  summary: `Approval required: ${event.approvalMessage || event.taskTitle}`,
                })
              }

              const onApprovalResolved = (data: unknown) => {
                const event = data as { taskId: string; action: string }
                const task = get().tasks.find(t => t.id === event.taskId)
                get().addActivityEvent({
                  type: 'approval_resolved',
                  taskId: event.taskId,
                  taskTitle: task?.title || event.taskId,
                  approvalAction: event.action as any,
                  summary: `Approval ${event.action}: ${task?.title || event.taskId}`,
                })
              }

              api.on('chat:delta', onDelta)
              api.on('chat:permission', onPermission)
              api.on('event:tool:start', onToolStart)
              api.on('event:tool:progress', onToolProgress)
              api.on('event:tool:result', onToolResult)
              api.on('event:tool:error', onToolError)
              api.on('event:executor:task-claimed', onExecutorTaskClaimed)
              api.on('event:executor:task-progress', onExecutorTaskProgress)
              api.on('event:executor:task-completed', onExecutorTaskCompleted)
              api.on('event:executor:cycle', onExecutorCycle)
              api.on('event:session:message-appended', onSessionMessageAppended)
              api.on('event:approval:required', onApprovalRequired)
              api.on('event:approval:resolved', onApprovalResolved)

              // Store cleanup functions for potential future use
              ;(window as any).__ipcCleanup = () => {
                api.off?.('chat:delta', onDelta)
                api.off?.('chat:permission', onPermission)
                api.off?.('event:tool:start', onToolStart)
                api.off?.('event:tool:progress', onToolProgress)
                api.off?.('event:tool:result', onToolResult)
                api.off?.('event:tool:error', onToolError)
                api.off?.('event:executor:task-claimed', onExecutorTaskClaimed)
                api.off?.('event:executor:task-progress', onExecutorTaskProgress)
                api.off?.('event:executor:task-completed', onExecutorTaskCompleted)
                api.off?.('event:executor:cycle', onExecutorCycle)
                api.off?.('event:session:message-appended', onSessionMessageAppended)
                api.off?.('event:approval:required', onApprovalRequired)
                api.off?.('event:approval:resolved', onApprovalResolved)
                set({ listenersRegistered: false })
              }
            }
            console.log('[Store] initBackendConnection complete')
          } else {
            // Browser mode — use HTTP API fallback
            console.log('[Store] No Electron API, using HTTP fallback')
            set({ backendInitialized: true })
            get().setBackendConnected(true)
            get().loadSessions()
            get().loadTasks()
            get().loadProposals()
            get().loadDocuments()
            get().loadAgents()

            // Track previous task states for change detection
            let prevTaskStates = new Map<string, string>()
            const tasks = get().tasks
            tasks.forEach(t => prevTaskStates.set(t.id, t.status))

            // Poll for updates every 3 seconds
            setInterval(async () => {
              const prevTasks = get().tasks
              await get().loadTasks()
              await get().loadProposals()
              await get().loadSessions()

              // Detect task status changes and add activity events
              const currentTasks = get().tasks
              for (const task of currentTasks) {
                const prevStatus = prevTaskStates.get(task.id)
                if (prevStatus && prevStatus !== task.status) {
                  get().addActivityEvent({
                    type: task.status === 'failed' ? 'task_error' : 'task_status',
                    taskId: task.id,
                    taskTitle: task.title,
                    agentName: task.assignee,
                    fromStatus: prevStatus,
                    toStatus: task.status,
                    summary: `Status changed: ${prevStatus} → ${task.status}`,
                    ...(task.status === 'failed' && task.lastError ? { errorMessage: task.lastError } : {}),
                  })
                }
                prevTaskStates.set(task.id, task.status)
              }

              // Check for pending approvals
              get().sendToBackend('approvals:pending').then((result: any) => {
                if (result?.approvals?.length > 0 && !get().approvalRequest) {
                  const approval = result.approvals[0]
                  get().setApprovalRequest(approval)
                  get().addActivityEvent({
                    type: 'approval_required',
                    taskId: approval.taskId,
                    taskTitle: approval.taskTitle,
                    approvalMessage: approval.approvalMessage,
                    summary: `Approval required: ${approval.approvalMessage || approval.taskTitle}`,
                  })
                }
              }).catch(() => {})
            }, 3000)

            // Connect to live events SSE for real-time updates from executor
            try {
              const eventsUrl = `${API_BASE}/api/events`
              const eventSource = new EventSource(eventsUrl)

              eventSource.addEventListener('session:message-appended', (e) => {
                try {
                  const data = JSON.parse(e.data)
                  const currentSession = get().currentSession
                  if (currentSession && currentSession.id === data.sessionId) {
                    const msg = rawMessageToMessage(data.message, get().activeToolCalls)
                    set((s) => ({ messages: [...s.messages, msg] }))
                  }
                } catch {}
              })

              eventSource.addEventListener('executor:task-claimed', (e) => {
                try {
                  const data = JSON.parse(e.data)
                  get().updateAgentPresence({
                    agentId: data.agentId || data.assignee || 'executor',
                    agentName: data.agentName || data.assignee || 'executor',
                    status: 'running',
                    currentTask: data.taskId,
                    lastSeen: Date.now(),
                  })
                } catch {}
              })

              eventSource.addEventListener('executor:task-progress', (e) => {
                try {
                  const data = JSON.parse(e.data)
                  get().updateAgentPresence({
                    agentId: data.agentId || 'executor',
                    agentName: data.agentName || 'executor',
                    status: 'running',
                    currentTask: data.taskId,
                    lastSeen: Date.now(),
                  })
                } catch {}
              })

              eventSource.addEventListener('executor:task-completed', (e) => {
                try {
                  const data = JSON.parse(e.data)
                  const task = get().tasks.find(t => t.id === data.taskId)
                  const agentName = task?.assignee || 'executor'
                  if (task?.sessionId) {
                    const sessionStatus = data.success ? 'completed' as const : 'failed' as const
                    get().sendToBackend('sessions:update', {
                      sessionId: task.sessionId,
                      status: sessionStatus,
                    }).catch(() => {})
                    set((s) => ({
                      sessions: s.sessions.map(sess =>
                        sess.id === task.sessionId
                          ? { ...sess, status: sessionStatus, updatedAt: Date.now() }
                          : sess
                      ),
                    }))
                  }
                  get().updateAgentPresence({
                    agentId: agentName,
                    agentName,
                    status: 'idle',
                    currentTask: undefined,
                    lastSeen: Date.now(),
                  })
                  get().addActivityEvent({
                    type: data.success ? 'task_status' : 'task_error',
                    taskId: data.taskId,
                    taskTitle: task?.title || data.taskId,
                    agentName,
                    fromStatus: 'in_progress',
                    toStatus: data.success ? 'done' : 'failed',
                    summary: data.success ? `Task completed: ${task?.title || data.taskId}` : `Task failed: ${data.result?.slice(0, 100) || 'Unknown error'}`,
                    ...(data.success ? {} : { errorMessage: data.result }),
                  })
                } catch {}
              })

              eventSource.addEventListener('tool:start', (e) => {
                try {
                  const data = JSON.parse(e.data)
                  set(state => {
                    const newMap = new Map(state.activeToolCalls)
                    newMap.set(data.toolUseId, {
                      toolUseId: data.toolUseId,
                      toolName: data.toolName,
                      input: data.input,
                      status: 'running',
                      startTime: data.timestamp || Date.now(),
                    })
                    return { activeToolCalls: newMap }
                  })
                } catch {}
              })

              eventSource.addEventListener('tool:result', (e) => {
                try {
                  const data = JSON.parse(e.data)
                  set(state => {
                    const newMap = new Map(state.activeToolCalls)
                    const existing = newMap.get(data.toolUseId)
                    if (existing) {
                      newMap.set(data.toolUseId, { ...existing, status: 'completed', result: data.result, endTime: Date.now(), durationMs: data.durationMs })
                    }
                    const newMessages = state.messages.map(msg => {
                      if (!msg.blocks) return msg
                      const newBlocks = msg.blocks.map(b => {
                        if (b.type === 'tool_use' && b.toolUseId === data.toolUseId) {
                          return { ...b, status: 'completed' as const, durationMs: data.durationMs }
                        }
                        return b
                      })
                      return { ...msg, blocks: newBlocks }
                    })
                    return { activeToolCalls: newMap, messages: newMessages }
                  })
                } catch {}
              })

              eventSource.addEventListener('tool:error', (e) => {
                try {
                  const data = JSON.parse(e.data)
                  set(state => {
                    const newMap = new Map(state.activeToolCalls)
                    const existing = newMap.get(data.toolUseId)
                    if (existing) {
                      newMap.set(data.toolUseId, { ...existing, status: 'failed', error: data.error, endTime: Date.now(), durationMs: data.durationMs })
                    }
                    const newMessages = state.messages.map(msg => {
                      if (!msg.blocks) return msg
                      const newBlocks = msg.blocks.map(b => {
                        if (b.type === 'tool_use' && b.toolUseId === data.toolUseId) {
                          return { ...b, status: 'failed' as const, durationMs: data.durationMs }
                        }
                        return b
                      })
                      return { ...msg, blocks: newBlocks }
                    })
                    return { activeToolCalls: newMap, messages: newMessages }
                  })
                } catch {}
              })

              eventSource.onerror = () => {
                console.log('[Store] SSE events connection error, will reconnect...')
              }

              // Store cleanup
              ;(window as any).__sseEventsCleanup = () => {
                eventSource.close()
              }
            } catch (e) {
              console.warn('[Store] Failed to connect to events SSE:', e)
            }
          }
        } catch (e) {
          console.error('[Store] initBackendConnection error:', e)
          set({ backendInitialized: true, backendConnected: false })
        }
      },
    }),
    { name: 'irg-store', 
      partialize: (state) => ({ 
        sidebarCollapsed: state.sidebarCollapsed, 
        sessions: state.sessions.slice(0, 20),
        llmConfig: state.llmConfig,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.backendInitialized = false
          state.listenersRegistered = false
          state.backendConnected = false
        }
      }
    }
  )
)
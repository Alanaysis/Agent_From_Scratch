import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, Message, Session, Task, ViewMode, AgentPresence, Notification } from '@/types'

export interface LlmConfig {
  provider: 'openai' | 'anthropic'
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt?: string
  anthropicVersion: string
}

type Actions = {
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  setCurrentSession: (session: Session | null) => void
  jumpToSession: (sessionId: string) => Promise<void>
  loadSessionMessages: (sessionId: string) => Promise<void>
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  deleteSession: (id: string) => void
  loadSessions: () => Promise<void>
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setStreamingText: (text: string) => void
  appendStreamingText: (text: string) => void
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
  agents: any[]
  loadAgents: () => Promise<void>
  createAgent: (input: { name: string; description: string; systemPrompt: string[]; allowedTools: string[] | "*"; maxTurns?: number; isReadOnly?: boolean; permission?: any }) => Promise<any | null>
  updateAgent: (id: string, updates: { name?: string; description?: string; systemPrompt?: string[]; allowedTools?: string[] | "*"; maxTurns?: number; isReadOnly?: boolean; permission?: any }) => Promise<any | null>
  deleteAgent: (id: string) => Promise<void>
  generateAgent: (description: string) => Promise<{ name: string; description: string; systemPrompt: string[]; allowedTools: string[] | "*"; maxTurns: number; isReadOnly: boolean } | null>
  updateAgentPresence: (presence: AgentPresence) => void
  removeAgentPresence: (agentId: string) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  setBackendConnected: (connected: boolean) => void
  sendToBackend: (channel: string, data?: unknown) => Promise<unknown>
  loadConfig: () => Promise<void>
  setLlmConfig: (config: Partial<LlmConfig>) => Promise<void>
  getLlmConfig: () => LlmConfig | null
  sendChatMessage: (message: string, sessionId?: string) => Promise<{ sessionId: string }>
  initBackendConnection: () => void
}

interface AppStoreState extends AppState {
  llmConfig: LlmConfig | null
  streamingText: string
  backendInitialized: boolean
  listenersRegistered: boolean
  executorRunning: boolean
  agents: any[]
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export const useAppStore = create<AppStoreState & Actions>()(
  persist(
    (set, get) => ({
      viewMode: 'chat',
      sidebarCollapsed: false,
      currentSession: null,
      sessions: [],
      messages: [],
      isLoading: false,
      tasks: [],
      agentPresences: [],
      notifications: [],
      backendConnected: false,
      backendInitialized: false,
      listenersRegistered: false,
      llmConfig: null,
      streamingText: '',

      setViewMode: (mode) => set({ viewMode: mode }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setCurrentSession: (session) => set({ currentSession: session, messages: [] }),
      jumpToSession: async (sessionId: string) => {
        try {
          const result = await get().sendToBackend('sessions:get', sessionId) as { session: Session; messages: any[] }
          if (result?.session) {
            set({ viewMode: 'chat', currentSession: result.session, messages: [] })
            if (result?.messages) {
              const msgs = result.messages.map((m: any) => {
                let content = ''
                let role: 'user' | 'assistant' | 'tool_result' | 'tool_error' = m.role || 'assistant'
                if (role === 'user') {
                  content = m.content || ''
                } else if (role === 'tool_result' || role === 'tool_error') {
                  content = m.content || ''
                } else {
                  if (Array.isArray(m.content)) {
                    content = m.content.map((block: any) => {
                      if (block.type === 'text') return block.text || ''
                      if (block.type === 'tool_use') return `[tool: ${block.name}]`
                      return ''
                    }).join('')
                  } else {
                    content = m.content || ''
                  }
                }
                return { id: m.id || `msg-${Date.now()}`, role, content, timestamp: m.timestamp || Date.now() }
              })
              set({ messages: msgs })
            }
          }
        } catch (e) {
          console.error('[Store] jumpToSession error:', e)
        }
      },
      loadSessionMessages: async (sessionId) => {
        try {
          const result = await get().sendToBackend('sessions:get', sessionId) as { session: Session; messages: any[] }
          if (result?.messages) {
            const msgs = result.messages.map((m: any) => {
              let content = ''
              let role: 'user' | 'assistant' | 'tool_result' | 'tool_error' = m.role || 'assistant'

              if (role === 'user') {
                content = m.content || ''
              } else if (role === 'tool_result' || role === 'tool_error') {
                content = m.content || ''
              } else {
                if (Array.isArray(m.content)) {
                  content = m.content.map((block: any) => {
                    if (block.type === 'text') return block.text || ''
                    if (block.type === 'tool_use') return `[tool: ${block.name}]`
                    return ''
                  }).join('')
                } else {
                  content = m.content || ''
                }
              }

              return {
                id: m.id || `msg-${Date.now()}-${Math.random()}`,
                role,
                content,
                timestamp: m.timestamp || Date.now(),
              }
            })
            set({
              currentSession: result.session,
              messages: msgs,
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
        try {
          await get().sendToBackend('sessions:delete', { sessionId: id })
          console.log('[Store] deleteSession backend call succeeded')
          set((s) => ({
            sessions: s.sessions.filter(( sess ) => sess.id !== id),
            currentSession: s.currentSession?.id === id ? null : s.currentSession,
          }))
          console.log('[Store] deleteSession store updated')
        } catch (e) {
          console.error('[Store] deleteSession failed:', e)
        }
      },
      loadSessions: async () => {
        try {
          console.log('[Store] loadSessions: calling backend')
          const result = await get().sendToBackend('sessions:list', {}) as { sessions: Session[] }
          console.log('[Store] loadSessions: received result:', result)
          if (result?.sessions) {
            console.log('[Store] loadSessions: setting', result.sessions.length, 'sessions')
            set({ sessions: result.sessions })
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
      appendStreamingText: (text) => set((s) => ({ streamingText: s.streamingText + text })),

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
              createdAt: new Date(t.createdAt).getTime(),
              updatedAt: new Date(t.updatedAt).getTime(),
            }))
            set({ tasks })
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
        console.log('[Store] deleteTaskBackend called for:', id)
        let completed = false
        const timeoutId = setTimeout(() => {
          if (!completed) {
            console.warn('[Store] deleteTaskBackend TIMEOUT - forcing state update')
            completed = true
            const tasks = get().tasks.filter(t => t.id !== id)
            console.log('[Store] deleteTaskBackend timeout - new tasks count:', tasks.length)
            set({ tasks })
          }
        }, 3000)
        try {
          console.log('[Store] deleteTaskBackend sending tasks:delete IPC...')
          await get().sendToBackend('tasks:delete', { taskId: id })
          console.log('[Store] deleteTaskBackend tasks:delete completed, sending tasks:list...')
          const result = await get().sendToBackend('tasks:list', {}) as { tasks: any[] }
          completed = true
          clearTimeout(timeoutId)
          console.log('[Store] deleteTaskBackend tasks:list completed, tasks count:', result?.tasks?.length)
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
            console.log('[Store] deleteTaskBackend store updated')
          }
        } catch (e) {
          completed = true
          clearTimeout(timeoutId)
          console.error('[Store] deleteTaskBackend error:', e)
          const tasks = get().tasks.filter(t => t.id !== id)
          set({ tasks })
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
        console.log('[Store] sendToBackend: no electronAPI')
        throw new Error('Backend not connected')
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
          await get().sendToBackend('agents:delete', { agentId: id })
          set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }))
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

      sendChatMessage: async (message, sessionId) => {
        set({ isLoading: true, streamingText: '' })
        try {
          const result = await get().sendToBackend('chat:send', { message, sessionId }) as {
            messages: any[]
            sessionId: string
          }
          if (result?.messages) {
            const newMessages = result.messages.map((m: any) => {
              let content = ''
              let role: 'user' | 'assistant' | 'tool_result' | 'tool_error' = m.role || 'assistant'

              if (role === 'user') {
                content = m.content || ''
              } else if (role === 'tool_result' || role === 'tool_error') {
                content = m.content || ''
              } else {
                if (Array.isArray(m.content)) {
                  content = m.content.map((block: any) => {
                    if (block.type === 'text') return block.text || ''
                    if (block.type === 'tool_use') return `[tool: ${block.name}]`
                    return ''
                  }).join('')
                } else {
                  content = m.content || ''
                }
              }

              return {
                id: m.id || `msg-${Date.now()}-${Math.random()}`,
                role,
                content,
                timestamp: m.timestamp || Date.now(),
              }
            })
            set({
              currentSession: result.sessionId ? {
                id: result.sessionId,
                title: message.slice(0, 50),
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
          set({ isLoading: false, streamingText: '' })
        } catch (e) {
          console.error('[Store] Chat error:', e)
          set({ isLoading: false, streamingText: '' })
        }
        return { sessionId: '' }
      },

      initBackendConnection: async () => {
        console.log('[Store] initBackendConnection called, initialized:', get().backendInitialized)
        if (get().backendInitialized) {
          console.log('[Store] Already initialized, skipping')
          return
        }
        console.log('[Store] window.electronAPI exists:', !!window.electronAPI)
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
              api.on('chat:delta', (data: unknown) => {
                console.log('[Store] chat:delta received:', data)
                get().setStreamingText((data as { text: string }).text)
              })

              // Disabled: chat:message events cause duplicate messages
              // since we already get all messages from chat:send response
              // api.on('chat:message', (data: unknown) => {
              //   console.log('[Store] chat:message received:', data)
              //   const msg = data as { message: Message }
              //   get().addMessage({
              //     role: msg.message.role,
              //     content: msg.message.content,
              //     toolName: msg.message.toolName,
              //   })
              // })

              api.on('chat:permission', (data: unknown) => {
                console.log('[Store] chat:permission received:', data)
                const perm = data as { toolName: string; input: unknown; message: string }
                const approved = window.confirm(`Allow tool "${perm.toolName}"?\n\n${perm.message || 'No description'}`)
                console.log('[Store] Permission result:', approved)
                get().sendToBackend('chat:permission-response', { approved })
              })
            }
            console.log('[Store] initBackendConnection complete')
          } else {
            console.log('[Store] API NOT found')
          }
        } catch (e) {
          console.error('[Store] initBackendConnection error:', e)
          set({ backendInitialized: true })
          get().setBackendConnected(true)
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
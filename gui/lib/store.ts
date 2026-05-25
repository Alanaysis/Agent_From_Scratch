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
      addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
      updateSession: (id, updates) =>
        set((s) => ({
          sessions: s.sessions.map(( sess ) => sess.id === id ? { ...sess, ...updates, updatedAt: Date.now() } : sess),
          currentSession: s.currentSession?.id === id ? { ...s.currentSession, ...updates, updatedAt: Date.now() } : s.currentSession,
        })),
      deleteSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter(( sess ) => sess.id !== id),
          currentSession: s.currentSession?.id === id ? null : s.currentSession,
        })),
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

      sendChatMessage: async (message, sessionId) => {
        set({ isLoading: true, streamingText: '' })
        try {
          const result = await get().sendToBackend('chat:send', { message, sessionId }) as {
            messages: Message[]
            sessionId: string
          }
          if (result?.messages) {
            const newMessages = result.messages.map((m: Message & { toolName?: string }) => ({
              id: m.id || `msg-${Date.now()}`,
              role: m.role as 'user' | 'assistant',
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
              timestamp: Date.now(),
              toolName: m.toolName,
            }))
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
    { name: 'irg-store', partialize: (state) => ({ 
      sidebarCollapsed: state.sidebarCollapsed, 
      sessions: state.sessions.slice(0, 20),
      llmConfig: state.llmConfig,
    }) }
  )
)
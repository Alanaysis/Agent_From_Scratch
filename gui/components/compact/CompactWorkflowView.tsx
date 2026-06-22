'use client'

import * as React from 'react'
import {
  Plus, History, Play, Pause, Send, Square, Loader2,
  CheckCircle, XCircle, Clock, ChevronRight, ChevronDown,
  Wrench, Cpu, Bot, ChevronLeft, Maximize2, FileText
} from 'lucide-react'
import { WorkflowRail } from './WorkflowRail'
import { ProposalPicker } from './ProposalPicker'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : ''

const TASK_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

const mono = 'IBM Plex Mono, monospace'
const sans = 'IBM Plex Sans, sans-serif'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  todo: { color: '#7dd3fc', icon: <ChevronRight size={10} />, label: 'Pending' },
  in_progress: { color: '#fbbf24', icon: <Loader2 size={10} />, label: 'Running' },
  pausing: { color: '#fde68a', icon: <Loader2 size={10} />, label: 'Pausing' },
  paused: { color: '#60a5fa', icon: <Clock size={10} />, label: 'Paused' },
  cancelling: { color: '#fb923c', icon: <Loader2 size={10} />, label: 'Cancelling' },
  cancelled: { color: '#94a3b8', icon: <XCircle size={10} />, label: 'Cancelled' },
  verify: { color: '#c4b5fd', icon: <Clock size={10} />, label: 'Verify' },
  done: { color: '#86efac', icon: <CheckCircle size={10} />, label: 'Done' },
  failed: { color: '#fca5a5', icon: <XCircle size={10} />, label: 'Failed' },
  skipped: { color: '#94a3b8', icon: <ChevronRight size={10} />, label: 'Skipped' },
}

interface CompactTask {
  id: string
  title: string
  status: string
  assignee?: string
  dependsOn?: string[]
  condition?: {
    type: 'step_result' | 'llm_judge'
    source?: string
    field?: string
    equals?: string
  }
  loop?: {
    max: number
    steps: string[]
  }
  checkpointAfter?: boolean
  checkpointMessage?: string
  requiresApproval?: boolean
  approvalMessage?: string
  description?: string
  lastError?: string
}

interface CompactMessage {
  id: string
  role: 'user' | 'assistant' | 'tool_result' | 'tool_error' | 'system'
  content: string
  timestamp: number
  taskId?: string
  blocks?: any[]
}

function getTaskColor(taskId: string, tasks: CompactTask[]): string {
  const idx = tasks.findIndex(t => t.id === taskId)
  return TASK_COLORS[idx % TASK_COLORS.length] || TASK_COLORS[0]!
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      parts.push(<code key={key++} style={{ backgroundColor: 'var(--surface-2)', padding: '1px 3px', fontSize: 11, fontFamily: mono, border: '1px solid var(--border-subtle)', borderRadius: 2 }}>{codeMatch[1]}</code>)
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      parts.push(<strong key={key++} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }
    const nextSpecial = remaining.search(/[`*]/)
    if (nextSpecial === -1) { parts.push(remaining); break }
    if (nextSpecial === 0) { parts.push(remaining[0]); remaining = remaining.slice(1) }
    else { parts.push(remaining.slice(0, nextSpecial)); remaining = remaining.slice(nextSpecial) }
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [text]
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) { codeLines.push(lines[i]!); i++ }
      i++
      elements.push(<pre key={`code-${elements.length}`} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '6px 8px', margin: '3px 0', overflow: 'auto', fontSize: 11, fontFamily: mono, lineHeight: 1.5, borderRadius: 2 }}><code>{codeLines.join('\n')}</code></pre>)
      continue
    }
    if (line.trim() === '') { elements.push(<div key={`br-${elements.length}`} style={{ height: 3 }} />); i++; continue }
    elements.push(<p key={`p-${elements.length}`} style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '1px 0' }}>{renderInlineMarkdown(line)}</p>)
    i++
  }
  return elements
}

function SystemEventTag({ task, tasks }: { task: CompactTask; tasks: CompactTask[] }) {
  const cfg = statusConfig[task.status] || statusConfig.todo
  const color = getTaskColor(task.id, tasks)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', margin: '2px 0',
      backgroundColor: `${color}10`, borderLeft: `3px solid ${color}`,
      fontSize: 10, fontFamily: mono, color: 'var(--text-muted)',
    }}>
      <span style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>
        {task.status === 'in_progress' ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : cfg.icon}
      </span>
      <span style={{ color, fontWeight: 600 }}>{task.title}</span>
      <span style={{ color: cfg.color, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cfg.label}</span>
      {task.assignee && <span style={{ color: 'var(--text-faint)' }}>@{task.assignee}</span>}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function MessageBubble({ msg, tasks }: { msg: CompactMessage; tasks: CompactTask[] }) {
  if (msg.role === 'system') return null

  const isUser = msg.role === 'user'
  const isToolResult = msg.role === 'tool_result' || msg.role === 'tool_error'
  const taskColor = msg.taskId ? getTaskColor(msg.taskId, tasks) : undefined

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 10px' }}>
        <div style={{
          maxWidth: '85%', padding: '6px 10px',
          backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
          borderRadius: 2, fontSize: 12, lineHeight: 1.55, color: 'var(--text-primary)',
          fontFamily: sans,
        }}>
          {msg.content}
        </div>
      </div>
    )
  }

  if (isToolResult) {
    return (
      <div style={{ padding: '2px 10px' }}>
        <div style={{
          padding: '4px 8px',
          backgroundColor: msg.role === 'tool_error' ? 'rgba(192,80,80,0.06)' : 'rgba(92,184,92,0.04)',
          border: `1px solid ${msg.role === 'tool_error' ? 'rgba(192,80,80,0.15)' : 'rgba(92,184,92,0.1)'}`,
          borderLeft: taskColor ? `3px solid ${taskColor}` : undefined,
          fontSize: 10, fontFamily: mono, color: msg.role === 'tool_error' ? 'var(--warm-red)' : 'var(--text-secondary)',
          maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          borderRadius: 2,
        }}>
          {msg.content.slice(0, 500)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2px 10px' }}>
      <div style={{
        padding: '6px 10px',
        backgroundColor: taskColor ? `${taskColor}08` : 'var(--surface-1)',
        border: `1px solid ${taskColor ? `${taskColor}20` : 'var(--border-subtle)'}`,
        borderLeft: taskColor ? `3px solid ${taskColor}` : undefined,
        borderRadius: 2,
      }}>
        {taskColor && msg.taskId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: taskColor }} />
            <span style={{ fontSize: 9, fontFamily: mono, color: taskColor, fontWeight: 600 }}>
              {tasks.find(t => t.id === msg.taskId)?.title || 'Agent'}
            </span>
          </div>
        )}
        <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', fontFamily: sans }}>
          {msg.blocks && msg.blocks.length > 0
            ? msg.blocks.map((block: any, i: number) => {
                if (block.type === 'text') return <div key={i}>{renderMarkdown(block.text || '')}</div>
                if (block.type === 'tool_use') {
                  const toolStatus = block.status || 'pending'
                  const sCfg: Record<string, { color: string; label: string }> = {
                    pending: { color: 'var(--text-muted)', label: 'PENDING' },
                    running: { color: 'var(--amber)', label: 'RUNNING' },
                    completed: { color: 'var(--status-green)', label: 'DONE' },
                    failed: { color: 'var(--warm-red)', label: 'FAILED' },
                  }
                  const sc = sCfg[toolStatus] || sCfg.pending
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '3px 6px', margin: '3px 0',
                      backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                      borderRadius: 2, fontSize: 10, fontFamily: mono,
                    }}>
                      <Wrench size={9} color={sc.color} />
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{block.name || block.toolName}</span>
                      <span style={{ color: sc.color, fontSize: 9, letterSpacing: '0.03em' }}>{sc.label}</span>
                      {toolStatus === 'running' && <Loader2 size={9} color={sc.color} style={{ animation: 'spin 1s linear infinite' }} />}
                    </div>
                  )
                }
                return null
              })
            : renderMarkdown(msg.content)
          }
        </div>
      </div>
    </div>
  )
}

export function CompactWorkflowView() {
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<CompactMessage[]>([])
  const [tasks, setTasks] = React.useState<CompactTask[]>([])
  const [workflowExpanded, setWorkflowExpanded] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [streamingText, setStreamingText] = React.useState('')
  const [input, setInput] = React.useState('')
  const [showPicker, setShowPicker] = React.useState(false)
  const [showHistory, setShowHistory] = React.useState(false)
  const [sessions, setSessions] = React.useState<any[]>([])
  const [workflowName, setWorkflowName] = React.useState<string | null>(null)
  const [executorRunning, setExecutorRunning] = React.useState(false)
  const [autoCollapsed, setAutoCollapsed] = React.useState(false)
  const [approvalPopup, setApprovalPopup] = React.useState<{
    taskId: string
    taskTitle: string
    message: string
    isCheckpoint: boolean
    resolving: boolean
  } | null>(null)
  const [templateConfirm, setTemplateConfirm] = React.useState<{
    template: any
    enhancement: any
    params: Record<string, string>
    loading: boolean
  } | null>(null)
  const [stopChoice, setStopChoice] = React.useState(false)
  const approvalPopupRef = React.useRef<typeof approvalPopup>(null)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const chatAbortRef = React.useRef<AbortController | null>(null)
  const taskIdsRef = React.useRef<Set<string>>(new Set())
  const sessionIdRef = React.useRef<string | null>(null)
  const seenMsgIdsRef = React.useRef<Set<string>>(new Set())
  const taskOrderRef = React.useRef<string[]>([])
  const tasksRef = React.useRef<CompactTask[]>([])

  React.useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  React.useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  React.useEffect(() => {
    approvalPopupRef.current = approvalPopup
  }, [approvalPopup])

  React.useEffect(() => {
    const saved = localStorage.getItem('compact-session-id')
    if (saved) {
      setSessionId(saved)
      sessionIdRef.current = saved
      const savedOrder = localStorage.getItem('compact-task-order')
      if (savedOrder) {
        try { taskOrderRef.current = JSON.parse(savedOrder) } catch {}
      }
      restoreSession(saved)
    }
    syncExecutorStatus()
    connectSSE()
    return () => disconnectSSE()
  }, [])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingText])

  React.useEffect(() => {
    if (!sessionId) return
    const interval = setInterval(loadTasks, 2000)
    return () => clearInterval(interval)
  }, [sessionId])

  React.useEffect(() => {
    if (sessionId) localStorage.setItem('compact-session-id', sessionId)
  }, [sessionId])

  React.useEffect(() => {
    if (taskOrderRef.current.length > 0) {
      localStorage.setItem('compact-task-order', JSON.stringify(taskOrderRef.current))
    }
  }, [tasks.length])

  React.useEffect(() => {
    if (input.length > 0 && workflowExpanded && !autoCollapsed) {
      setWorkflowExpanded(false)
      setAutoCollapsed(true)
    }
    if (input.length === 0) setAutoCollapsed(false)
  }, [input])

  async function restoreSession(sid: string) {
    try {
      const msgRes = await fetch(`${API_BASE}/api/sessions/${sid}/messages`)
      const msgData = await msgRes.json()
      if (msgData.messages) {
        const loaded: CompactMessage[] = msgData.messages.map((m: any) => {
          const id = m.id || `m-${Date.now()}-${Math.random()}`
          seenMsgIdsRef.current.add(id)
          return {
            id,
            role: m.role || m.type || 'assistant',
            content: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || ''),
            timestamp: m.timestamp || Date.now(),
            blocks: m.blocks,
          }
        })
        setMessages(loaded)
      }
      await loadTasks()
    } catch (e) {
      console.error('[Compact] restore error:', e)
      setSessionId(null)
      sessionIdRef.current = null
      localStorage.removeItem('compact-session-id')
    }
  }

  function connectSSE() {
    if (eventSourceRef.current) return
    const es = new EventSource(`${API_BASE}/api/events`)
    eventSourceRef.current = es

    es.addEventListener('session:message-appended', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        const currentSid = sessionIdRef.current
        if (data.sessionId && data.sessionId !== currentSid) return

        const m = data.message
        if (!m) return
        const msgId = m.id || `sse-${Date.now()}-${Math.random()}`
        if (seenMsgIdsRef.current.has(msgId)) return
        seenMsgIdsRef.current.add(msgId)

        let content = ''
        let blocks = m.blocks
        if (typeof m.content === 'string') {
          content = m.content
        } else if (Array.isArray(m.content)) {
          content = m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
          if (!blocks) {
            blocks = m.content.map((c: any) => {
              if (c.type === 'text') return { type: 'text', text: c.text }
              if (c.type === 'tool_use') return { type: 'tool_use', id: c.id, name: c.name, input: c.input, status: 'completed' }
              return c
            })
          }
        }

        // Normalize block fields: ensure tool_use blocks have 'name'
        if (Array.isArray(blocks)) {
          blocks = blocks.map((b: any) => {
            if (b.type === 'tool_use' && !b.name && b.toolName) {
              return { ...b, name: b.toolName }
            }
            return b
          })
        }

        // Associate with the currently running task (if any)
        const runningTaskId = tasksRef.current.find(t => t.status === 'in_progress')?.id

        const msg: CompactMessage = {
          id: msgId,
          role: m.type === 'user' ? 'user' : m.type === 'tool_result' ? (m.isError ? 'tool_error' : 'tool_result') : 'assistant',
          content,
          timestamp: m.timestamp || Date.now(),
          blocks,
          taskId: runningTaskId,
        }
        setMessages(prev => [...prev, msg])
      } catch (err) {
        console.error('[Compact] SSE parse error:', err)
      }
    })

    es.addEventListener('executor:task-claimed', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        if (taskIdsRef.current.has(data.taskId)) {
          setTasks(prev => prev.map(t => t.id === data.taskId ? { ...t, status: 'in_progress' } : t))
        }
      } catch {}
    })

    es.addEventListener('executor:task-completed', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        if (taskIdsRef.current.has(data.taskId)) {
          loadTasks()
        }
      } catch {}
    })

    es.addEventListener('executor:task-progress', (e: any) => {
      // Progress events are streaming deltas — do NOT add as messages.
      // Full messages arrive via session:message-appended.
    })

    es.addEventListener('approval:required', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        // Skip if popup already showing for this task (prevents flicker from re-emitted events)
        const current = approvalPopupRef.current
        if (current && current.taskId === data.taskId && !current.resolving) return
        // Show popup for any approval event
        const task = tasksRef.current.find(t => t.id === data.taskId)
        const isCheckpoint = task?.status === 'paused' && task?.checkpointAfter === true
        setApprovalPopup({
          taskId: data.taskId,
          taskTitle: data.taskTitle || data.taskId,
          message: data.approvalMessage || 'Approval required',
          isCheckpoint,
          resolving: false,
        })
        loadTasks()
      } catch {
        // ignore parse errors
      }
    })

    es.addEventListener('approval:resolved', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        const current = approvalPopupRef.current
        if (current && current.taskId === data.taskId) {
          setApprovalPopup(null)
          approvalPopupRef.current = null
        }
      } catch {}
    })

    es.addEventListener('tool:start', () => {})
    es.addEventListener('tool:result', () => {})
    es.addEventListener('tool:error', () => {})

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setTimeout(connectSSE, 3000)
    }
  }

  function disconnectSSE() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }

  async function approveTask(taskId: string, action: 'execute' | 'later' | 'abort' | 'continue' | 'retry' | 'stop') {
    setApprovalPopup(prev => prev ? { ...prev, resolving: true } : null)
    approvalPopupRef.current = approvalPopupRef.current ? { ...approvalPopupRef.current, resolving: true } : null
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await loadTasks()
    } catch (e) {
      console.error('[Compact] approve error:', e)
    } finally {
      setApprovalPopup(null)
      approvalPopupRef.current = null
    }
  }

  async function loadTasks() {
    try {
      const currentSid = sessionIdRef.current
      const res = await fetch(`${API_BASE}/api/tasks`)
      const data = await res.json()
      if (data.tasks) {
        const myTasks = data.tasks.filter((t: any) => currentSid && t.sessionId === currentSid)
        const compact: CompactTask[] = myTasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assignee: t.assignee,
          dependsOn: t.dependsOn,
          condition: t.condition,
          loop: t.loop,
          checkpointAfter: t.checkpointAfter,
          checkpointMessage: t.checkpointMessage,
          requiresApproval: t.requiresApproval,
          approvalMessage: t.approvalMessage,
          description: t.description,
          lastError: t.lastError,
        }))
        if (taskOrderRef.current.length > 0) {
          const orderMap = new Map(taskOrderRef.current.map((id, idx) => [id, idx]))
          compact.sort((a, b) => {
            const oa = orderMap.get(a.id) ?? 9999
            const ob = orderMap.get(b.id) ?? 9999
            return oa - ob
          })
        }
        setTasks(compact)
        taskIdsRef.current = new Set(compact.map(t => t.id))
      }
    } catch {}
  }

  async function handleStart(filePath: string, params?: Record<string, string>) {
    try {
      setIsLoading(true)
      setTemplateConfirm(prev => prev ? { ...prev, loading: true } : null)
      // Always create a new session — don't reuse old one
      const res = await fetch(`${API_BASE}/api/compact/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, params }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        return
      }
      // Clear old state
      setMessages([])
      seenMsgIdsRef.current.clear()
      setSessionId(data.sessionId)
      sessionIdRef.current = data.sessionId
      setWorkflowName(data.workflow)
      const newTasks: CompactTask[] = data.tasks.map((t: any) => ({
        id: t.id, title: t.title, status: t.status, assignee: t.assignee, dependsOn: t.dependsOn,
        condition: t.condition, loop: t.loop,
        checkpointAfter: t.checkpointAfter, checkpointMessage: t.checkpointMessage,
        requiresApproval: t.requiresApproval, approvalMessage: t.approvalMessage,
      }))
      taskOrderRef.current = newTasks.map(t => t.id)
      setTasks(newTasks)
      taskIdsRef.current = new Set(newTasks.map(t => t.id))
      setWorkflowExpanded(true)
      setTemplateConfirm(null)
    } catch (e) {
      console.error('[Compact] start error:', e)
      alert('Failed to start workflow')
      setTemplateConfirm(prev => prev ? { ...prev, loading: false } : null)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return
    const text = input.trim()

    // Intent recognition: check if message matches a template
    if (!sessionIdRef.current && tasks.length === 0) {
      try {
        const intentRes = await fetch(`${API_BASE}/api/chat/intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
        const intentData = await intentRes.json()
        if (intentData.matched && intentData.template) {
          const defaultParams: Record<string, string> = {}
          for (const p of intentData.template.params || []) {
            defaultParams[p.name] = p.default != null ? String(p.default) : 'localhost'
          }
          setTemplateConfirm({
            template: intentData.template,
            enhancement: intentData.enhancement,
            params: defaultParams,
            loading: false,
          })
          return
        }
      } catch (e) {
        console.error('[Compact] intent recognition failed:', e)
      }
    }

    setInput('')

    const userMsgId = `user-${Date.now()}`
    seenMsgIdsRef.current.add(userMsgId)
    const userMsg: CompactMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])

    let sid = sessionIdRef.current
    if (!sid) {
      try {
        const res = await fetch(`${API_BASE}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 50) }),
        })
        const data = await res.json()
        if (data.session) {
          sid = data.session.id
          setSessionId(sid)
          sessionIdRef.current = sid
        }
      } catch {}
    }

    setIsLoading(true)
    setStreamingText('')

    try {
      const abortController = new AbortController()
      chatAbortRef.current = abortController

      const res = await fetch(`${API_BASE}/api/chat/sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: { text },
          sessionId: sid || undefined,
          keepOpen: true,
        }),
        signal: abortController.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let newSessionId = ''

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
                setStreamingText(data.text)
              } else if (currentEvent === 'message') {
                setStreamingText('')
                if (data.role !== 'user') {
                  const msgId = data.id || `msg-${Date.now()}-${Math.random()}`
                  if (seenMsgIdsRef.current.has(msgId)) continue
                  seenMsgIdsRef.current.add(msgId)
                  const msg: CompactMessage = {
                    id: msgId,
                    role: data.role || 'assistant',
                    content: data.content || '',
                    timestamp: Date.now(),
                    blocks: data.blocks,
                  }
                  setMessages(prev => [...prev, msg])
                }
              } else if (currentEvent === 'done') {
                newSessionId = data.sessionId
              } else if (currentEvent === 'error') {
                console.error('[Compact] chat error:', data.message)
              }
            } catch {}
          }
        }
      }

      if (newSessionId && !sid) {
        setSessionId(newSessionId)
        sessionIdRef.current = newSessionId
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('[Compact] send error:', e)
      }
    } finally {
      setIsLoading(false)
      setStreamingText('')
      chatAbortRef.current = null
    }
  }

  function handleCancel() {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort()
      chatAbortRef.current = null
    }
    fetch(`${API_BASE}/api/chat/cancel`, { method: 'POST' }).catch(() => {})
    setIsLoading(false)
    setStreamingText('')
  }

  async function handleNewSession() {
    setSessionId(null)
    sessionIdRef.current = null
    setMessages([])
    setTasks([])
    taskOrderRef.current = []
    setWorkflowName(null)
    setWorkflowExpanded(false)
    setStreamingText('')
    setInput('')
    seenMsgIdsRef.current = new Set()
    localStorage.removeItem('compact-session-id')
    localStorage.removeItem('compact-task-order')
  }

  async function handleHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`)
      const data = await res.json()
      setSessions(data.sessions || [])
      setShowHistory(true)
    } catch {}
  }

  async function handleSelectSession(sid: string) {
    setSessionId(sid)
    sessionIdRef.current = sid
    setMessages([])
    setTasks([])
    taskOrderRef.current = []
    setWorkflowName(null)
    setWorkflowExpanded(false)
    setShowHistory(false)
    seenMsgIdsRef.current = new Set()
    await restoreSession(sid)
  }

  async function handleToggleExecutor() {
    try {
      if (executorRunning) {
        // Show pause/cancel choice instead of immediately stopping
        setStopChoice(true)
        return
      }
      const res = await fetch(`${API_BASE}/api/executor/start`, { method: 'POST' })
      const data = await res.json()
      setExecutorRunning(data.running !== false)
    } catch (e) {
      console.error('[Compact] executor toggle error:', e)
    }
  }

  async function handleStopChoice(choice: 'pause' | 'cancel') {
    setStopChoice(false)
    try {
      if (choice === 'pause') {
        await fetch(`${API_BASE}/api/executor/stop`, { method: 'POST' })
        setExecutorRunning(false)
      } else {
        // Cancel all running tasks
        const runningTasks = tasks.filter(t => t.status === 'in_progress')
        for (const t of runningTasks) {
          await fetch(`${API_BASE}/api/tasks/${t.id}/cancel`, { method: 'POST' })
        }
        await fetch(`${API_BASE}/api/executor/stop`, { method: 'POST' })
        setExecutorRunning(false)
      }
    } catch (e) {
      console.error('[Compact] stop choice error:', e)
    }
  }

  async function syncExecutorStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/executor/status`)
      const data = await res.json()
      setExecutorRunning(data.running === true)
    } catch {}
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasWorkflow = tasks.length > 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100%', maxWidth: 560,
      margin: '0 auto',
      backgroundColor: 'var(--surface-0)',
      fontFamily: sans,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 10px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--surface-1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
          <Cpu size={14} color="var(--amber)" strokeWidth={1.5} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: mono, letterSpacing: '0.05em' }}>IRG</span>
        </div>
        <div style={{ flex: 1 }} />
        <ToolbarButton icon={<Plus size={12} />} label="New" onClick={handleNewSession} />
        <div style={{ position: 'relative' }}>
          <ToolbarButton icon={<History size={12} />} label="History" onClick={handleHistory} />
          {showHistory && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 100,
              width: 260, maxHeight: 300, overflow: 'auto',
              backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-medium)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              {sessions.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-faint)', fontSize: 11 }}>No sessions</div>
              )}
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px',
                    background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || s.id}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: mono }}>
                    {s.messageCount || 0} msgs · {new Date(s.updatedAt || s.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolbarButton
          icon={<Play size={12} />}
          label="Start"
          onClick={() => setShowPicker(true)}
          accent
          disabled={isLoading}
        />
        <ToolbarButton
          icon={executorRunning ? <Pause size={12} /> : <Play size={12} />}
          label={executorRunning ? 'Pause' : 'Run'}
          onClick={handleToggleExecutor}
          disabled={!hasWorkflow}
          accent={executorRunning}
        />
      </div>

      {/* Middle Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Workflow Rail (collapsed) */}
        {hasWorkflow && !workflowExpanded && (
          <WorkflowRail tasks={tasks} onExpand={() => setWorkflowExpanded(true)} />
        )}

        {/* Chat Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '8px 0',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {/* Approval needed banner — only show when popup not visible */}
          {tasks.some(t => t.requiresApproval || t.status === 'paused') && !approvalPopup && (
            <div style={{
              margin: '0 10px 6px', padding: '6px 10px',
              backgroundColor: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.4)',
              borderLeft: '3px solid #fbbf24',
              borderRadius: 2,
              fontSize: 10, fontFamily: mono, color: '#fbbf24',
              display: 'flex', alignItems: 'center', gap: 6,
              fontWeight: 600,
            }}>
              <Clock size={11} />
              <span>Waiting: {tasks.filter(t => t.requiresApproval || t.status === 'paused').map(t => t.title).join(', ')}</span>
            </div>
          )}
          {messages.length === 0 && !streamingText && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-faint)', fontSize: 12, fontFamily: mono,
              flexDirection: 'column', gap: 8,
            }}>
              <Cpu size={24} color="var(--text-faint)" strokeWidth={1} />
              <span>Ready to assist</span>
              <span style={{ fontSize: 10 }}>Click Start to load a workflow, or type a message</span>
            </div>
          )}

          {messages.map((msg, i) => {
            const prevMsg = i > 0 ? messages[i - 1] : null
            const prevTaskId = prevMsg?.taskId
            const showSystemEvent = msg.taskId && msg.taskId !== prevTaskId && msg.role !== 'system'
            const taskForEvent = tasks.find(t => t.id === msg.taskId)

            return (
              <React.Fragment key={msg.id}>
                {showSystemEvent && taskForEvent && taskForEvent.status !== 'todo' && (
                  <SystemEventTag task={taskForEvent} tasks={tasks} />
                )}
                <MessageBubble msg={msg} tasks={tasks} />
              </React.Fragment>
            )
          })}

          {streamingText && (
            <div style={{ padding: '2px 10px' }}>
              <div style={{
                padding: '6px 10px',
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2, fontSize: 12, lineHeight: 1.55,
                color: 'var(--text-secondary)', fontFamily: sans,
              }}>
                {streamingText}
                <span style={{ display: 'inline-block', width: 6, height: 12, backgroundColor: 'var(--amber)', marginLeft: 2, animation: 'blink 1s step-end infinite' }} />
                <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
              </div>
            </div>
          )}

          {isLoading && !streamingText && (
            <div style={{ padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, fontFamily: mono }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Thinking...
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Workflow Overlay (expanded) */}
        {hasWorkflow && workflowExpanded && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(12,12,12,0.88)',
            backdropFilter: 'blur(4px)',
            zIndex: 50,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Overlay header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(0,0,0,0.7)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Workflow
                </span>
                {workflowName && (
                  <span style={{ fontSize: 10, color: '#d4d4d4', fontFamily: mono }}>
                    — {workflowName}
                  </span>
                )}
              </div>
              <button
                onClick={() => setWorkflowExpanded(false)}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 2, cursor: 'pointer', padding: '3px 8px',
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: '#d4d4d4', fontSize: 10, fontFamily: mono,
                }}
              >
                <ChevronLeft size={10} />
                Collapse
              </button>
            </div>

            {/* Workflow steps */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {tasks.map((task, idx) => {
                const cfg = statusConfig[task.status] || statusConfig.todo
                const color = getTaskColor(task.id, tasks)
                const isActive = task.status === 'in_progress'
                const isLast = idx === tasks.length - 1
                const hasCondition = !!task.condition
                const hasLoop = !!task.loop
                const hasCheckpoint = !!task.checkpointAfter

                // Convert hex color to rgba with proper alpha for visibility
                const hexToRgba = (hex: string, alpha: number) => {
                  const r = parseInt(hex.slice(1, 3), 16)
                  const g = parseInt(hex.slice(3, 5), 16)
                  const b = parseInt(hex.slice(5, 7), 16)
                  return `rgba(${r},${g},${b},${alpha})`
                }

                return (
                  <div key={task.id} style={{
                    marginLeft: 0, position: 'relative',
                    opacity: task.status === 'skipped' ? 0.45 : 1,
                  }}>
                    <div style={{
                      position: 'absolute', left: 9, top: 0,
                      bottom: isLast ? 16 : 0, width: 2,
                      backgroundColor: 'rgba(255,255,255,0.15)',
                    }} />

                    <div style={{
                      display: 'flex', alignItems: 'stretch', gap: 10, padding: '6px 0',
                    }}>
                      {/* Status dot */}
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        backgroundColor: isActive ? hexToRgba(color, 0.4) : hexToRgba(color, 0.2),
                        border: `2px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 3,
                        animation: isActive ? 'pulse 2s infinite' : undefined,
                        boxShadow: isActive ? `0 0 10px ${hexToRgba(color, 0.6)}` : 'none',
                        zIndex: 1,
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                      </div>

                      {/* Task card */}
                      <div style={{
                        flex: 1, minWidth: 0,
                        backgroundColor: isActive ? hexToRgba(color, 0.15) : 'rgba(40,40,40,0.8)',
                        border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.15)'}`,
                        borderRadius: 3, padding: '8px 10px',
                      }}>
                        {/* Badges row (static, no animation) */}
                        {(hasCondition || hasLoop || hasCheckpoint) && (
                          <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
                            {hasCondition && (
                              <span style={{
                                fontSize: 9, fontFamily: mono, fontWeight: 700,
                                padding: '2px 6px',
                                backgroundColor: 'rgba(251,191,36,0.25)',
                                color: '#fbbf24',
                                border: '1px solid #fbbf24',
                                borderRadius: 2,
                              }}>
                                {task.condition?.type === 'llm_judge' ? 'LLM?' : `IF=${task.condition?.equals || '?'}`}
                              </span>
                            )}
                            {hasLoop && (
                              <span style={{
                                fontSize: 9, fontFamily: mono, fontWeight: 700,
                                padding: '2px 6px',
                                backgroundColor: 'rgba(196,181,253,0.25)',
                                color: '#c4b5fd',
                                border: '1px solid #c4b5fd',
                                borderRadius: 2,
                              }}>
                                ⟳ ×{task.loop?.max}
                              </span>
                            )}
                            {hasCheckpoint && (
                              <span style={{
                                fontSize: 9, fontFamily: mono, fontWeight: 700,
                                padding: '2px 6px',
                                backgroundColor: 'rgba(134,239,172,0.25)',
                                color: '#86efac',
                                border: '1px solid #86efac',
                                borderRadius: 2,
                              }}>
                                ⏸ CP
                              </span>
                            )}
                          </div>
                        )}

                        {/* Title + status row */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          justifyContent: 'space-between',
                        }}>
                          <span style={{
                            fontSize: 13, fontWeight: 700,
                            color: task.status === 'skipped' ? '#94a3b8' : '#ffffff',
                            fontFamily: sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                          }}>
                            {task.title}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 10, color: cfg.color, fontFamily: mono,
                              display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700,
                              backgroundColor: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: 2,
                            }}>
                              {cfg.icon} {cfg.label}
                            </span>
                            {task.assignee && (
                              <span style={{
                                fontSize: 9, color: '#e8e0d4', fontFamily: mono,
                                backgroundColor: 'rgba(0,0,0,0.4)', padding: '1px 5px',
                                borderRadius: 2, fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)',
                              }}>
                                @{task.assignee}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description (visible for active/failed tasks) */}
                        {task.description && (isActive || task.status === 'failed') && (
                          <div style={{
                            marginTop: 5, fontSize: 11, fontFamily: mono,
                            color: task.status === 'failed' ? '#fca5a5' : '#e8e0d4',
                            lineHeight: 1.45,
                            padding: '4px 6px',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            borderRadius: 2,
                            maxHeight: 80, overflow: 'auto',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}>
                            {task.description.slice(0, 400)}
                          </div>
                        )}

                        {/* Error summary for failed tasks */}
                        {task.status === 'failed' && task.lastError && (
                          <div style={{
                            marginTop: 5, fontSize: 11, fontFamily: mono,
                            color: '#fca5a5', lineHeight: 1.45,
                            padding: '5px 8px',
                            backgroundColor: 'rgba(252,165,165,0.1)',
                            borderRadius: 2,
                            border: '1px solid rgba(252,165,165,0.3)',
                            borderLeft: '3px solid #fca5a5',
                            display: 'flex', alignItems: 'flex-start', gap: 5,
                          }}>
                            <XCircle size={11} color="#fca5a5" style={{ marginTop: 1, flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {task.lastError}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
            </div>

            {/* Progress summary */}
            {tasks.length > 0 && (
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--border-medium)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: mono, flexWrap: 'wrap' }}>
                  {tasks.filter(t => t.status === 'in_progress').length > 0 && (
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>{tasks.filter(t => t.status === 'in_progress').length} running</span>
                  )}
                  {tasks.filter(t => t.status === 'done').length > 0 && (
                    <span style={{ color: '#86efac', fontWeight: 700 }}>{tasks.filter(t => t.status === 'done').length} done</span>
                  )}
                  {tasks.filter(t => t.status === 'failed').length > 0 && (
                    <span style={{ color: '#fca5a5', fontWeight: 700 }}>{tasks.filter(t => t.status === 'failed').length} failed</span>
                  )}
                  <span style={{ color: '#d4d4d4', fontWeight: 600 }}>
                    {tasks.filter(t => t.status === 'todo').length} pending
                  </span>
                </div>
                <div style={{ marginTop: 6, height: 4, backgroundColor: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                  {(() => {
                    const done = tasks.filter(t => t.status === 'done').length
                    const total = tasks.length
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0
                    return <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#86efac', borderRadius: 2, transition: 'width 0.3s' }} />
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Input */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--surface-1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sessionId ? 'Type a message...' : 'Type a message to start...'}
            rows={1}
            style={{
              flex: 1, resize: 'none',
              minHeight: 32, maxHeight: 100,
              padding: '6px 8px',
              fontSize: 12, fontFamily: sans,
              backgroundColor: 'var(--surface-0)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 2,
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          {isLoading ? (
            <button
              onClick={handleCancel}
              style={{
                width: 32, height: 32, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--warm-red)', border: 'none',
                borderRadius: 2, cursor: 'pointer', color: '#fff',
              }}
            >
              <Square size={12} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: 32, height: 32, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: input.trim() ? 'var(--amber)' : 'var(--surface-2)',
                border: 'none', borderRadius: 2,
                cursor: input.trim() ? 'pointer' : 'default',
                color: input.trim() ? '#0c0c0c' : 'var(--text-muted)',
                transition: 'background-color 0.15s',
              }}
            >
              <Send size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Proposal Picker Modal */}
      <ProposalPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleStart}
      />

      {/* Approval Popup */}
      {approvalPopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #fbbf24',
            borderRadius: 4,
            padding: '20px 24px',
            maxWidth: 380,
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(251,191,36,0.3)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12,
            }}>
              <Clock size={18} color="#fbbf24" />
              <span style={{
                fontSize: 14, fontWeight: 700, color: '#fbbf24',
                fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {approvalPopup.isCheckpoint ? 'Checkpoint' : 'Approval Required'}
              </span>
            </div>
            <div style={{
              fontSize: 13, color: '#ffffff', fontWeight: 600,
              fontFamily: sans, marginBottom: 8,
            }}>
              {approvalPopup.taskTitle}
            </div>
            <div style={{
              fontSize: 12, color: '#d4d4d4', fontFamily: mono,
              lineHeight: 1.5, marginBottom: 16,
              padding: '8px 10px',
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)',
            }}>
              {approvalPopup.message}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => approveTask(approvalPopup.taskId, 'execute')}
                disabled={approvalPopup.resolving}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 700,
                  fontFamily: mono, cursor: approvalPopup.resolving ? 'not-allowed' : 'pointer',
                  backgroundColor: '#86efac', color: '#000',
                  border: '1px solid #86efac', borderRadius: 2,
                  opacity: approvalPopup.resolving ? 0.6 : 1,
                }}
              >
                {approvalPopup.resolving ? '...' : '✓ Approve & Continue'}
              </button>
              <button
                onClick={() => approveTask(approvalPopup.taskId, 'later')}
                disabled={approvalPopup.resolving}
                style={{
                  padding: '8px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: mono, cursor: approvalPopup.resolving ? 'not-allowed' : 'pointer',
                  backgroundColor: 'rgba(0,0,0,0.4)', color: '#d4d4d4',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2,
                  opacity: approvalPopup.resolving ? 0.6 : 1,
                }}
              >
                Later
              </button>
              <button
                onClick={() => approveTask(approvalPopup.taskId, 'abort')}
                disabled={approvalPopup.resolving}
                style={{
                  padding: '8px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: mono, cursor: approvalPopup.resolving ? 'not-allowed' : 'pointer',
                  backgroundColor: 'rgba(0,0,0,0.4)', color: '#fca5a5',
                  border: '1px solid #fca5a5', borderRadius: 2,
                  opacity: approvalPopup.resolving ? 0.6 : 1,
                }}
              >
                ✕ Abort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Confirmation Popup */}
      {templateConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #7dd3fc',
            borderRadius: 4,
            padding: '20px 24px',
            maxWidth: 460,
            width: '90%',
            maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(125,211,252,0.3)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12,
            }}>
              <FileText size={18} color="#7dd3fc" />
              <span style={{
                fontSize: 14, fontWeight: 700, color: '#7dd3fc',
                fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Template Matched
              </span>
            </div>
            <div style={{
              fontSize: 15, color: '#ffffff', fontWeight: 600,
              fontFamily: sans, marginBottom: 4,
            }}>
              {templateConfirm.template.name}
            </div>
            {templateConfirm.template.description && (
              <div style={{
                fontSize: 11, color: '#a1a1aa', fontFamily: mono,
                marginBottom: 12, lineHeight: 1.4,
              }}>
                {templateConfirm.template.description}
              </div>
            )}

            {/* Params */}
            {templateConfirm.template.params?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: '#7dd3fc',
                  fontFamily: mono, textTransform: 'uppercase',
                  marginBottom: 6, letterSpacing: '0.1em',
                }}>
                  Parameters (defaults shown, edit if needed)
                </div>
                {templateConfirm.template.params.map((p: any) => (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 4,
                  }}>
                    <label style={{
                      fontSize: 11, color: '#d4d4d4', fontFamily: mono,
                      minWidth: 100,
                    }}>{p.label}</label>
                    <input
                      type="text"
                      value={templateConfirm.params[p.name] || ''}
                      onChange={(e) => setTemplateConfirm(prev => prev ? {
                        ...prev,
                        params: { ...prev.params, [p.name]: e.target.value },
                      } : null)}
                      style={{
                        flex: 1, padding: '4px 8px', fontSize: 11,
                        fontFamily: mono, color: '#ffffff',
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 2, outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Nodes */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: '#7dd3fc',
                fontFamily: mono, textTransform: 'uppercase',
                marginBottom: 6, letterSpacing: '0.1em',
              }}>
                Workflow Nodes ({templateConfirm.template.nodes?.length || 0})
              </div>
              {templateConfirm.template.nodes?.map((node: any, i: number) => {
                const enriched = templateConfirm.enhancement?.enrichedDescriptions?.[node.id]
                return (
                  <div key={node.id} style={{
                    padding: '6px 8px', marginBottom: 3,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11, fontWeight: 600, color: '#ffffff',
                      fontFamily: mono,
                    }}>
                      <span style={{ color: '#7dd3fc' }}>{i + 1}.</span>
                      {node.name}
                      {node.agent && (
                        <span style={{
                          fontSize: 9, color: '#a1a1aa',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          padding: '1px 4px', borderRadius: 2,
                        }}>{node.agent}</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 10, color: '#a1a1aa', fontFamily: mono,
                      marginTop: 2, lineHeight: 1.4,
                    }}>
                      {enriched || node.description || 'No description'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* PM warnings/suggestions */}
            {(templateConfirm.enhancement?.warnings?.length > 0 || templateConfirm.enhancement?.suggestions?.length > 0) && (
              <div style={{
                marginBottom: 12, padding: '8px 10px',
                backgroundColor: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderLeft: '3px solid #fbbf24',
                borderRadius: 2,
              }}>
                {templateConfirm.enhancement.warnings?.map((w: string, i: number) => (
                  <div key={`w${i}`} style={{
                    fontSize: 10, color: '#fbbf24', fontFamily: mono,
                    marginBottom: 2, lineHeight: 1.4,
                  }}>⚠ {w}</div>
                ))}
                {templateConfirm.enhancement.suggestions?.map((s: string, i: number) => (
                  <div key={`s${i}`} style={{
                    fontSize: 10, color: '#86efac', fontFamily: mono,
                    marginBottom: 2, lineHeight: 1.4,
                  }}>✓ {s}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleStart(templateConfirm.template.filename, templateConfirm.params)}
                disabled={templateConfirm.loading}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 700,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: '#86efac', color: '#000',
                  border: '1px solid #86efac', borderRadius: 2,
                }}
              >
                {templateConfirm.loading ? '...' : '✓ Confirm & Start'}
              </button>
              <button
                onClick={() => setTemplateConfirm(null)}
                style={{
                  padding: '8px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: 'rgba(0,0,0,0.4)', color: '#d4d4d4',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Choice Popup */}
      {stopChoice && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #fbbf24',
            borderRadius: 4,
            padding: '20px 24px',
            maxWidth: 340,
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(251,191,36,0.3)',
          }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: '#fbbf24',
              fontFamily: mono, textTransform: 'uppercase',
              marginBottom: 8, letterSpacing: '0.05em',
            }}>
              Stop Execution
            </div>
            <div style={{
              fontSize: 12, color: '#d4d4d4', fontFamily: mono,
              marginBottom: 16, lineHeight: 1.5,
            }}>
              Choose how to stop. Pause keeps tasks resumable; Cancel marks them as cancelled (terminal).
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleStopChoice('pause')}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 700,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: '#60a5fa', color: '#000',
                  border: '1px solid #60a5fa', borderRadius: 2,
                }}
              >
                ⏸ Pause
              </button>
              <button
                onClick={() => handleStopChoice('cancel')}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 700,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: '#fca5a5', color: '#000',
                  border: '1px solid #fca5a5', borderRadius: 2,
                }}
              >
                ✕ Cancel
              </button>
              <button
                onClick={() => setStopChoice(false)}
                style={{
                  padding: '8px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: 'rgba(0,0,0,0.4)', color: '#d4d4d4',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2,
                }}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close history */}
      {showHistory && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          onClick={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

function ToolbarButton({ icon, label, onClick, accent, disabled }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  accent?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', fontSize: 10, fontFamily: mono, fontWeight: 500,
        backgroundColor: accent ? 'var(--amber)' : 'transparent',
        border: accent ? 'none' : '1px solid var(--border-subtle)',
        borderRadius: 2,
        color: accent ? '#0c0c0c' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        letterSpacing: '0.03em',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

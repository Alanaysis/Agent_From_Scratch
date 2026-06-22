'use client'

import * as React from 'react'
import {
  Plus, History, Play, Pause, Send, Square, Loader2,
  CheckCircle, XCircle, Clock, ChevronRight, ChevronDown,
  Wrench, Cpu, Bot, ChevronLeft, Maximize2
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
  todo: { color: 'var(--text-muted)', icon: <ChevronRight size={10} />, label: 'Pending' },
  in_progress: { color: 'var(--amber)', icon: <Loader2 size={10} />, label: 'Running' },
  verify: { color: 'var(--status-purple)', icon: <Clock size={10} />, label: 'Verify' },
  done: { color: 'var(--status-green)', icon: <CheckCircle size={10} />, label: 'Done' },
  failed: { color: 'var(--warm-red)', icon: <XCircle size={10} />, label: 'Failed' },
  skipped: { color: 'var(--text-faint)', icon: <ChevronRight size={10} />, label: 'Skipped' },
}

interface CompactTask {
  id: string
  title: string
  status: string
  assignee?: string
  dependsOn?: string[]
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
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{block.toolName}</span>
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

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const chatAbortRef = React.useRef<AbortController | null>(null)
  const taskIdsRef = React.useRef<Set<string>>(new Set())
  const sessionIdRef = React.useRef<string | null>(null)
  const seenMsgIdsRef = React.useRef<Set<string>>(new Set())
  const taskOrderRef = React.useRef<string[]>([])

  React.useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

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
        if (typeof m.content === 'string') {
          content = m.content
        } else if (Array.isArray(m.content)) {
          content = m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
        }

        const msg: CompactMessage = {
          id: msgId,
          role: m.type === 'user' ? 'user' : m.type === 'tool_result' ? (m.isError ? 'tool_error' : 'tool_result') : 'assistant',
          content,
          timestamp: m.timestamp || Date.now(),
          blocks: m.blocks,
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
      try {
        const data = JSON.parse(e.data)
        if (taskIdsRef.current.has(data.taskId)) {
          const msgId = `progress-${data.taskId}-${Date.now()}`
          if (seenMsgIdsRef.current.has(msgId)) return
          seenMsgIdsRef.current.add(msgId)
          const msg: CompactMessage = {
            id: msgId,
            role: 'assistant',
            content: data.text || '',
            timestamp: Date.now(),
            taskId: data.taskId,
          }
          setMessages(prev => [...prev, msg])
        }
      } catch {}
    })

    es.addEventListener('approval:required', () => {
      setWorkflowExpanded(false)
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

        const hasFailed = compact.some(t => t.status === 'failed')
        if (hasFailed && workflowExpanded) {
          setWorkflowExpanded(false)
        }
      }
    } catch {}
  }

  async function handleStart(filePath: string) {
    try {
      setIsLoading(true)
      const currentSid = sessionIdRef.current
      const res = await fetch(`${API_BASE}/api/compact/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, sessionId: currentSid || undefined }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        return
      }
      setSessionId(data.sessionId)
      sessionIdRef.current = data.sessionId
      setWorkflowName(data.workflow)
      const newTasks: CompactTask[] = data.tasks.map((t: any) => ({
        id: t.id, title: t.title, status: t.status, assignee: t.assignee, dependsOn: t.dependsOn,
      }))
      taskOrderRef.current = newTasks.map(t => t.id)
      setTasks(newTasks)
      taskIdsRef.current = new Set(newTasks.map(t => t.id))
      setWorkflowExpanded(true)
    } catch (e) {
      console.error('[Compact] start error:', e)
      alert('Failed to start workflow')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return
    const text = input.trim()
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
    if (executorRunning) {
      await fetch(`${API_BASE}/api/executor/stop`, { method: 'POST' })
      setExecutorRunning(false)
    } else {
      await fetch(`${API_BASE}/api/executor/start`, { method: 'POST' })
      setExecutorRunning(true)
    }
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
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(20,20,20,0.6)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Workflow
                </span>
                {workflowName && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: mono }}>
                    — {workflowName}
                  </span>
                )}
              </div>
              <button
                onClick={() => setWorkflowExpanded(false)}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  borderRadius: 2, cursor: 'pointer', padding: '3px 8px',
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: 'var(--text-muted)', fontSize: 10, fontFamily: mono,
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

                return (
                  <div key={task.id} style={{
                    marginLeft: 0, position: 'relative',
                    opacity: task.status === 'skipped' ? 0.45 : 1,
                  }}>
                    <div style={{
                      position: 'absolute', left: 7, top: 0,
                      bottom: isLast ? 16 : 0, width: 1,
                      backgroundColor: 'var(--border-medium)',
                    }} />
                    <div style={{
                      display: 'flex', alignItems: 'stretch', gap: 8, padding: '5px 0',
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        backgroundColor: `${color}15`,
                        border: `2px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 2,
                        animation: isActive ? 'pulse 2s infinite' : undefined,
                      }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: color }} />
                      </div>
                      <div style={{
                        flex: 1, minWidth: 0,
                        backgroundColor: isActive ? `${color}10` : 'var(--surface-1)',
                        border: `1px solid ${isActive ? color : 'var(--border-subtle)'}`,
                        borderRadius: 3, padding: '5px 8px',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          justifyContent: 'space-between',
                        }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: task.status === 'skipped' ? 'var(--text-faint)' : 'var(--text-primary)',
                            fontFamily: sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {task.title}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 9, color: cfg.color, fontFamily: mono,
                              display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500,
                            }}>
                              {cfg.icon} {cfg.label}
                            </span>
                            {task.assignee && (
                              <span style={{
                                fontSize: 8, color: 'var(--text-faint)', fontFamily: mono,
                                backgroundColor: 'var(--surface-2)', padding: '0 4px',
                                borderRadius: 2, height: 14, lineHeight: '14px',
                              }}>
                                @{task.assignee}
                              </span>
                            )}
                          </div>
                        </div>
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
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(20,20,20,0.6)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: mono, flexWrap: 'wrap' }}>
                  {tasks.filter(t => t.status === 'in_progress').length > 0 && (
                    <span style={{ color: 'var(--amber)' }}>{tasks.filter(t => t.status === 'in_progress').length} running</span>
                  )}
                  {tasks.filter(t => t.status === 'done').length > 0 && (
                    <span style={{ color: 'var(--status-green)' }}>{tasks.filter(t => t.status === 'done').length} done</span>
                  )}
                  {tasks.filter(t => t.status === 'failed').length > 0 && (
                    <span style={{ color: 'var(--warm-red)' }}>{tasks.filter(t => t.status === 'failed').length} failed</span>
                  )}
                  <span style={{ color: 'var(--text-faint)' }}>
                    {tasks.filter(t => t.status === 'todo').length} pending
                  </span>
                </div>
                <div style={{ marginTop: 6, height: 4, backgroundColor: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                  {(() => {
                    const done = tasks.filter(t => t.status === 'done').length
                    const total = tasks.length
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0
                    return <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--status-green)', borderRadius: 2, transition: 'width 0.3s' }} />
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

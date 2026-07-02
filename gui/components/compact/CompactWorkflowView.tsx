'use client'

import * as React from 'react'
import {
  Plus, History, Play, Pause, Send, Square, Loader2,
  CheckCircle, XCircle, Clock, ChevronRight, ChevronDown,
  Wrench, Cpu, Bot, ChevronLeft, Maximize2, FileText, Trash2
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

function getStatusConfig(task: CompactTask) {
  if (task.status === 'paused' && task.lastError) {
    return { color: '#fca5a5', icon: <XCircle size={10} />, label: 'Failed' }
  }
  return statusConfig[task.status] || statusConfig.todo
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
  const cfg = getStatusConfig(task)
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

function MessageBubble({ msg, tasks, allMessages }: { msg: CompactMessage; tasks: CompactTask[]; allMessages: CompactMessage[] }) {
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
    // Try to parse tool result content for friendlier display
    let displayContent = msg.content
    let parsedError: string | null = null
    try {
      const parsed = JSON.parse(msg.content)
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.error === 'string') {
          parsedError = parsed.error
        } else if (typeof parsed.message === 'string') {
          parsedError = parsed.message
        } else if (parsed.stdout !== undefined) {
          displayContent = parsed.stdout || '(empty stdout)'
          if (parsed.stderr) displayContent += `\n[stderr] ${parsed.stderr}`
          if (parsed.exitCode !== undefined && parsed.exitCode !== 0) displayContent += `\n[exit] ${parsed.exitCode}`
        }
      }
    } catch {}

    const isError = msg.role === 'tool_error' || parsedError !== null
    const shownContent = parsedError || displayContent

    return (
      <div style={{ padding: '2px 10px' }}>
        <div style={{
          padding: '4px 8px',
          backgroundColor: isError ? 'rgba(192,80,80,0.06)' : 'rgba(92,184,92,0.04)',
          border: `1px solid ${isError ? 'rgba(192,80,80,0.15)' : 'rgba(92,184,92,0.1)'}`,
          borderLeft: taskColor ? `3px solid ${taskColor}` : undefined,
          fontSize: 10, fontFamily: mono, color: isError ? 'var(--warm-red)' : 'var(--text-secondary)',
          maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          borderRadius: 2,
        }}>
          {shownContent.slice(0, 500)}
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
                  let toolStatus = block.status || 'pending'
                  if (!block.status) {
                    const hasResult = allMessages.some(m =>
                      (m.role === 'tool_result' || m.role === 'tool_error') &&
                      m.blocks?.some((b: any) => b.toolUseId === block.id)
                    )
                    if (hasResult) {
                      const isError = allMessages.some(m =>
                        m.role === 'tool_error' &&
                        m.blocks?.some((b: any) => b.toolUseId === block.id)
                      )
                      toolStatus = isError ? 'failed' : 'completed'
                    } else {
                      const runningTask = tasks.find(t => t.status === 'in_progress')
                      toolStatus = runningTask ? 'running' : 'pending'
                    }
                  }
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
  const [intentLoading, setIntentLoading] = React.useState(false)
  const [intentProgress, setIntentProgress] = React.useState(0)
  const [intentBanner, setIntentBanner] = React.useState(0)
  const [streamingText, setStreamingText] = React.useState('')
  const [input, setInput] = React.useState('')
  const [showPicker, setShowPicker] = React.useState(false)
  const [showHistory, setShowHistory] = React.useState(false)
  const [sessions, setSessions] = React.useState<any[]>([])
  const [workflowName, setWorkflowName] = React.useState<string | null>(null)
  const [executorRunning, setExecutorRunning] = React.useState(false)
  const [autoCollapsed, setAutoCollapsed] = React.useState(false)
  const [statusBanners, setStatusBanners] = React.useState<Array<{
    id: string
    text: string
    type: 'start' | 'done' | 'failed'
    taskTitle: string
  }>>([])
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
  const [expandedFailedDesc, setExpandedFailedDesc] = React.useState<Set<string>>(new Set())
  const [failedTaskAction, setFailedTaskAction] = React.useState<{
    taskId: string
    taskTitle: string
    error: string
  } | null>(null)
  const dismissedFailedTasksRef = React.useRef<Set<string>>(new Set())
  const dismissedApprovalsRef = React.useRef<Set<string>>(new Set()) // taskIds user clicked "Later" on
  const isTypewritingRef = React.useRef(false)

  function pushBanner(type: 'start' | 'done' | 'failed', taskTitle: string) {
    const id = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const text = type === 'start' ? `▸ ${taskTitle} Running`
      : type === 'done' ? `✓ ${taskTitle} Done`
      : `✕ ${taskTitle} Failed`
    setStatusBanners(prev => [...prev, { id, text, type, taskTitle }])
    setTimeout(() => {
      setStatusBanners(prev => prev.filter(b => b.id !== id))
    }, 3500)
  }
  const [permissionRequest, setPermissionRequest] = React.useState<{
    id: string
    toolName: string
    message: string
    input?: any
  } | null>(null)
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
  const messagesRef = React.useRef<CompactMessage[]>([])
  const workflowExpandedRef = React.useRef(false)
  const userCollapsedRef = React.useRef(false)

  React.useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  React.useEffect(() => {
    if (!intentLoading) {
      setIntentProgress(0)
      setIntentBanner(0)
      return
    }
    setIntentProgress(0)
    setIntentBanner(0)
    const progressTimer = setInterval(() => {
      setIntentProgress(p => Math.min(p + Math.random() * 8, 92))
    }, 300)
    const bannerTimer = setInterval(() => {
      setIntentBanner(b => b + 1)
    }, 3000)
    return () => {
      clearInterval(progressTimer)
      clearInterval(bannerTimer)
    }
  }, [intentLoading])

  React.useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  React.useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  React.useEffect(() => {
    workflowExpandedRef.current = workflowExpanded
  }, [workflowExpanded])

  React.useEffect(() => {
    approvalPopupRef.current = approvalPopup
  }, [approvalPopup])

  // Centralize approval popup updates so the state and ref always stay in
  // sync. The ref is updated synchronously (for SSE handlers that read it
  // before re-render) and the state triggers the re-render.
  function updateApprovalPopup(next: typeof approvalPopup) {
    approvalPopupRef.current = next
    setApprovalPopup(next)
  }

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
    // Skip auto-collapse while the typewriter is filling the input —
    // otherwise each 20ms setInput triggers this effect and collapses the panel mid-animation
    if (isTypewritingRef.current) return
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

    // Restore pending task_failure approvals on reconnect/refresh
    fetch(`${API_BASE}/api/approvals/pending`)
      .then(r => r.json())
      .then(data => {
        if (data.approvals) {
          for (const req of data.approvals) {
            if (req.requestType === 'task_failure' && !dismissedFailedTasksRef.current.has(req.taskId)) {
              const rawError = req.errorMessage || req.approvalMessage || 'Task failed'
              const cleanError = rawError.replace(/^Task failed:\s*/i, '')
              setFailedTaskAction({
                taskId: req.taskId,
                taskTitle: req.taskTitle || req.taskId,
                error: cleanError,
              })
              break
            }
          }
        }
      })
      .catch(() => {})

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
              if (c.type === 'tool_use') return { type: 'tool_use', id: c.id, name: c.name, input: c.input, status: 'pending' }
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

        // For tool_result messages, ensure toolUseId is in blocks for status matching
        if (m.type === 'tool_result' && m.toolUseId) {
          if (!blocks) blocks = []
          blocks = [{ type: 'tool_result', toolUseId: m.toolUseId, isError: m.isError }, ...(blocks as any[])]
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
          // First task starting: switch from workflow detail to chat view
          const claimedTask = tasksRef.current.find(t => t.id === data.taskId)
          const noActiveBefore = !tasksRef.current.some(t => t.status === 'in_progress' || t.status === 'done' || t.status === 'failed')
          if (noActiveBefore && workflowExpandedRef.current) {
            setWorkflowExpanded(false)
          }
          if (claimedTask) {
            pushBanner('start', claimedTask.title)
          }
        }
      } catch {}
    })

    es.addEventListener('executor:task-completed', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        if (taskIdsRef.current.has(data.taskId)) {
          loadTasksDebounced()
          const completedTask = tasksRef.current.find(t => t.id === data.taskId)
          if (data.success === false) {
            if (completedTask) pushBanner('failed', completedTask.title)
            if (!dismissedFailedTasksRef.current.has(data.taskId)) {
              setFailedTaskAction({
                taskId: data.taskId,
                taskTitle: completedTask?.title || data.taskId,
                error: typeof data.result === 'string' ? data.result : 'Task failed',
              })
            }
          } else {
            if (completedTask) pushBanner('done', completedTask.title)
          }
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
        // task_failure: show inline action bar above input, not popup
        if (data.requestType === 'task_failure') {
          if (dismissedFailedTasksRef.current.has(data.taskId)) return
          const rawError = data.errorMessage || data.approvalMessage || 'Task failed'
          const cleanError = rawError.replace(/^Task failed:\s*/i, '')
          setFailedTaskAction({
            taskId: data.taskId,
            taskTitle: data.taskTitle || data.taskId,
            error: cleanError,
          })
          loadTasksDebounced()
          return
        }
        // Skip if popup already showing for this task (prevents flicker from re-emitted events)
        const current = approvalPopupRef.current
        if (current && current.taskId === data.taskId && !current.resolving) return
        // Skip if user previously dismissed this approval via "Later" —
        // the task stays paused and the rail keeps a pulsing reminder;
        // user re-opens the approval by clicking the paused node in the rail.
        if (dismissedApprovalsRef.current.has(data.taskId)) return
        // Show popup for any approval event
        const task = tasksRef.current.find(t => t.id === data.taskId)
        const isCheckpoint = task?.status === 'paused' && task?.checkpointAfter === true
        updateApprovalPopup({
          taskId: data.taskId,
          taskTitle: data.taskTitle || data.taskId,
          message: data.approvalMessage || 'Approval required',
          isCheckpoint,
          resolving: false,
        })
        loadTasksDebounced()
      } catch {
        // ignore parse errors
      }
    })

    es.addEventListener('approval:resolved', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        const current = approvalPopupRef.current
        if (current && current.taskId === data.taskId) {
          updateApprovalPopup(null)
        }
        setFailedTaskAction(prev => prev && prev.taskId === data.taskId ? null : prev)
      } catch {}
    })

    es.addEventListener('tool:start', () => {})
    es.addEventListener('tool:result', () => {})
    es.addEventListener('tool:error', () => {})

    es.addEventListener('permission', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        const permId = data.permId || data.id
        if (!permId) return
        setPermissionRequest({
          id: permId,
          toolName: data.toolName || 'Unknown Tool',
          message: data.message || `Allow ${data.toolName}?`,
          input: data.input,
        })
      } catch {}
    })

    es.addEventListener('permission-timeout', (e: any) => {
      try {
        const data = JSON.parse(e.data)
        setPermissionRequest(prev => {
          if (!prev) return null
          const permId = data.permId || data.id
          if (permId && prev.id !== permId) return prev
          return null
        })
      } catch {}
    })

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
    const cur = approvalPopupRef.current
    updateApprovalPopup(cur ? { ...cur, resolving: true } : null)
    if (action === 'later') {
      // Mark as dismissed so SSE re-emits (if any) don't re-popup.
      // Task stays paused; the rail keeps a pulsing reminder.
      dismissedApprovalsRef.current.add(taskId)
    } else {
      // Any other action clears the dismissal — user is actively handling it
      dismissedApprovalsRef.current.delete(taskId)
    }
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
      // Only clear if popup is still for the same task — a new approval may have arrived during await
      const after = approvalPopupRef.current
      updateApprovalPopup(after && after.taskId === taskId ? null : after)
    }
  }

  /** Re-open an approval popup for a paused task that was previously dismissed via "Later".
   *  Triggered by clicking the pulsing paused node in WorkflowRail. */
  function reopenApproval(taskId: string) {
    const task = tasksRef.current.find(t => t.id === taskId)
    if (!task || task.status !== 'paused') return
    dismissedApprovalsRef.current.delete(taskId)
    const isCheckpoint = task.checkpointAfter === true
    const isFailure = !!task.lastError
    if (isFailure) {
      // Re-open the inline failure action bar instead of the checkpoint popup
      const rawError = task.lastError || 'Task failed'
      const cleanError = rawError.replace(/^Task failed:\s*/i, '')
      setFailedTaskAction({
        taskId,
        taskTitle: task.title || taskId,
        error: cleanError,
      })
    } else {
      updateApprovalPopup({
        taskId,
        taskTitle: task.title || taskId,
        message: task.approvalMessage || 'Approval required',
        isCheckpoint,
        resolving: false,
      })
    }
  }

  async function handleFailedTaskAction(action: 'retry' | 'continue' | 'new') {
    if (!failedTaskAction) return
    const { taskId } = failedTaskAction
    // Only dismiss on continue/new (terminal actions); retry should allow re-popup on next failure
    if (action === 'continue' || action === 'new') {
      dismissedFailedTasksRef.current.add(taskId)
    }
    setFailedTaskAction(null)
    try {
      if (action === 'retry') {
        await fetch(`${API_BASE}/api/tasks/${taskId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'retry' }),
        })
      } else if (action === 'continue') {
        await fetch(`${API_BASE}/api/tasks/${taskId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'continue' }),
        })
      } else if (action === 'new') {
        await fetch(`${API_BASE}/api/tasks/${taskId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop' }),
        })
        setInput('')
        setWorkflowExpanded(false)
      }
      await loadTasks()
    } catch (e) {
      console.error('[Compact] failed task action error:', e)
    }
  }

  async function handlePermissionResponse(approved: boolean) {
    if (!permissionRequest) return
    const permId = permissionRequest.id
    setPermissionRequest(null)
    try {
      await fetch(`${API_BASE}/api/chat/permission-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: permId, approved }),
      })
    } catch (e) {
      console.error('[Compact] permission response error:', e)
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
        // Check if workflow fully completed — auto switch to detail view
        if (compact.length > 0) {
          const allDone = compact.every(t =>
            t.status === 'done' || t.status === 'failed' || t.status === 'cancelled' || t.status === 'skipped'
          )
          const hasAnyStarted = compact.some(t =>
            t.status === 'done' || t.status === 'failed' || t.status === 'cancelled' || t.status === 'skipped' || t.status === 'in_progress'
          )
          if (allDone && hasAnyStarted && !workflowExpandedRef.current && !userCollapsedRef.current) {
            setWorkflowExpanded(true)
          }
        }
      }
    } catch {}
  }

  // Debounced refresh for SSE-driven updates. The 2s poll already keeps state
  // fresh; SSE events (task-completed/approval) can fire in rapid bursts, so
  // coalescing them avoids redundant /api/tasks fetches on top of the poll.
  const loadTasksDebouncedRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  function loadTasksDebounced() {
    if (loadTasksDebouncedRef.current) clearTimeout(loadTasksDebouncedRef.current)
    loadTasksDebouncedRef.current = setTimeout(() => {
      loadTasksDebouncedRef.current = null
      loadTasks()
    }, 300)
  }

  async function handleStart(filePath: string, _params?: Record<string, string>) {
    try {
      // Stop any background activity from the previous session before starting fresh
      const oldSid = sessionIdRef.current
      if (oldSid) {
        try {
          // Cancel all active tasks (in_progress / paused / todo) from the old session
          const tasksRes = await fetch(`${API_BASE}/api/tasks`)
          const tasksData = await tasksRes.json()
          const activeTasks = (tasksData.tasks || []).filter(
            (t: any) => t.sessionId === oldSid &&
              ['in_progress', 'paused', 'todo', 'pausing', 'verify'].includes(t.status)
          )
          for (const t of activeTasks) {
            await fetch(`${API_BASE}/api/tasks/${t.id}/cancel`, { method: 'POST' }).catch(() => {})
          }
        } catch {}
      }
      // Always stop the executor to halt the polling loop, then it will be restarted by launchWorkflow
      await fetch(`${API_BASE}/api/executor/stop`, { method: 'POST' }).catch(() => {})
      setExecutorRunning(false)
      // Abort any in-flight chat stream
      if (chatAbortRef.current) {
        chatAbortRef.current.abort()
        chatAbortRef.current = null
      }

      // Read the template to get its triggers/useCase for generating a trigger message
      userCollapsedRef.current = false
      const tmplRes = await fetch(`${API_BASE}/api/templates`)
      const tmplData = await tmplRes.json()
      const template = (tmplData.templates || []).find((t: any) => t.filename === filePath || t.id === filePath)
      const triggerText = template?.useCase
        ? template.useCase
        : (template?.triggers?.[0] || template?.name || '创建工作流')

      // Clear old state
      setMessages([])
      seenMsgIdsRef.current.clear()
      setTasks([])
      taskOrderRef.current = []
      setSessionId(null)
      sessionIdRef.current = null
      setWorkflowName(null)
      setFailedTaskAction(null)
      updateApprovalPopup(null)
      setPermissionRequest(null)
      setStopChoice(false)
      dismissedFailedTasksRef.current = new Set()
      localStorage.removeItem('compact-session-id')
      localStorage.removeItem('compact-task-order')

      // Typewriter effect: fill the trigger text into the input box so user sees the auto-fill process
      setInput('')
      isTypewritingRef.current = true
      await new Promise<void>(resolve => {
        let i = 0
        const step = Math.max(1, Math.ceil(triggerText.length / 40))
        const timer = setInterval(() => {
          i += step
          if (i >= triggerText.length) {
            setInput(triggerText)
            clearInterval(timer)
            resolve()
          } else {
            setInput(triggerText.slice(0, i))
          }
        }, 20)
      })
      isTypewritingRef.current = false

      // Brief pause so user can see the full text before sending
      await new Promise(r => setTimeout(r, 300))

      // Auto-send the trigger text
      await autoSend(triggerText)
    } catch (e) {
      console.error('[Compact] start error:', e)
      alert('Failed to start workflow')
    }
  }

  async function launchWorkflow(filePath: string, params?: Record<string, string>) {
    try {
      setIsLoading(true)
      setTemplateConfirm(prev => prev ? { ...prev, loading: true } : null)
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
      userCollapsedRef.current = false
      setWorkflowExpanded(true)
      setTemplateConfirm(null)
      try {
        await fetch(`${API_BASE}/api/executor/start`, { method: 'POST' })
        setExecutorRunning(true)
      } catch {}
    } catch (e) {
      console.error('[Compact] launch error:', e)
      alert('Failed to start workflow')
      setTemplateConfirm(prev => prev ? { ...prev, loading: false } : null)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Shared SSE stream consumer for /api/chat/sse. Parses `delta`, `message`,
   * `done`, `error`, `permission` and `permission-timeout` events, updating
   * component state directly. Returns the sessionId reported by `done`.
   * Used by both autoSend and handleSend to avoid duplicated parsing logic.
   */
  async function consumeChatSseStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''
    let newSessionId = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
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
                let chatBlocks = data.blocks
                if (data.toolUseId) {
                  chatBlocks = [{ type: 'tool_result', toolUseId: data.toolUseId, isError: data.role === 'tool_error' }, ...(chatBlocks || [])]
                }
                const msg: CompactMessage = {
                  id: msgId,
                  role: data.role || 'assistant',
                  content: data.content || '',
                  timestamp: Date.now(),
                  blocks: chatBlocks,
                }
                setMessages(prev => [...prev, msg])
              }
            } else if (currentEvent === 'done') {
              newSessionId = data.sessionId
            } else if (currentEvent === 'error') {
              console.error('[Compact] chat error:', data.message)
            } else if (currentEvent === 'permission') {
              const permId = data.id || data.permId
              if (permId) {
                setPermissionRequest({
                  id: permId,
                  toolName: data.toolName,
                  message: data.message || `Allow ${data.toolName}?`,
                  input: data.input,
                })
              }
            } else if (currentEvent === 'permission-timeout') {
              setPermissionRequest(null)
            }
          } catch {}
        }
      }
    }
    return newSessionId
  }

  async function autoSend(text: string) {
    if (!text.trim()) return

    // Clear the input box now that the message is being sent
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

    setIsLoading(true)
    setIntentLoading(true)
    setStreamingText('')

    try {
      // Intent recognition first
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

      // No template matched — fall through to normal chat
      let sid = sessionIdRef.current
      if (!sid) {
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
      }

      const abortController = new AbortController()
      chatAbortRef.current = abortController
      const res = await fetch(`${API_BASE}/api/chat/sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { text }, sessionId: sid || undefined, keepOpen: true }),
        signal: abortController.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const newSessionId = await consumeChatSseStream(res.body.getReader())
      if (newSessionId && !sid) {
        setSessionId(newSessionId)
        sessionIdRef.current = newSessionId
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('[Compact] autoSend error:', e)
    } finally {
      setIsLoading(false)
      setIntentLoading(false)
      setStreamingText('')
      chatAbortRef.current = null
    }
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return
    const text = input.trim()

    // Intent recognition: check if message matches a template
    if (!sessionIdRef.current && tasks.length === 0) {
      try {
        setIntentLoading(true)
        const intentRes = await fetch(`${API_BASE}/api/chat/intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
        const intentData = await intentRes.json()
        if (intentData.matched && intentData.template) {
          setInput('')
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
      } finally {
        setIntentLoading(false)
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

      const newSessionId = await consumeChatSseStream(res.body.getReader())
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
    setFailedTaskAction(null)
    updateApprovalPopup(null)
    seenMsgIdsRef.current = new Set()
    dismissedFailedTasksRef.current = new Set()
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

  async function handleDeleteSession(sid: string) {
    try {
      await fetch(`${API_BASE}/api/sessions/${sid}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== sid))
      if (sessionIdRef.current === sid) {
        await handleNewSession()
      }
    } catch (e) {
      console.error('[Compact] delete session error:', e)
    }
  }

  async function handleSelectSession(sid: string) {
    setSessionId(sid)
    sessionIdRef.current = sid
    setMessages([])
    setTasks([])
    taskOrderRef.current = []
    setWorkflowName(null)
    setWorkflowExpanded(false)
    setFailedTaskAction(null)
    updateApprovalPopup(null)
    setShowHistory(false)
    seenMsgIdsRef.current = new Set()
    dismissedFailedTasksRef.current = new Set()
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
        // Cancel all non-terminal tasks (running, paused, pending) so nothing
        // is left behind. Paused tasks include failed-but-waiting-decision ones.
        const activeTasks = tasks.filter(t =>
          t.status === 'in_progress' || t.status === 'paused' ||
          t.status === 'pausing' || t.status === 'verify' || t.status === 'todo'
        )
        for (const t of activeTasks) {
          await fetch(`${API_BASE}/api/tasks/${t.id}/cancel`, { method: 'POST' }).catch(() => {})
        }
        await fetch(`${API_BASE}/api/executor/stop`, { method: 'POST' })
        setExecutorRunning(false)
        // Clear any pending failure/approval popups since the workflow is cancelled
        setFailedTaskAction(null)
        updateApprovalPopup(null)
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
        <ToolbarButton icon={<Plus size={12} />} label="Chat" onClick={handleNewSession} />
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
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <button
                    onClick={() => handleSelectSession(s.id)}
                    style={{
                      flex: 1, display: 'block', padding: '6px 10px',
                      background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title || s.id}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: mono }}>
                      {s.messageCount || 0} msgs · {new Date(s.updatedAt || s.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    title="Delete session"
                    style={{
                      padding: '6px 8px', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-faint)',
                      display: 'flex', alignItems: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--warm-red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
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
      </div>

      {/* Middle Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Status Banners — float across the top */}
        {statusBanners.length > 0 && (
          <div style={{
            position: 'absolute', top: 8, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200, display: 'flex', flexDirection: 'column', gap: 4,
            alignItems: 'center', pointerEvents: 'none',
          }}>
            {statusBanners.map(b => (
              <div key={b.id} style={{
                padding: '5px 14px',
                fontSize: 11, fontFamily: mono, fontWeight: 700,
                color: b.type === 'start' ? '#fbbf24'
                  : b.type === 'done' ? '#86efac' : '#fca5a5',
                backgroundColor: 'rgba(12,12,12,0.92)',
                backdropFilter: 'blur(6px)',
                border: `1px solid ${
                  b.type === 'start' ? 'rgba(251,191,36,0.5)'
                  : b.type === 'done' ? 'rgba(134,239,172,0.5)' : 'rgba(252,165,165,0.5)'}`,
                borderLeft: `3px solid ${
                  b.type === 'start' ? '#fbbf24'
                  : b.type === 'done' ? '#86efac' : '#fca5a5'}`,
                borderRadius: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 320,
                boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                animation: 'bannerSlide 0.4s ease-out',
              }}>
                {b.text}
              </div>
            ))}
            <style>{`@keyframes bannerSlide { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          </div>
        )}
        {/* Workflow Rail (collapsed) */}
        {hasWorkflow && !workflowExpanded && (
          <WorkflowRail
            tasks={tasks}
            onExpand={() => setWorkflowExpanded(true)}
            onReopenApproval={reopenApproval}
          />
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
                <MessageBubble msg={msg} tasks={tasks} allMessages={messages} />
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

          {intentLoading && (() => {
            const banners = [
              '正在分析用户意图...',
              'PM Agent 正在解析 workflow 节点...',
              '正在生成增强描述...',
              '正在识别潜在风险与建议...',
              '正在优化 workflow 方案...',
            ]
            const currentBanner = banners[intentBanner % banners.length]
            return (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(12,12,12,0.88)',
                backdropFilter: 'blur(4px)',
                zIndex: 100,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, padding: 20,
              }}>
                <Loader2 size={36} color="#7dd3fc" style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{
                  fontSize: 14, fontFamily: mono, color: '#7dd3fc',
                  fontWeight: 700, textAlign: 'center',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Intent Analysis
                </div>
                <div style={{
                  fontSize: 12, fontFamily: mono, color: '#ffffff',
                  textAlign: 'center', minHeight: 18,
                  transition: 'opacity 0.3s',
                }}>
                  {currentBanner}
                </div>
                <div style={{
                  width: '80%', maxWidth: 300, height: 4,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 2, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${intentProgress}%`, height: '100%',
                    background: 'linear-gradient(90deg, #7dd3fc, #60a5fa)',
                    borderRadius: 2,
                    transition: 'width 0.3s ease-out',
                  }} />
                </div>
                <div style={{
                  fontSize: 10, fontFamily: mono, color: '#71717a',
                }}>
                  {Math.round(intentProgress)}%
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )
          })()}

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
                onClick={() => { userCollapsedRef.current = true; setWorkflowExpanded(false) }}
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
                const cfg = getStatusConfig(task)
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

                        {/* Description (visible for active/failed tasks; collapsed by default when failed) */}
                        {task.description && (isActive || task.status === 'failed') && (
                          task.status === 'failed' && !expandedFailedDesc.has(task.id) ? (
                            <button
                              onClick={() => setExpandedFailedDesc(prev => new Set(prev).add(task.id))}
                              style={{
                                marginTop: 5, width: '100%', textAlign: 'left',
                                fontSize: 10, fontFamily: mono,
                                color: '#fca5a5', cursor: 'pointer',
                                padding: '3px 6px',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                borderRadius: 2,
                                border: '1px solid rgba(252,165,165,0.2)',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <ChevronRight size={10} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {task.description.slice(0, 60)}
                              </span>
                              <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0 }}>展开</span>
                            </button>
                          ) : task.status === 'failed' ? (
                            <div style={{ marginTop: 5 }}>
                              <button
                                onClick={() => setExpandedFailedDesc(prev => {
                                  const next = new Set(prev)
                                  next.delete(task.id)
                                  return next
                                })}
                                style={{
                                  width: '100%', textAlign: 'left',
                                  fontSize: 10, fontFamily: mono,
                                  color: '#fca5a5', cursor: 'pointer',
                                  padding: '3px 6px', marginBottom: 3,
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  display: 'flex', alignItems: 'center', gap: 4,
                                }}
                              >
                                <ChevronDown size={10} />
                                <span style={{ fontSize: 9, opacity: 0.7 }}>收起描述</span>
                              </button>
                              <div style={{
                                fontSize: 11, fontFamily: mono,
                                color: '#fca5a5', lineHeight: 1.45,
                                padding: '4px 6px',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                borderRadius: 2,
                                maxHeight: 80, overflow: 'auto',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                border: '1px solid rgba(255,255,255,0.15)',
                              }}>
                                {task.description.slice(0, 400)}
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              marginTop: 5, fontSize: 11, fontFamily: mono,
                              color: '#e8e0d4', lineHeight: 1.45,
                              padding: '4px 6px',
                              backgroundColor: 'rgba(0,0,0,0.5)',
                              borderRadius: 2,
                              maxHeight: 80, overflow: 'auto',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              border: '1px solid rgba(255,255,255,0.15)',
                            }}>
                              {task.description.slice(0, 400)}
                            </div>
                          )
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
        {/* Failed Task Action Bar */}
        {failedTaskAction && (
          <div style={{
            marginBottom: 8, padding: '10px 12px',
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border-medium)',
            borderLeft: '3px solid var(--warm-red)',
            borderRadius: 2,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 6,
            }}>
              <XCircle size={13} color="var(--warm-red)" />
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--warm-red)',
                fontFamily: mono, textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Task Failed
              </span>
              <span style={{
                fontSize: 11, color: 'var(--text-primary)', fontFamily: mono,
                marginLeft: 4, fontWeight: 500,
              }}>
                {failedTaskAction.taskTitle}
              </span>
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', fontFamily: mono,
              marginBottom: 10, lineHeight: 1.5,
              padding: '6px 8px',
              backgroundColor: 'var(--surface-0)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 2,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {failedTaskAction.error}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => handleFailedTaskAction('retry')}
                style={{
                  flex: 1, padding: '7px 8px', fontSize: 11, fontWeight: 700,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: 'var(--amber)', color: '#000',
                  border: '1px solid var(--amber)', borderRadius: 2,
                }}
              >
                ↻ Retry
              </button>
              <button
                onClick={() => handleFailedTaskAction('continue')}
                style={{
                  flex: 1, padding: '7px 8px', fontSize: 11, fontWeight: 600,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: 'var(--surface-1)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-medium)', borderRadius: 2,
                }}
              >
                ⏭ Skip
              </button>
              <button
                onClick={() => handleFailedTaskAction('new')}
                style={{
                  flex: 1, padding: '7px 8px', fontSize: 11, fontWeight: 600,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: 'var(--surface-1)', color: 'var(--warm-red)',
                  border: '1px solid var(--warm-red)', borderRadius: 2,
                }}
              >
                ✕ Stop
              </button>
            </div>
          </div>
        )}
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
              title="Stop chat response"
              style={{
                width: 32, height: 32, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--warm-red)', border: 'none',
                borderRadius: 2, cursor: 'pointer', color: '#fff',
              }}
            >
              <Square size={12} />
            </button>
          ) : hasWorkflow && executorRunning ? (
            <button
              onClick={handleToggleExecutor}
              title="Pause workflow"
              style={{
                width: 32, height: 32, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--amber)', border: 'none',
                borderRadius: 2, cursor: 'pointer', color: '#0c0c0c',
              }}
            >
              <Pause size={12} />
            </button>
          ) : hasWorkflow && !executorRunning ? (
            <button
              onClick={handleToggleExecutor}
              title="Resume workflow"
              style={{
                width: 32, height: 32, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--status-green, #86efac)', border: 'none',
                borderRadius: 2, cursor: 'pointer', color: '#0c0c0c',
              }}
            >
              <Play size={12} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              title="Send message"
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

            {/* PM agent status indicator */}
            <div style={{
              marginBottom: 8, padding: '6px 10px',
              backgroundColor: templateConfirm.enhancement ? 'rgba(125,211,252,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${templateConfirm.enhancement ? 'rgba(125,211,252,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderLeft: `3px solid ${templateConfirm.enhancement ? '#7dd3fc' : '#71717a'}`,
              borderRadius: 2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Bot size={12} color={templateConfirm.enhancement ? '#7dd3fc' : '#71717a'} />
              <span style={{
                fontSize: 10, fontFamily: mono, fontWeight: 600,
                color: templateConfirm.enhancement ? '#7dd3fc' : '#71717a',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {templateConfirm.enhancement
                  ? `PM Agent: ${Object.keys(templateConfirm.enhancement.enrichedDescriptions || {}).length} nodes enriched`
                  : 'PM Agent: not active (LLM not configured or enhancement skipped)'}
              </span>
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
                onClick={() => launchWorkflow(templateConfirm.template.filename, templateConfirm.params)}
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

      {/* Permission Request Popup */}
      {permissionRequest && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            backgroundColor: 'var(--surface-2, #1a1a1a)',
            border: '1px solid var(--border-medium, #444)',
            borderLeft: '3px solid var(--amber, #fbbf24)',
            borderRadius: 4,
            padding: '16px 20px',
            maxWidth: 380,
            width: '90%',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10,
            }}>
              <Wrench size={16} color="var(--amber, #fbbf24)" />
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: 'var(--amber, #fbbf24)',
                fontFamily: mono, textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Permission Required
              </span>
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-primary, #fff)',
              fontFamily: mono, fontWeight: 600,
              marginBottom: 6,
            }}>
              {permissionRequest.toolName}
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-secondary, #ccc)',
              fontFamily: mono, lineHeight: 1.5,
              marginBottom: 12, maxHeight: 120, overflowY: 'auto',
              padding: '6px 8px',
              backgroundColor: 'var(--surface-0, #0c0c0c)',
              border: '1px solid var(--border-subtle, #333)',
              borderRadius: 2,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {permissionRequest.message}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handlePermissionResponse(true)}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 700,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: 'var(--amber, #fbbf24)', color: '#000',
                  border: '1px solid var(--amber, #fbbf24)', borderRadius: 2,
                }}
              >
                ✓ Allow
              </button>
              <button
                onClick={() => handlePermissionResponse(false)}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: mono, cursor: 'pointer',
                  backgroundColor: 'var(--surface-1, #1a1a1a)',
                  color: 'var(--text-muted, #999)',
                  border: '1px solid var(--border-subtle, #333)',
                  borderRadius: 2,
                }}
              >
                ✕ Deny
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

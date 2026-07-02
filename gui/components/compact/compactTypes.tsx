'use client'

import * as React from 'react'
import { CheckCircle, XCircle, Clock, ChevronRight, Loader2 } from 'lucide-react'

const mono = 'IBM Plex Mono, monospace'
const sans = 'IBM Plex Sans, sans-serif'

export const TASK_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

export const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
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

export interface CompactTask {
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

export interface CompactMessage {
  id: string
  role: 'user' | 'assistant' | 'tool_result' | 'tool_error' | 'system'
  content: string
  timestamp: number
  taskId?: string
  blocks?: any[]
}

export function getStatusConfig(task: CompactTask) {
  if (task.status === 'paused' && task.lastError) {
    return { color: '#fca5a5', icon: <XCircle size={10} />, label: 'Failed' }
  }
  return statusConfig[task.status] || statusConfig.todo
}

export function getTaskColor(taskId: string, tasks: CompactTask[]): string {
  const idx = tasks.findIndex(t => t.id === taskId)
  return TASK_COLORS[idx % TASK_COLORS.length] || TASK_COLORS[0]!
}

export function renderInlineMarkdown(text: string): React.ReactNode {
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

export function renderMarkdown(text: string): React.ReactNode[] {
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

export { mono, sans }

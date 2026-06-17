'use client'

import * as React from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle, MessageSquare, Loader2, MessageCircle } from 'lucide-react'
import { pixelAvatarToDataUrl } from '@/lib/pixelAvatar'
import { useAppStore } from '@/lib/store'
import type { ActivityEvent } from '@/types'

const S = {
  bg: 'var(--surface-0)',
  surface: 'var(--surface-1)',
  elevated: 'var(--surface-2)',
  border: 'var(--border-subtle)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  textFaint: 'var(--text-faint)',
  amber: 'var(--amber)',
  green: 'var(--status-green)',
  red: 'var(--warm-red)',
  purple: 'var(--status-purple)',
}

const mono = 'IBM Plex Mono, monospace'
const sans = 'IBM Plex Sans, sans-serif'

interface Props {
  events: ActivityEvent[]
  taskIds: Set<string> // Filter events by these task IDs
}

export function ActivityFeed({ events, taskIds }: Props) {
  const { tasks, jumpToSession } = useAppStore()
  const feedRef = React.useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [expandedProgress, setExpandedProgress] = React.useState<Set<string>>(new Set())

  // Filter events by task IDs — only show events for this proposal's tasks
  const filteredEvents = React.useMemo(() => {
    if (taskIds.size === 0) return [] // No tasks = no events
    return events
      .filter(e => e.taskId && taskIds.has(e.taskId))
      .sort((a, b) => a.timestamp - b.timestamp) // sort chronologically
  }, [events, taskIds])

  // Auto-scroll to bottom when new events arrive
  React.useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [filteredEvents.length, autoScroll])

  // Detect manual scroll
  const handleScroll = () => {
    if (!feedRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }

  const scrollToBottom = () => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
      setAutoScroll(true)
    }
  }

  const toggleProgress = (id: string) => {
    setExpandedProgress(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getEventIcon = (event: ActivityEvent) => {
    switch (event.type) {
      case 'task_status':
        if (event.toStatus === 'done') return <CheckCircle2 size={12} color={S.green} />
        if (event.toStatus === 'failed') return <XCircle size={12} color={S.red} />
        if (event.toStatus === 'in_progress') return <Loader2 size={12} color={S.amber} /> // no animation for historical events
        if (event.toStatus === 'verify') return <Clock size={12} color={S.purple} />
        return <Clock size={12} color={S.textMuted} />
      case 'task_progress':
        return <Loader2 size={12} color={S.amber} style={{ animation: 'spin 1s linear infinite' }} />
      case 'approval_required':
        return <AlertTriangle size={12} color={S.amber} />
      case 'approval_resolved':
        return <CheckCircle2 size={12} color={S.green} />
      case 'task_error':
        return <XCircle size={12} color={S.red} />
      default:
        return <Clock size={12} color={S.textMuted} />
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'done': return S.green
      case 'failed': return S.red
      case 'in_progress': return S.amber
      case 'verify': return S.purple
      default: return S.textMuted
    }
  }

  const isApprovalEvent = (event: ActivityEvent) =>
    event.type === 'approval_required' || event.type === 'approval_resolved'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: `1px solid ${S.border}`,
        backgroundColor: S.surface,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: S.textSec, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Activity Feed
        </span>
        <span style={{ fontSize: 10, color: S.textFaint, fontFamily: mono }}>
          {filteredEvents.length} events
        </span>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflow: 'auto', padding: '8px 0',
          backgroundColor: S.bg,
        }}
      >
        {filteredEvents.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: S.textFaint, fontSize: 11, fontFamily: mono }}>
            No activity yet
          </div>
        )}

        {filteredEvents.map((event) => {
          const isApproval = isApprovalEvent(event)
          const isProgress = event.type === 'task_progress'
          const isExpanded = expandedProgress.has(event.id)

          return (
            <div
              key={event.id}
              style={{
                padding: '6px 12px',
                borderBottom: `1px solid ${S.border}`,
                backgroundColor: isApproval ? 'rgba(212,165,116,0.06)' : 'transparent',
                borderLeft: isApproval ? `2px solid ${S.amber}` : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {/* Icon */}
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {getEventIcon(event)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Time + Agent + Task */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: S.textFaint, fontFamily: mono }}>
                      {formatTime(event.timestamp)}
                    </span>
                    {event.agentName && (
                      <img
                        src={pixelAvatarToDataUrl(event.agentName, 14)}
                        alt={event.agentName}
                        style={{ width: 14, height: 14, borderRadius: 0 }}
                      />
                    )}
                    <span style={{ fontSize: 11, fontWeight: 500, color: S.text, fontFamily: sans }}>
                      {event.taskTitle}
                    </span>
                    {event.toStatus && (
                      <span style={{
                        fontSize: 9, fontFamily: mono, fontWeight: 600,
                        color: getStatusColor(event.toStatus),
                        backgroundColor: getStatusColor(event.toStatus) + '15',
                        padding: '1px 5px', borderRadius: 0,
                      }}>
                        {event.toStatus}
                      </span>
                    )}
                    {/* View in Chat button */}
                    {(() => {
                      const task = tasks.find(t => t.id === event.taskId)
                      if (!task?.sessionId) return null
                      return (
                        <button
                          onClick={() => jumpToSession(task.sessionId!)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '1px 5px', fontSize: 9, fontFamily: mono,
                            color: S.amber, backgroundColor: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.2)', borderRadius: 0,
                            cursor: 'pointer', marginLeft: 'auto',
                          }}
                        >
                          <MessageCircle size={8} />
                          Chat
                        </button>
                      )
                    })()}
                  </div>

                  {/* Summary */}
                  {event.summary && (
                    <div style={{ fontSize: 10, color: S.textSec, marginTop: 2, lineHeight: 1.4, fontFamily: sans }}>
                      {event.summary}
                    </div>
                  )}

                  {/* Error message */}
                  {event.type === 'task_error' && event.errorMessage && (
                    <div style={{
                      fontSize: 10, color: S.red, marginTop: 4, padding: '4px 6px',
                      backgroundColor: 'rgba(192,80,80,0.08)', borderRadius: 0,
                      fontFamily: mono, lineHeight: 1.4,
                    }}>
                      {event.errorMessage.slice(0, 200)}
                    </div>
                  )}

                  {/* Approval message */}
                  {event.type === 'approval_required' && event.approvalMessage && (
                    <div style={{
                      fontSize: 10, color: S.amber, marginTop: 4, padding: '4px 6px',
                      backgroundColor: 'rgba(212,165,116,0.08)', borderRadius: 0,
                      fontFamily: mono, lineHeight: 1.4,
                    }}>
                      {event.approvalMessage}
                    </div>
                  )}

                  {/* Progress details (collapsible) */}
                  {isProgress && event.progressText && (
                    <div style={{ marginTop: 4 }}>
                      <button
                        onClick={() => toggleProgress(event.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 10, color: S.textFaint, fontFamily: mono, padding: 0,
                        }}
                      >
                        {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        Details
                      </button>
                      {isExpanded && (
                        <div style={{
                          fontSize: 10, color: S.textMuted, marginTop: 4, padding: '4px 6px',
                          backgroundColor: S.surface, borderRadius: 0,
                          fontFamily: mono, lineHeight: 1.4, whiteSpace: 'pre-wrap',
                        }}>
                          {event.progressText}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute', bottom: 12, right: 12,
            padding: '6px 10px', fontSize: 10, fontFamily: mono,
            backgroundColor: S.amber, color: '#0c0c0c', border: 'none', borderRadius: 0,
            cursor: 'pointer', fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          ↓ New events
        </button>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

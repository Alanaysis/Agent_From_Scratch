'use client'

import * as React from 'react'
import { X, Plus, Trash2, FileText, CheckCircle, XCircle, Clock, ArrowRight, Link2, ChevronDown, ChevronUp, Pencil, ArrowLeft, MessageCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pixelAvatarToDataUrl, getAgentColor } from '@/lib/pixelAvatar'
import { WorkflowProgressView } from '@/components/workflow/WorkflowProgressView'
import { ActivityFeed } from './ActivityFeed'
import type { Proposal, TaskDraft, ActivityEvent } from '@/types'

const statusConfig: Record<string, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  draft: { color: 'var(--status-blue)', bgColor: 'rgba(59,130,246,0.1)', label: 'Draft', icon: <FileText size={11} /> },
  pending: { color: 'var(--amber)', bgColor: 'rgba(245,158,11,0.08)', label: 'Pending', icon: <Clock size={11} /> },
  approved: { color: 'var(--status-green)', bgColor: 'rgba(92,184,92,0.1)', label: 'Approved', icon: <CheckCircle size={11} /> },
  rejected: { color: 'var(--warm-red)', bgColor: 'rgba(239,68,68,0.1)', label: 'Rejected', icon: <XCircle size={11} /> },
}

const priorityConfig = {
  low: { color: 'var(--text-muted)', label: 'Low' },
  medium: { color: 'var(--amber)', label: 'Medium' },
  high: { color: 'var(--warm-red)', label: 'High' },
}

interface Props {
  proposal: Proposal
  onClose: () => void
}

export function ProposalDetailPanel({ proposal, onClose }: Props) {
  const { addTaskDraft, removeTaskDraft, updateTaskDraft, addDocumentDraft, removeDocumentDraft, submitProposal, approveProposal, rejectProposal, agents, loadAgents, tasks, activityFeed, jumpToSession, sendToBackend } = useAppStore()
  const [showAddTask, setShowAddTask] = React.useState(false)
  const [showAddDoc, setShowAddDoc] = React.useState(false)
  const [newTaskTitle, setNewTaskTitle] = React.useState('')
  const [newDocTitle, setNewDocTitle] = React.useState('')
  const [newDocType, setNewDocType] = React.useState<'prd' | 'tech_design' | 'adr' | 'spec' | 'guide' | 'report'>('spec')
  const [expandedDraft, setExpandedDraft] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [splitRatio, setSplitRatio] = React.useState(70) // left panel percentage
  const [isDragging, setIsDragging] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [sessionMessages, setSessionMessages] = React.useState<Map<string, Array<{ type: string; content: string; timestamp?: number }>>>(new Map())

  // Handle drag to resize split
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = Math.min(Math.max((x / rect.width) * 100, 20), 80) // clamp 20-80%
      setSplitRatio(ratio)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  React.useEffect(() => {
    if (agents.length === 0) loadAgents()
  }, [agents.length])

  // Load messages for all task sessions
  React.useEffect(() => {
    const sessionIds = tasks
      .filter(t => t.proposalId === proposal.id && t.sessionId)
      .map(t => t.sessionId!)

    if (sessionIds.length === 0) return

    const loadAll = async () => {
      const newMap = new Map<string, Array<{ type: string; content: string; timestamp?: number }>>()
      for (const sid of sessionIds) {
        try {
          const result = await sendToBackend('sessions:messages', sid) as { messages: any[] } | null
          if (result?.messages) {
            newMap.set(sid, result.messages.map((m: any) => ({
              type: m.type,
              content: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || ''),
              timestamp: m.timestamp,
            })))
          }
        } catch {}
      }
      setSessionMessages(newMap)
    }
    loadAll()

    // Poll for updates every 3 seconds
    const interval = setInterval(loadAll, 3000)
    return () => clearInterval(interval)
  }, [proposal.id, tasks])

  const status = statusConfig[proposal.status] || statusConfig.draft
  const isDraft = proposal.status === 'draft'
  const isPending = proposal.status === 'pending'

  // Get task IDs related to this proposal (by proposalId foreign key)
  const relatedTaskIds = React.useMemo(() => {
    return new Set(tasks.filter(t => t.proposalId === proposal.id).map(t => t.id))
  }, [proposal.id, tasks])

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    await addTaskDraft(proposal.id, { title: newTaskTitle.trim(), priority: 'medium' })
    setNewTaskTitle('')
    setShowAddTask(false)
  }

  const handleAddDocument = async () => {
    if (!newDocTitle.trim()) return
    await addDocumentDraft(proposal.id, { type: newDocType, title: newDocTitle.trim(), content: '' })
    setNewDocTitle('')
    setShowAddDoc(false)
  }

  const handleSubmit = async () => {
    setIsProcessing(true)
    try {
      await submitProposal(proposal.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await approveProposal(proposal.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await rejectProposal(proposal.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const getDraftDependencies = (draft: TaskDraft): TaskDraft[] => {
    if (!draft.dependsOnTempIds) return []
    return draft.dependsOnTempIds
      .map(id => proposal.taskDrafts.find(d => d.tempId === id))
      .filter(Boolean) as TaskDraft[]
  }

  return (
    <div data-testid="proposal-detail-panel" style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--surface-0)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: `2px solid ${status.color}`,
        backgroundColor: 'var(--surface-1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="ghost" size="icon" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 0 }} title="Back to Proposals">
            <ArrowLeft size={14} />
          </Button>
          <div style={{
            width: 20, height: 20, borderRadius: 0,
            backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: status.color,
          }}>
            {status.icon}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Proposal</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>—</span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{proposal.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 0,
            backgroundColor: 'var(--surface-0)', color: status.color,
            fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em',
            border: '1px solid var(--border-subtle)',
          }}>
            {status.icon}
            {status.label}
          </span>
        </div>
      </div>

      {/* Progress Bar (for approved proposals with real tasks) */}
      {proposal.status === 'approved' && (() => {
        const relatedTasks = tasks.filter(t => t.proposalId === proposal.id)
        if (relatedTasks.length === 0) return null

        const doneCount = relatedTasks.filter(t => t.status === 'done').length
        const failedCount = relatedTasks.filter(t => t.status === 'failed').length
        const runningCount = relatedTasks.filter(t => t.status === 'in_progress').length
        const progressPct = relatedTasks.length > 0 ? Math.round((doneCount / relatedTasks.length) * 100) : 0

        return (
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-1)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                Progress
              </span>
              <div style={{ flex: 1, height: 6, backgroundColor: 'var(--surface-2)', borderRadius: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)', minWidth: 60 }}>
                <div style={{
                  width: `${progressPct}%`, height: '100%',
                  backgroundColor: failedCount > 0 ? 'var(--warm-red)' : 'var(--status-green)',
                  borderRadius: 0, transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>{progressPct}%</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', flexWrap: 'wrap' }}>
              {runningCount > 0 && <span style={{ color: 'var(--amber)' }}>{runningCount} running</span>}
              {doneCount > 0 && <span style={{ color: 'var(--status-green)' }}>{doneCount} done</span>}
              {failedCount > 0 && <span style={{ color: 'var(--warm-red)' }}>{failedCount} failed</span>}
              <span style={{ color: 'var(--text-faint)' }}>{relatedTasks.length - doneCount - failedCount - runningCount} pending</span>
            </div>
          </div>
        )
      })()}

      {/* Body: Left/Right split */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left: DAG only */}
        <div style={{ width: `${splitRatio}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 10, flexShrink: 0, minWidth: 160 }}>
          {/* DAG Visualization - fills available space */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <WorkflowProgressView
            steps={proposal.taskDrafts.map((draft, i) => {
              const related = tasks.find(t => t.proposalId === proposal.id && t.title === draft.title)
              return {
                id: draft.tempId || `step-${i}`,
                title: draft.title || `Step ${i + 1}`,
                status: (related?.status || 'todo') as any,
                dependsOn: draft.dependsOnTempIds || [],
                assignee: draft.agent,
                sessionId: related?.sessionId,
                isDraft: isDraft,
                draft: isDraft ? draft : undefined,
                condition: draft.condition,
                loop: draft.loop,
              }
            })}
            onViewChat={(sessionId) => jumpToSession(sessionId)}
            onUpdateDraft={(tempId, updates) => updateTaskDraft(proposal.id, tempId, updates)}
            agents={agents}
            sessionMessages={sessionMessages}
            actionButtons={<>
              {isDraft && <ActionButton testId="proposal-edit" onClick={() => { useAppStore.getState().editingProposalId = proposal.id; useAppStore.getState().setViewMode('proposal-editor') }} disabled={false} color="var(--amber)" icon={<Pencil size={13} />} label="Edit" />}
              {isDraft && proposal.taskDrafts.length > 0 && <ActionButton testId="proposal-submit" onClick={handleSubmit} disabled={isProcessing} color="var(--amber)" icon={<ArrowRight size={13} />} label="Submit" />}
              {isPending && <ActionButton testId="proposal-approve" onClick={handleApprove} disabled={isProcessing} color="var(--status-green)" icon={<CheckCircle size={13} />} label="Approve" />}
              {isPending && <ActionButton testId="proposal-reject" onClick={handleReject} disabled={isProcessing} color="var(--warm-red)" icon={<XCircle size={13} />} label="Reject" />}
              {(proposal.status === 'pending' || proposal.status === 'rejected' || proposal.status === 'approved') && <ActionButton testId="proposal-revert" onClick={async () => { if (!confirm('Revert to draft?')) return; setIsProcessing(true); try { await useAppStore.getState().sendToBackend('proposals:revert', proposal.id); useAppStore.getState().clearActivityFeed(); await Promise.all([useAppStore.getState().loadProposals(), useAppStore.getState().loadTasks(), useAppStore.getState().loadSessions()]) } catch (e) { console.error(e) } finally { setIsProcessing(false) } }} disabled={isProcessing} color="var(--amber)" icon={<ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />} label="Revert" />}
            </>}
          />
          </div>

          {/* Footer */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono, monospace' }}>
              Created {formatDistanceToNow(proposal.createdAt, { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: 4,
            cursor: 'col-resize',
            backgroundColor: isDragging ? 'var(--amber)' : 'var(--border-subtle)',
            flexShrink: 0,
            transition: isDragging ? 'none' : 'background-color 0.15s',
            zIndex: 10,
          }}
        />

        {/* Right: Activity Feed */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ActivityFeed events={activityFeed} taskIds={relatedTaskIds} />
        </div>
      </div>
    </div>
  )
}

function ActionButton({ onClick, disabled, color, icon, label, testId }: {
  onClick: () => void
  disabled: boolean
  color: string
  icon: React.ReactNode
  label: string
  testId?: string
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
        backgroundColor: 'transparent', border: `1px solid ${color}`, borderRadius: 0,
        color: color, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

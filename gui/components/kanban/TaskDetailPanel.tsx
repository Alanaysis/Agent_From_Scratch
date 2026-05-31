'use client'

import * as React from 'react'
import { X, Clock, AlertCircle, User, CheckCircle, XCircle, Loader2, MessageSquare, ChevronRight, MessageCircle, Link2, ArrowRight } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pixelAvatarToDataUrl, getAgentColor } from '@/lib/pixelAvatar'
import type { Task, TaskDetail } from '@/types'

interface TaskDetailPanelProps {
  task: TaskDetail
  onClose: () => void
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  todo: { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', label: 'To Do', icon: <ChevronRight size={11} /> },
  in_progress: { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', label: 'In Progress', icon: <Loader2 size={11} /> },
  verify: { color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.1)', label: 'Verify', icon: <Clock size={11} /> },
  done: { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)', label: 'Done', icon: <CheckCircle size={11} /> },
  failed: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Failed', icon: <XCircle size={11} /> },
}

const actionLabels: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: '#666' },
  assigned: { label: 'Assigned', color: '#3b82f6' },
  released: { label: 'Released', color: '#f59e0b' },
  status_changed: { label: 'Status changed', color: '#a855f7' },
  updated: { label: 'Updated', color: '#666' },
  comment_added: { label: 'Comment', color: '#22c55e' },
}

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { tasks, updateTaskStatus, deleteTaskBackend, agents, loadAgents, setViewMode, jumpToSession } = useAppStore()
  const [assigneeInput, setAssigneeInput] = React.useState(task.assignee || '')
  const [commentInput, setCommentInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [showAgentList, setShowAgentList] = React.useState(false)

  React.useEffect(() => {
    if (agents.length === 0) {
      loadAgents()
    }
  }, [agents.length])

  const agentOptions = [
    { id: 'executor-agent', name: 'Executor Agent (auto)', capabilities: ['auto'] },
    ...agents.map(a => ({ id: a.name, name: a.name, capabilities: (a as any).capabilities || [] }))
  ]

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-agent-dropdown]')) {
        setShowAgentList(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const status = statusConfig[task.status] || statusConfig.todo

  const handleStatusChange = async (newStatus: Task['status']) => {
    setIsLoading(true)
    try {
      await updateTaskStatus(task.id, newStatus)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssign = async () => {
    setIsLoading(true)
    try {
      await useAppStore.getState().sendToBackend('tasks:assign', {
        taskId: task.id,
        assignee: assigneeInput,
        actor: 'user',
      })
      await useAppStore.getState().loadTasks()
    } finally {
      setIsLoading(false)
    }
  }

  const handleRelease = async () => {
    setIsLoading(true)
    try {
      await useAppStore.getState().sendToBackend('tasks:release', {
        taskId: task.id,
        actor: 'user',
      })
      setAssigneeInput('')
      await useAppStore.getState().loadTasks()
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!commentInput.trim()) return
    setIsLoading(true)
    try {
      await useAppStore.getState().sendToBackend('tasks:add_comment', {
        taskId: task.id,
        comment: commentInput,
        actor: 'user',
      })
      setCommentInput('')
      await useAppStore.getState().loadTasks()
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = () => {
    deleteTaskBackend(task.id)
    onClose()
  }

  const handleViewInChat = async () => {
    if (task.sessionId) {
      await jumpToSession(task.sessionId)
    } else {
      setViewMode('chat')
    }
  }

  const activities = (task.activities || []).map(a => ({
    ...a,
    timestamp: typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp
  }))

  const otherTasks = tasks.filter(t => t.id !== task.id)

  const depTasks = (task.dependsOn || []).map(depId => {
    const dep = otherTasks.find(t => t.id === depId)
    return dep ? { ...dep, resolved: dep.status === 'done' || dep.status === 'failed' } : null
  }).filter(Boolean)

  const blockedByDeps = depTasks.some(d => d && !d.resolved)

  return (
    <div style={{
      width: 380,
      height: '100%',
      backgroundColor: '#111',
      borderLeft: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `linear-gradient(180deg, ${status.color}08 0%, transparent 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            backgroundColor: status.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: status.color,
          }}>
            {status.icon}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Task Details</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} style={{ width: 24, height: 24 }}>
          <X size={14} />
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Title & Description */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{task.title}</h2>
          {task.description && (
            <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 10 }}>{task.description}</p>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 8px',
              borderRadius: 5,
              backgroundColor: status.bgColor,
              color: status.color,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {status.icon}
              {status.label}
            </span>
            <span style={{
              padding: '3px 8px',
              borderRadius: 5,
              backgroundColor: task.priority === 'high' ? 'rgba(239,68,68,0.1)' : task.priority === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(102,102,102,0.1)',
              color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#666',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {task.priority}
            </span>
            {(task.status === 'in_progress' || task.status === 'verify') && task.sessionId && (
              <button
                onClick={handleViewInChat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  backgroundColor: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  borderRadius: 5,
                  color: '#a78bfa',
                  cursor: 'pointer'
                }}
              >
                <MessageCircle size={10} />
                View in Chat
              </button>
            )}
          </div>
        </div>

        {/* Assignee */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
            Assignee
          </label>
          <div style={{ position: 'relative' }} data-agent-dropdown="true">
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Input
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                  onFocus={() => setShowAgentList(true)}
                  placeholder="Select agent..."
                  style={{ flex: 1, height: 34, fontSize: 12, backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6 }}
                />
                {showAgentList && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: 8,
                    maxHeight: 200,
                    overflow: 'auto',
                    zIndex: 50,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    {agentOptions.map(agent => (
                      <div
                        key={agent.id}
                        onClick={() => {
                          setAssigneeInput(agent.id)
                          setShowAgentList(false)
                        }}
                        style={{
                          padding: '8px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          backgroundColor: assigneeInput === agent.id ? '#2a2a2a' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          borderBottom: '1px solid #222',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#222')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = assigneeInput === agent.id ? '#2a2a2a' : 'transparent')}
                      >
                        <img
                          src={pixelAvatarToDataUrl(agent.id, 20)}
                          alt={agent.name}
                          style={{ width: 20, height: 20, borderRadius: 4 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: 500 }}>{agent.name}</div>
                          {agent.capabilities.length > 0 && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                              {agent.capabilities.map((cap: string) => (
                                <span key={cap} style={{
                                  fontSize: 8,
                                  color: '#888',
                                  backgroundColor: '#333',
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                }}>
                                  {cap}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleAssign} disabled={!assigneeInput.trim() || isLoading} style={{ height: 34, borderRadius: 6 }}>
                Assign
              </Button>
            </div>
          </div>
          {task.assignee && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              padding: '6px 10px',
              backgroundColor: '#0d0d0d',
              borderRadius: 6,
              border: `1px solid ${getAgentColor(task.assignee)}33`,
            }}>
              <img
                src={pixelAvatarToDataUrl(task.assignee, 24)}
                alt={task.assignee}
                style={{ width: 24, height: 24, borderRadius: 4 }}
              />
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 500, flex: 1 }}>{task.assignee}</span>
              <Button variant="ghost" size="icon" onClick={handleRelease} style={{ width: 20, height: 20 }}>
                <X size={12} color="#888" />
              </Button>
            </div>
          )}
        </div>

        {/* Dependencies */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
            Dependencies
          </label>
          {depTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {depTasks.map((dep: any) => {
                const depStatus = statusConfig[dep.status]
                return (
                  <div key={dep.id} style={{
                    padding: '8px 10px',
                    backgroundColor: '#0d0d0d',
                    borderRadius: 6,
                    fontSize: 11,
                    border: `1px solid ${dep.resolved ? '#22c55e22' : '#f59e0b33'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    {dep.resolved ? (
                      <CheckCircle size={12} color="#22c55e" />
                    ) : (
                      <AlertCircle size={12} color="#f59e0b" />
                    )}
                    <span style={{ flex: 1, color: '#fff' }}>{dep.title}</span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                      backgroundColor: depStatus?.bgColor,
                      color: depStatus?.color,
                    }}>
                      {depStatus?.label}
                    </span>
                  </div>
                )
              })}
              {blockedByDeps && (
                <div style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px dashed rgba(245, 158, 11, 0.25)',
                  fontSize: 10,
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <AlertCircle size={10} />
                  Blocked — dependencies not resolved
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#444', padding: '4px 0' }}>No dependencies</div>
          )}
        </div>

        {/* Related Documents */}
        {task.relatedDocumentIds && task.relatedDocumentIds.length > 0 && (() => {
          const relatedDocs = useAppStore.getState().documents.filter(d => task.relatedDocumentIds?.includes(d.id))
          if (relatedDocs.length === 0) return null
          return (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
                Related Documents
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {relatedDocs.map(doc => {
                  const docColor = { prd: '#3b82f6', tech_design: '#8b5cf6', adr: '#f59e0b', spec: '#22c55e', guide: '#06b6d4', report: '#ef4444' }[doc.type] || '#666'
                  return (
                    <div key={doc.id} style={{
                      padding: '6px 8px',
                      backgroundColor: '#0d0d0d',
                      borderRadius: 6,
                      border: `1px solid ${docColor}22`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                      onClick={() => useAppStore.getState().setViewMode('documents')}
                    >
                      <span style={{ fontSize: 8, fontWeight: 700, color: docColor, backgroundColor: docColor + '15', padding: '1px 4px', borderRadius: 3 }}>
                        {doc.type === 'tech_design' ? 'TECH' : doc.type.toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontSize: 11, color: '#ccc' }}>{doc.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Acceptance Criteria */}
        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
              Acceptance Criteria
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(task.acceptanceCriteria || []).map((ac) => {
                const acStatus = ac.status || 'pending'
                const acColor = acStatus === 'passed' ? '#22c55e' : acStatus === 'failed' ? '#ef4444' : '#666'
                return (
                  <div key={ac.id} style={{
                    padding: '6px 8px',
                    backgroundColor: '#0d0d0d',
                    borderRadius: 6,
                    border: `1px solid ${acColor}22`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      backgroundColor: acColor + '15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {acStatus === 'passed' ? <CheckCircle size={10} color={acColor} /> :
                       acStatus === 'failed' ? <XCircle size={10} color={acColor} /> :
                       <Clock size={10} color={acColor} />}
                    </div>
                    <span style={{ flex: 1, fontSize: 11, color: '#ccc' }}>{ac.text}</span>
                    {(task.status === 'verify' || task.status === 'in_progress') && acStatus === 'pending' && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          onClick={async () => {
                            await useAppStore.getState().sendToBackend('tasks:update_criterion', {
                              taskId: task.id,
                              criterionId: ac.id,
                              status: 'passed',
                            })
                            await useAppStore.getState().loadTasks()
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                          title="Mark as passed"
                        >
                          <CheckCircle size={12} color="#22c55e" />
                        </button>
                        <button
                          onClick={async () => {
                            await useAppStore.getState().sendToBackend('tasks:update_criterion', {
                              taskId: task.id,
                              criterionId: ac.id,
                              status: 'failed',
                            })
                            await useAppStore.getState().loadTasks()
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                          title="Mark as failed"
                        >
                          <XCircle size={12} color="#ef4444" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
            Actions
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {task.status === 'todo' && (
              <ActionButton
                onClick={() => handleStatusChange('in_progress')}
                disabled={isLoading || blockedByDeps}
                color="#f59e0b"
                icon={<ArrowRight size={13} />}
                label="Start Working"
                hint={blockedByDeps ? 'Resolve dependencies first' : undefined}
              />
            )}
            {task.status === 'in_progress' && (
              <ActionButton
                onClick={() => handleStatusChange('verify')}
                disabled={isLoading}
                color="#a855f7"
                icon={<CheckCircle size={13} />}
                label="Submit for Verify"
              />
            )}
            {task.status === 'verify' && (
              <>
                <ActionButton
                  onClick={() => handleStatusChange('done')}
                  disabled={isLoading}
                  color="#22c55e"
                  icon={<CheckCircle size={13} />}
                  label="Approve & Complete"
                />
                <ActionButton
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isLoading}
                  color="#f59e0b"
                  icon={<XCircle size={13} />}
                  label="Reject & Retry"
                />
              </>
            )}
            {(task.status === 'failed' || task.status === 'todo') && (
              <ActionButton
                onClick={() => handleStatusChange('failed')}
                disabled={isLoading}
                color="#ef4444"
                icon={<AlertCircle size={13} />}
                label="Mark as Failed"
              />
            )}
            <div style={{ height: 1, backgroundColor: '#1a1a1a', margin: '4px 0' }} />
            <ActionButton
              onClick={handleDelete}
              disabled={isLoading}
              color="#ef4444"
              icon={<XCircle size={13} />}
              label="Delete Task"
              variant="ghost"
            />
          </div>
        </div>

        {/* Add Comment */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
            Add Comment
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              style={{ flex: 1, height: 34, fontSize: 12, backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6 }}
            />
            <Button onClick={handleAddComment} disabled={!commentInput.trim() || isLoading} style={{ height: 34, borderRadius: 6 }}>
              <MessageSquare size={14} />
            </Button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
            Activity
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[...activities].reverse().map((activity, i) => {
              const actionCfg = actionLabels[activity.action] || { label: activity.action, color: '#666' }
              return (
                <div key={activity.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  {/* Timeline line */}
                  {i < activities.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      left: 5,
                      top: 14,
                      bottom: -4,
                      width: 1,
                      backgroundColor: '#1a1a1a',
                    }} />
                  )}
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: actionCfg.color,
                    marginTop: 4,
                    flexShrink: 0,
                    border: '2px solid #111',
                  }} />
                  <div style={{ flex: 1, paddingBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#ccc' }}>
                      <span style={{ color: actionCfg.color, fontWeight: 500 }}>{actionCfg.label}</span>
                      {activity.details && <span style={{ color: '#666' }}> — {activity.details}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      {activity.actor && ` by ${activity.actor}`}
                    </div>
                  </div>
                </div>
              )
            })}
            {activities.length === 0 && (
              <div style={{ fontSize: 11, color: '#444' }}>No activity yet</div>
            )}
          </div>
        </div>

        {/* Last Error */}
        {task.lastError && (
          <div style={{
            marginTop: 16,
            padding: 10,
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertCircle size={12} color="#ef4444" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444' }}>Last Error</span>
            </div>
            <p style={{ fontSize: 11, color: '#ccc', lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{task.lastError}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #1a1a1a',
        fontSize: 10,
        color: '#444',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Created {formatDistanceToNow(task.createdAt, { addSuffix: true })}</span>
        <span>{format(task.createdAt, 'MMM d, HH:mm')}</span>
      </div>
    </div>
  )
}

function ActionButton({ onClick, disabled, color, icon, label, hint, variant }: {
  onClick: () => void
  disabled: boolean
  color: string
  icon: React.ReactNode
  label: string
  hint?: string
  variant?: 'default' | 'ghost'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 6,
        backgroundColor: variant === 'ghost' ? 'transparent' : color + '10',
        border: `1px solid ${variant === 'ghost' ? '#1a1a1a' : color + '25'}`,
        color: disabled ? '#444' : color,
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = color + '20'
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = variant === 'ghost' ? 'transparent' : color + '10'
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontSize: 9, color: '#555' }}>{hint}</span>}
    </button>
  )
}

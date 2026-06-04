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
  in_progress: { color: 'var(--amber)', bgColor: 'rgba(245, 158, 11, 0.08)', label: 'In Progress', icon: <Loader2 size={11} /> },
  verify: { color: '#7b68c0', bgColor: 'rgba(123, 104, 192, 0.1)', label: 'Verify', icon: <Clock size={11} /> },
  done: { color: '#5cb85c', bgColor: 'rgba(92, 184, 92, 0.1)', label: 'Done', icon: <CheckCircle size={11} /> },
  failed: { color: 'var(--warm-red)', bgColor: 'rgba(220, 80, 80, 0.08)', label: 'Failed', icon: <XCircle size={11} /> },
}

const actionLabels: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: 'var(--text-muted)' },
  assigned: { label: 'Assigned', color: '#3b82f6' },
  released: { label: 'Released', color: 'var(--amber)' },
  status_changed: { label: 'Status changed', color: '#7b68c0' },
  updated: { label: 'Updated', color: 'var(--text-muted)' },
  comment_added: { label: 'Comment', color: '#5cb85c' },
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
      backgroundColor: 'var(--surface-0)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `linear-gradient(180deg, ${status.bgColor} 0%, transparent 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 2,
            backgroundColor: status.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: status.color,
          }}>
            {status.icon}
          </div>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.03em',
          }}>Task Details</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} style={{ width: 24, height: 24 }}>
          <X size={14} />
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Title & Description */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 6,
            lineHeight: 1.3,
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}>{task.title}</h2>
          {task.description && (
            <p style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: 10,
            }}>{task.description}</p>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 8px',
              borderRadius: 2,
              backgroundColor: status.bgColor,
              color: status.color,
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.04em',
            }}>
              {status.icon}
              {status.label}
            </span>
            <span style={{
              padding: '3px 8px',
              borderRadius: 2,
              backgroundColor: task.priority === 'high' ? 'rgba(220,80,80,0.08)' : task.priority === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(102,102,102,0.08)',
              color: task.priority === 'high' ? 'var(--warm-red)' : task.priority === 'medium' ? 'var(--amber)' : 'var(--text-muted)',
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
              {task.priority}
            </span>
            {task.sessionId && (
              <button
                onClick={handleViewInChat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 500,
                  fontFamily: 'IBM Plex Mono, monospace',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 2,
                  color: 'var(--amber)',
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
          <label style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
            display: 'block',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
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
                  style={{
                    flex: 1,
                    height: 34,
                    fontSize: 12,
                    backgroundColor: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 2,
                    color: 'var(--text-primary)',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                />
                {showAgentList && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 2,
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
                          backgroundColor: assigneeInput === agent.id ? 'var(--surface-3)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          borderBottom: '1px solid var(--border-subtle)',
                          fontFamily: 'IBM Plex Sans, sans-serif',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-3)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = assigneeInput === agent.id ? 'var(--surface-3)' : 'transparent')}
                      >
                        <img
                          src={pixelAvatarToDataUrl(agent.id, 20)}
                          alt={agent.name}
                          style={{ width: 20, height: 20, borderRadius: 2 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{agent.name}</div>
                          {agent.capabilities.length > 0 && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                              {agent.capabilities.map((cap: string) => (
                                <span key={cap} style={{
                                  fontSize: 8,
                                  color: 'var(--text-muted)',
                                  backgroundColor: 'var(--surface-3)',
                                  padding: '1px 4px',
                                  borderRadius: 2,
                                  fontFamily: 'IBM Plex Mono, monospace',
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
              <Button onClick={handleAssign} disabled={!assigneeInput.trim() || isLoading} style={{
                height: 34,
                borderRadius: 0,
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.03em',
              }}>
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
              backgroundColor: 'var(--surface-1)',
              borderRadius: 2,
              border: '1px solid var(--border-subtle)',
            }}>
              <img
                src={pixelAvatarToDataUrl(task.assignee, 24)}
                alt={task.assignee}
                style={{ width: 24, height: 24, borderRadius: 2 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>{task.assignee}</span>
              <Button variant="ghost" size="icon" onClick={handleRelease} style={{ width: 20, height: 20 }}>
                <X size={12} color="var(--text-muted)" />
              </Button>
            </div>
          )}
        </div>

        {/* Dependencies */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
            display: 'block',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            Dependencies
          </label>
          {depTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {depTasks.map((dep: any) => {
                const depStatus = statusConfig[dep.status]
                return (
                  <div key={dep.id} style={{
                    padding: '8px 10px',
                    backgroundColor: 'var(--surface-1)',
                    borderRadius: 2,
                    fontSize: 11,
                    border: `1px solid ${dep.resolved ? 'rgba(92,184,92,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    {dep.resolved ? (
                      <CheckCircle size={12} color="#5cb85c" />
                    ) : (
                      <AlertCircle size={12} color="var(--amber)" />
                    )}
                    <span style={{ flex: 1, color: 'var(--text-primary)' }}>{dep.title}</span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 2,
                      fontSize: 9,
                      fontWeight: 600,
                      fontFamily: 'IBM Plex Mono, monospace',
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
                  borderRadius: 2,
                  backgroundColor: 'rgba(245, 158, 11, 0.06)',
                  border: '1px dashed rgba(245, 158, 11, 0.25)',
                  fontSize: 10,
                  color: 'var(--amber)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'IBM Plex Mono, monospace',
                }}>
                  <AlertCircle size={10} />
                  Blocked — dependencies not resolved
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>No dependencies</div>
          )}
        </div>

        {/* Related Documents */}
        {task.relatedDocumentIds && task.relatedDocumentIds.length > 0 && (() => {
          const relatedDocs = useAppStore.getState().documents.filter(d => task.relatedDocumentIds?.includes(d.id))
          if (relatedDocs.length === 0) return null
          return (
            <div style={{ marginBottom: 16 }}>
              <label style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
                display: 'block',
                fontFamily: 'IBM Plex Mono, monospace',
              }}>
                Related Documents
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {relatedDocs.map(doc => {
                  const docColor = { prd: '#3b82f6', tech_design: '#7b68c0', adr: 'var(--amber)', spec: '#5cb85c', guide: '#06b6d4', report: 'var(--warm-red)' }[doc.type] || 'var(--text-muted)'
                  return (
                    <div key={doc.id} style={{
                      padding: '6px 8px',
                      backgroundColor: 'var(--surface-1)',
                      borderRadius: 2,
                      border: `1px solid var(--border-subtle)`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                      onClick={() => useAppStore.getState().setViewMode('documents')}
                    >
                      <span style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: docColor,
                        backgroundColor: 'var(--surface-2)',
                        padding: '1px 4px',
                        borderRadius: 2,
                        fontFamily: 'IBM Plex Mono, monospace',
                        letterSpacing: '0.05em',
                      }}>
                        {doc.type === 'tech_design' ? 'TECH' : doc.type.toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)' }}>{doc.title}</span>
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
            <label style={{
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
              display: 'block',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
              Acceptance Criteria
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(task.acceptanceCriteria || []).map((ac) => {
                const acStatus = ac.status || 'pending'
                const acColor = acStatus === 'passed' ? '#5cb85c' : acStatus === 'failed' ? 'var(--warm-red)' : 'var(--text-muted)'
                return (
                  <div key={ac.id} style={{
                    padding: '6px 8px',
                    backgroundColor: 'var(--surface-1)',
                    borderRadius: 2,
                    border: `1px solid var(--border-subtle)`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: 2,
                      backgroundColor: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {acStatus === 'passed' ? <CheckCircle size={10} color={acColor} /> :
                       acStatus === 'failed' ? <XCircle size={10} color={acColor} /> :
                       <Clock size={10} color={acColor} />}
                    </div>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)' }}>{ac.text}</span>
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
                          <CheckCircle size={12} color="#5cb85c" />
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
                          <XCircle size={12} color="var(--warm-red)" />
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
          <label style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
            display: 'block',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            Actions
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {task.status === 'todo' && task.assignee && (
              <ActionButton
                onClick={async () => {
                  setIsLoading(true)
                  try {
                    // Trigger task execution via IPC
                    await useAppStore.getState().sendToBackend('tasks:execute', { taskId: task.id })
                    // Refresh tasks after execution
                    await useAppStore.getState().loadTasks()
                  } catch (e) {
                    console.error('[TaskDetail] Execute error:', e)
                  } finally {
                    setIsLoading(false)
                  }
                }}
                disabled={isLoading || blockedByDeps}
                color="#5cb85c"
                icon={<ArrowRight size={13} />}
                label={task.requiresApproval ? 'Execute (requires approval)' : 'Execute'}
                hint={blockedByDeps ? 'Resolve dependencies first' : undefined}
              />
            )}
            {task.status === 'todo' && !task.assignee && (
              <ActionButton
                onClick={() => handleStatusChange('in_progress')}
                disabled={isLoading || blockedByDeps}
                color="var(--amber)"
                icon={<ArrowRight size={13} />}
                label="Start Working"
                hint={blockedByDeps ? 'Resolve dependencies first' : undefined}
              />
            )}
            {task.status === 'in_progress' && (
              <ActionButton
                onClick={() => handleStatusChange('verify')}
                disabled={isLoading}
                color="#7b68c0"
                icon={<CheckCircle size={13} />}
                label="Submit for Verify"
              />
            )}
            {task.status === 'verify' && (
              <>
                <ActionButton
                  onClick={() => handleStatusChange('done')}
                  disabled={isLoading}
                  color="#5cb85c"
                  icon={<CheckCircle size={13} />}
                  label="Approve & Complete"
                />
                <ActionButton
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isLoading}
                  color="var(--amber)"
                  icon={<XCircle size={13} />}
                  label="Reject & Retry"
                />
              </>
            )}
            {(task.status === 'failed' || task.status === 'todo') && (
              <ActionButton
                onClick={() => handleStatusChange('failed')}
                disabled={isLoading}
                color="var(--warm-red)"
                icon={<AlertCircle size={13} />}
                label="Mark as Failed"
              />
            )}
            <div style={{ height: 1, backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
            <ActionButton
              onClick={handleDelete}
              disabled={isLoading}
              color="var(--warm-red)"
              icon={<XCircle size={13} />}
              label="Delete Task"
              variant="ghost"
            />
          </div>
        </div>

        {/* Add Comment */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
            display: 'block',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            Add Comment
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              style={{
                flex: 1,
                height: 34,
                fontSize: 12,
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2,
                color: 'var(--text-primary)',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
            />
            <Button onClick={handleAddComment} disabled={!commentInput.trim() || isLoading} style={{
              height: 34,
              borderRadius: 0,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
            }}>
              <MessageSquare size={14} />
            </Button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div>
          <label style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 8,
            display: 'block',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            Activity
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[...activities].reverse().map((activity, i) => {
              const actionCfg = actionLabels[activity.action] || { label: activity.action, color: 'var(--text-muted)' }
              return (
                <div key={activity.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  {/* Timeline line */}
                  {i < activities.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      left: 4,
                      top: 14,
                      bottom: -4,
                      width: 1,
                      backgroundColor: 'var(--border-subtle)',
                    }} />
                  )}
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'var(--amber)',
                    marginTop: 5,
                    flexShrink: 0,
                    border: '1px solid var(--surface-0)',
                    opacity: 0.8,
                  }} />
                  <div style={{ flex: 1, paddingBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ color: actionCfg.color, fontWeight: 500, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>{actionCfg.label}</span>
                      {activity.details && <span style={{ color: 'var(--text-muted)' }}> — {activity.details}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      {activity.actor && ` by ${activity.actor}`}
                    </div>
                  </div>
                </div>
              )
            })}
            {activities.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No activity yet</div>
            )}
          </div>
        </div>

        {/* Last Error */}
        {task.lastError && (
          <div style={{
            marginTop: 16,
            padding: 10,
            backgroundColor: 'rgba(220, 80, 80, 0.06)',
            borderRadius: 2,
            border: '1px solid rgba(220, 80, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertCircle size={12} color="var(--warm-red)" />
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--warm-red)',
                fontFamily: 'IBM Plex Mono, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>Last Error</span>
            </div>
            <p style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>{task.lastError}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        color: 'var(--text-faint)',
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'IBM Plex Mono, monospace',
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
        borderRadius: 0,
        backgroundColor: variant === 'ghost' ? 'transparent' : 'var(--surface-1)',
        border: `1px solid ${variant === 'ghost' ? 'var(--border-subtle)' : 'var(--border-subtle)'}`,
        color: disabled ? 'var(--text-faint)' : color,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'IBM Plex Mono, monospace',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
        letterSpacing: '0.02em',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = variant === 'ghost' ? 'transparent' : 'var(--surface-1)'
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{hint}</span>}
    </button>
  )
}

'use client'

import * as React from 'react'
import { X, Clock, AlertCircle, User, CheckCircle, XCircle, Loader2, MessageSquare, ChevronRight, MessageCircle } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Task, TaskDetail } from '@/types'

interface TaskDetailPanelProps {
  task: TaskDetail
  onClose: () => void
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  todo: { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', label: 'To Do' },
  in_progress: { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', label: 'In Progress' },
  verify: { color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.1)', label: 'Verify' },
  done: { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)', label: 'Done' },
  failed: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Failed' },
}

const actionLabels: Record<string, string> = {
  created: 'Created',
  assigned: 'Assigned',
  released: 'Released',
  status_changed: 'Status changed',
  updated: 'Updated',
  comment_added: 'Comment added',
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
    { id: 'executor-agent', name: 'Executor Agent (auto)' },
    ...agents.map(a => ({ id: a.name, name: a.name }))
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
  const statusHistory = (task.statusHistory || []).map(s => ({
    ...s,
    timestamp: typeof s.timestamp === 'string' ? new Date(s.timestamp).getTime() : s.timestamp
  }))

  const otherTasks = tasks.filter(t => t.id !== task.id)

  return (
    <div style={{
      width: 360,
      height: '100%',
      backgroundColor: '#111',
      borderLeft: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Task Details</span>
        <Button variant="ghost" size="icon" onClick={onClose} style={{ width: 24, height: 24 }}>
          <X size={14} />
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 8 }}>{task.title}</h2>
          {task.description && (
            <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 12 }}>{task.description}</p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: status.bgColor,
              color: status.color,
              fontSize: 11,
              fontWeight: 500
            }}>
              {status.label}
            </span>
            <span style={{
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(102, 102, 102, 0.2)',
              color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#666',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase'
            }}>
              {task.priority}
            </span>
            {task.status === 'in_progress' && (
              <button
                onClick={handleViewInChat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 22,
                  padding: '0 8px',
                  fontSize: 10,
                  fontWeight: 500,
                  backgroundColor: '#7c3aed',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                <MessageCircle size={10} />
                View in Chat
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
            Assignee
          </label>
          <div style={{ position: 'relative' }} data-agent-dropdown="true">
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Input
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                  onFocus={() => setShowAgentList(true)}
                  placeholder="Select or type agent..."
                  style={{ flex: 1, height: 32, fontSize: 12, backgroundColor: '#0a0a0a', border: '1px solid #222' }}
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
                    borderRadius: 6,
                    maxHeight: 160,
                    overflow: 'auto',
                    zIndex: 50
                  }}>
                    {agentOptions.map(agent => (
                      <div
                        key={agent.id}
                        onClick={() => {
                          setAssigneeInput(agent.id)
                          setShowAgentList(false)
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                          backgroundColor: assigneeInput === agent.id ? '#2a2a2a' : 'transparent'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#222')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = assigneeInput === agent.id ? '#2a2a2a' : 'transparent')}
                      >
                        {agent.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleAssign} disabled={!assigneeInput.trim() || isLoading} style={{ height: 32 }}>
                Assign
              </Button>
            </div>
          </div>
          {task.assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <User size={12} color="#888" />
              <span style={{ fontSize: 12, color: '#fff' }}>{task.assignee}</span>
              <Button variant="ghost" size="icon" onClick={handleRelease} style={{ width: 20, height: 20, marginLeft: 'auto' }}>
                <X size={12} />
              </Button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
            Dependencies
          </label>
          {task.dependsOn && task.dependsOn.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {task.dependsOn.map(depId => {
                const depTask = otherTasks.find(t => t.id === depId)
                return (
                  <div key={depId} style={{
                    padding: '6px 10px',
                    backgroundColor: '#0a0a0a',
                    borderRadius: 4,
                    fontSize: 11,
                    color: depTask ? '#fff' : '#666',
                    border: '1px solid #1a1a1a'
                  }}>
                    {depTask ? depTask.title : depId}
                    {depTask && (
                      <span style={{
                        marginLeft: 6,
                        padding: '2px 4px',
                        borderRadius: 2,
                        fontSize: 9,
                        backgroundColor: statusConfig[depTask.status]?.bgColor,
                        color: statusConfig[depTask.status]?.color,
                      }}>
                        {statusConfig[depTask.status]?.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#666' }}>No dependencies</div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            Actions
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {task.status === 'todo' && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange('in_progress')}
                disabled={isLoading}
                style={{ justifyContent: 'flex-start', gap: 8, height: 36 }}
              >
                <ChevronRight size={14} />
                Start Working
              </Button>
            )}
            {task.status === 'in_progress' && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange('verify')}
                disabled={isLoading}
                style={{ justifyContent: 'flex-start', gap: 8, height: 36 }}
              >
                <CheckCircle size={14} />
                Submit for Verify
              </Button>
            )}
            {task.status === 'verify' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('done')}
                  disabled={isLoading}
                  style={{ justifyContent: 'flex-start', gap: 8, height: 36, borderColor: '#22c55e', color: '#22c55e' }}
                >
                  <CheckCircle size={14} />
                  Approve & Complete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isLoading}
                  style={{ justifyContent: 'flex-start', gap: 8, height: 36, borderColor: '#f59e0b', color: '#f59e0b' }}
                >
                  <XCircle size={14} />
                  Reject & Retry
                </Button>
              </>
            )}
            {(task.status === 'failed' || task.status === 'todo') && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange('failed')}
                disabled={isLoading}
                style={{ justifyContent: 'flex-start', gap: 8, height: 36, borderColor: '#ef4444', color: '#ef4444' }}
              >
                <AlertCircle size={14} />
                Mark as Failed
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isLoading}
              style={{ justifyContent: 'flex-start', gap: 8, height: 36, borderColor: '#ef4444', color: '#ef4444' }}
            >
              <XCircle size={14} />
              Delete Task
            </Button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
            Add Comment
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              style={{ flex: 1, height: 32, fontSize: 12, backgroundColor: '#0a0a0a', border: '1px solid #222' }}
            />
            <Button onClick={handleAddComment} disabled={!commentInput.trim() || isLoading} style={{ height: 32 }}>
              <MessageSquare size={14} />
            </Button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#666', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            Activity Timeline
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...activities].reverse().map(activity => (
              <div key={activity.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#333',
                  marginTop: 5,
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#fff' }}>
                    {actionLabels[activity.action] || activity.action}
                    {activity.details && <span style={{ color: '#888' }}> — {activity.details}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    {activity.actor && ` by ${activity.actor}`}
                  </div>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div style={{ fontSize: 12, color: '#666' }}>No activity yet</div>
            )}
          </div>
        </div>

        {task.lastError && (
          <div style={{
            marginTop: 16,
            padding: 10,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 6,
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertCircle size={12} color="#ef4444" />
              <span style={{ fontSize: 11, fontWeight: 500, color: '#ef4444' }}>Last Error</span>
            </div>
            <p style={{ fontSize: 11, color: '#fff' }}>{task.lastError}</p>
          </div>
        )}
      </div>

      <div style={{
        padding: 12,
        borderTop: '1px solid #1a1a1a',
        fontSize: 10,
        color: '#666'
      }}>
        Created {formatDistanceToNow(task.createdAt, { addSuffix: true })}
      </div>
    </div>
  )
}
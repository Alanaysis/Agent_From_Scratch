'use client'

import * as React from 'react'
import { Plus, Trash2, Link2, ChevronRight, ChevronDown, Loader2, CheckCircle2, XCircle, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pixelAvatarToDataUrl, getAgentColor } from '@/lib/pixelAvatar'
import { TaskDetailPanel } from './TaskDetailPanel'
import type { Task } from '@/types'

const statusGroups = [
  { id: 'active', label: 'Active', color: 'var(--amber)', icon: <Loader2 size={10} />, statuses: ['in_progress'] as Task['status'][] },
  { id: 'pending', label: 'Pending', color: 'var(--status-blue)', icon: <ChevronRight size={10} />, statuses: ['todo'] as Task['status'][] },
  { id: 'complete', label: 'Complete', color: 'var(--status-green)', icon: <CheckCircle2 size={10} />, statuses: ['verify', 'done', 'failed'] as Task['status'][] },
]

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'L', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  medium: { label: 'M', color: 'var(--amber)', bg: 'rgba(245,158,11,0.08)' },
  high: { label: 'H', color: 'var(--warm-red)', bg: 'rgba(220,80,80,0.08)' },
}

const statusBadge: Record<string, { label: string; color: string }> = {
  todo: { label: 'TODO', color: 'var(--status-blue)' },
  in_progress: { label: 'RUN', color: 'var(--amber)' },
  verify: { label: 'VRF', color: 'var(--status-purple)' },
  done: { label: 'DONE', color: 'var(--status-green)' },
  failed: { label: 'FAIL', color: 'var(--warm-red)' },
}

export function KanbanView() {
  const { tasks, createTask, deleteTaskBackend } = useAppStore()
  const [selectedTask, setSelectedTask] = React.useState<any>(null)
  const [newTaskTitle, setNewTaskTitle] = React.useState('')
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set())
  const [showAddTask, setShowAddTask] = React.useState(false)

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    await createTask({ title: newTaskTitle.trim(), status: 'todo', priority: 'medium' })
    setNewTaskTitle('')
    setShowAddTask(false)
  }

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    await deleteTaskBackend(taskId)
    if (selectedTask?.id === taskId) setSelectedTask(null)
  }

  const handleTaskClick = (task: Task) => {
    const fullTask = tasks.find(t => t.id === task.id)
    if (!fullTask) return
    const backendTask = useAppStore.getState().sendToBackend('tasks:get', task.id) as Promise<{ task: any }>
    backendTask.then(result => {
      if (result?.task) {
        setSelectedTask({
          ...fullTask,
          activities: result.task.activities || [],
          statusHistory: result.task.statusHistory || [],
        })
      } else {
        setSelectedTask(fullTask)
      }
    }).catch(() => {
      setSelectedTask(fullTask)
    })
  }

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getTasksByStatuses = (statuses: Task['status'][]) => tasks.filter(t => statuses.includes(t.status))

  const isBlocked = (task: Task): boolean => {
    if (!task.dependsOn || task.dependsOn.length === 0) return false
    return task.dependsOn.some(depId => {
      const dep = tasks.find(t => t.id === depId)
      return dep && dep.status !== 'done'
    })
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: 'var(--surface-0)',
      overflow: 'hidden',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      {/* Task list */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace' }}>
            Tasks ({tasks.length})
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowAddTask(!showAddTask)}
            style={{ width: 24, height: 24, borderRadius: 0 }}
          >
            <Plus size={12} />
          </Button>
        </div>

        {/* Add task input */}
        {showAddTask && (
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 4, flexShrink: 0 }}>
            <Input
              placeholder="Task title..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              style={{ flex: 1, height: 26, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}
            />
            <Button size="icon" variant="ghost" onClick={handleAddTask} style={{ width: 26, height: 26, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000' }}>
              <Plus size={10} />
            </Button>
          </div>
        )}

        {/* Grouped task list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {statusGroups.map(group => {
            const groupTasks = getTasksByStatuses(group.statuses)
            if (groupTasks.length === 0) return null
            const isCollapsed = collapsedGroups.has(group.id)

            return (
              <div key={group.id} style={{ marginBottom: 2 }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  <span style={{ color: group.color }}>{group.icon}</span>
                  <span>{group.label}</span>
                  <span style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--surface-2)',
                    padding: '1px 5px',
                    borderRadius: 0,
                    fontWeight: 600,
                  }}>
                    {groupTasks.length}
                  </span>
                </button>

                {/* Task rows */}
                {!isCollapsed && groupTasks.map(task => {
                  const blocked = isBlocked(task)
                  const pCfg = priorityConfig[task.priority] || priorityConfig.medium
                  const agentColor = task.assignee ? getAgentColor(task.assignee) : undefined
                  const isSelected = selectedTask?.id === task.id
                  const sBadge = statusBadge[task.status]

                  return (
                    <div
                      key={task.id}
                      className="task-row"
                      onClick={() => handleTaskClick(task)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px 4px 24px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--surface-2)' : 'transparent',
                        borderLeft: isSelected ? `2px solid ${group.color}` : '2px solid transparent',
                        transition: 'background-color 0.1s',
                        minWidth: 0,
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--surface-1)' }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      {/* Priority indicator */}
                      <span style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: pCfg.color,
                        backgroundColor: pCfg.bg,
                        padding: '1px 3px',
                        borderRadius: 0,
                        fontFamily: 'IBM Plex Mono, monospace',
                        flexShrink: 0,
                        width: 14,
                        textAlign: 'center',
                      }}>
                        {pCfg.label}
                      </span>

                      {/* Blocked indicator */}
                      {blocked && <Link2 size={9} color="var(--amber)" style={{ flexShrink: 0 }} />}

                      {/* Status badge (only in Complete group) */}
                      {group.id === 'complete' && sBadge && (
                        <span style={{
                          fontSize: 8,
                          fontWeight: 600,
                          color: sBadge.color,
                          fontFamily: 'IBM Plex Mono, monospace',
                          flexShrink: 0,
                        }}>
                          {sBadge.label}
                        </span>
                      )}

                      {/* Title */}
                      <span style={{
                        flex: 1,
                        fontSize: 11,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {task.title}
                      </span>

                      {/* Assignee */}
                      {task.assignee && (
                        <img
                          src={pixelAvatarToDataUrl(task.assignee, 12)}
                          alt={task.assignee}
                          style={{ width: 12, height: 12, borderRadius: 0, flexShrink: 0 }}
                          title={task.assignee}
                        />
                      )}

                      {/* Time */}
                      <span style={{
                        fontSize: 9,
                        color: 'var(--text-faint)',
                        fontFamily: 'IBM Plex Mono, monospace',
                        flexShrink: 0,
                      }}>
                        {formatDistanceToNow(task.updatedAt, { addSuffix: false })}
                      </span>

                      {/* Delete - only visible on hover */}
                      <button
                        onClick={(e) => handleDeleteTask(e, task.id)}
                        className="task-delete-btn"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          opacity: 0,
                          display: 'flex',
                          flexShrink: 0,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <Trash2 size={10} color="var(--text-muted)" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask as any}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .task-row:hover .task-delete-btn { opacity: 0.5 !important; }
        .task-row:hover .task-delete-btn:hover { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

'use client'

import * as React from 'react'
import { Plus, Clock, AlertCircle, Trash2, Link2, ChevronRight, Loader2, CheckCircle2, XCircle, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pixelAvatarToDataUrl, getAgentColor } from '@/lib/pixelAvatar'
import { TaskDetailPanel } from './TaskDetailPanel'
import type { Task } from '@/types'

const columns: { id: Task['status']; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'todo', label: 'To Do', color: '#3b82f6', icon: <ChevronRight size={12} /> },
  { id: 'in_progress', label: 'In Progress', color: 'var(--amber)', icon: <Loader2 size={12} /> },
  { id: 'verify', label: 'Verify', color: '#7b68c0', icon: <Eye size={12} /> },
  { id: 'done', label: 'Done', color: '#5cb85c', icon: <CheckCircle2 size={12} /> },
  { id: 'failed', label: 'Failed', color: 'var(--warm-red)', icon: <XCircle size={12} /> },
]

const priorityConfig = {
  low: { color: 'var(--text-muted)', bg: 'rgba(102,102,102,0.12)', label: 'LOW' },
  medium: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.12)', label: 'MED' },
  high: { color: 'var(--warm-red)', bg: 'rgba(239,68,68,0.12)', label: 'HI' },
}

export function KanbanView() {
  const { tasks, loadTasks, createTask, updateTaskStatus, deleteTaskBackend } = useAppStore()
  const [newTaskTitle, setNewTaskTitle] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedTask, setSelectedTask] = React.useState<(Task & { activities?: any[]; statusHistory?: any[] }) | null>(null)

  React.useEffect(() => {
    loadTasks().finally(() => setIsLoading(false))
  }, [])

  React.useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id)
      if (updated) {
        setSelectedTask({ ...selectedTask, ...updated })
      }
    }
  }, [tasks])

  const handleAddTask = async (status: Task['status']) => {
    const title = newTaskTitle[status]?.trim()
    if (!title) return
    await createTask({ title, status, priority: 'medium' })
    setNewTaskTitle((prev) => ({ ...prev, [status]: '' }))
  }

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    await deleteTaskBackend(taskId)
    if (selectedTask?.id === taskId) {
      setSelectedTask(null)
    }
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

  const getTasksByStatus = (status: Task['status']) => tasks.filter((t) => t.status === status)

  const isBlocked = (task: Task): boolean => {
    if (!task.dependsOn || task.dependsOn.length === 0) return false
    return task.dependsOn.some(depId => {
      const dep = tasks.find(t => t.id === depId)
      return dep && dep.status !== 'done' && dep.status !== 'failed'
    })
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: 'var(--surface-0)',
        color: 'var(--text-muted)',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 12,
        gap: 8,
      }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
        Loading tasks...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: 'var(--surface-0)',
      overflow: 'hidden',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 6,
        padding: 10,
        overflow: 'hidden'
      }}>
        {columns.map((col) => {
          const colTasks = getTasksByStatus(col.id)
          const activeCount = colTasks.filter(t => t.status === 'in_progress').length
          return (
            <div key={col.id} style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              backgroundColor: 'var(--surface-1)',
              borderRadius: 0,
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden'
            }}>
              {/* Column header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                borderTop: `2px solid ${col.color}`,
                flexShrink: 0,
                backgroundColor: 'var(--surface-1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 2,
                    backgroundColor: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: col.color,
                  }}>
                    {col.icon}
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: 'IBM Plex Mono, monospace',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--surface-2)',
                    padding: '1px 6px',
                    borderRadius: 0,
                    fontWeight: 600,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Task cards */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                {colTasks.map((task) => {
                  const blocked = isBlocked(task)
                  const pCfg = priorityConfig[task.priority] || priorityConfig.medium
                  const agentColor = task.assignee ? getAgentColor(task.assignee) : undefined

                  return (
                    <div key={task.id} style={{
                      padding: 10,
                      backgroundColor: selectedTask?.id === task.id ? 'var(--surface-2)' : 'var(--surface-0)',
                      borderRadius: 0,
                      border: `1px solid ${selectedTask?.id === task.id ? col.color : blocked ? 'var(--amber)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                      position: 'relative',
                      boxShadow: 'none',
                    }}
                      onClick={() => handleTaskClick(task)}
                      onMouseEnter={(e) => {
                        if (selectedTask?.id !== task.id) e.currentTarget.style.backgroundColor = 'var(--surface-1)'
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTask?.id !== task.id) e.currentTarget.style.backgroundColor = 'var(--surface-0)'
                      }}
                    >
                      {/* Blocked indicator */}
                      {blocked && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginBottom: 6,
                          padding: '3px 6px',
                          borderRadius: 0,
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                          border: '1px dashed var(--amber)',
                        }}>
                          <Link2 size={9} color="var(--amber)" />
                          <span style={{
                            fontSize: 9,
                            color: 'var(--amber)',
                            fontWeight: 500,
                            fontFamily: 'IBM Plex Mono, monospace',
                            textTransform: 'uppercase',
                            letterSpacing: 0.3,
                          }}>
                            Blocked by dependency
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        {/* Priority indicator */}
                        <div style={{
                          width: 3,
                          height: 32,
                          borderRadius: 0,
                          backgroundColor: pCfg.color,
                          flexShrink: 0,
                          marginTop: 1,
                        }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            marginBottom: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.3,
                          }}>
                            {task.title}
                          </h4>

                          {task.description && (
                            <p style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              marginBottom: 6,
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {task.description}
                            </p>
                          )}

                          {/* Footer */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {/* Priority badge */}
                              <span style={{
                                fontSize: 8,
                                fontWeight: 700,
                                color: pCfg.color,
                                backgroundColor: pCfg.bg,
                                padding: '1px 4px',
                                borderRadius: 0,
                                letterSpacing: 0.8,
                                fontFamily: 'IBM Plex Mono, monospace',
                                textTransform: 'uppercase',
                              }}>
                                {pCfg.label}
                              </span>

                              {/* Assignee avatar */}
                              {task.assignee && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <img
                                    src={pixelAvatarToDataUrl(task.assignee, 14)}
                                    alt={task.assignee}
                                    style={{ width: 14, height: 14, borderRadius: 0 }}
                                  />
                                  <span style={{
                                    fontSize: 9,
                                    color: agentColor,
                                    fontWeight: 500,
                                    fontFamily: 'IBM Plex Mono, monospace',
                                  }}>
                                    {task.assignee}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {/* Dependency count */}
                              {task.dependsOn && task.dependsOn.length > 0 && (
                                <span style={{
                                  fontSize: 9,
                                  color: 'var(--text-faint)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 2,
                                  fontFamily: 'IBM Plex Mono, monospace',
                                }}>
                                  <Link2 size={8} />
                                  {task.dependsOn.length}
                                </span>
                              )}

                              <span style={{
                                fontSize: 9,
                                color: 'var(--text-faint)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                fontFamily: 'IBM Plex Mono, monospace',
                              }}>
                                <Clock size={8} />
                                {formatDistanceToNow(task.updatedAt, { addSuffix: false })}
                              </span>

                              <button
                                onClick={(e) => handleDeleteTask(e, task.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 2,
                                  opacity: 0.3,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                              >
                                <Trash2 size={10} color="var(--text-muted)" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* New task input */}
                <div style={{ display: 'flex', gap: 4, marginTop: 'auto', paddingTop: 4 }}>
                  <Input
                    placeholder="Add task..."
                    value={newTaskTitle[col.id] || ''}
                    onChange={(e) => setNewTaskTitle((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask(col.id)}
                    style={{
                      flex: 1,
                      height: 30,
                      fontSize: 11,
                      fontFamily: 'IBM Plex Sans, sans-serif',
                      backgroundColor: 'var(--surface-0)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 0,
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleAddTask(col.id)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 0,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Plus size={12} />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask as any}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

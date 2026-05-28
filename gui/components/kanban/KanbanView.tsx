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
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b', icon: <Loader2 size={12} /> },
  { id: 'verify', label: 'Verify', color: '#a855f7', icon: <Eye size={12} /> },
  { id: 'done', label: 'Done', color: '#22c55e', icon: <CheckCircle2 size={12} /> },
  { id: 'failed', label: 'Failed', color: '#ef4444', icon: <XCircle size={12} /> },
]

const priorityConfig = {
  low: { color: '#666', bg: 'rgba(102,102,102,0.15)', label: 'L' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'M' },
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'H' },
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
        backgroundColor: '#0a0a0a',
        color: '#666',
        gap: 8,
      }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Loading tasks...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#0a0a0a',
      overflow: 'hidden'
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
              backgroundColor: '#111',
              borderRadius: 10,
              border: '1px solid #1a1a1a',
              overflow: 'hidden'
            }}>
              {/* Column header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid #1a1a1a',
                flexShrink: 0,
                background: `linear-gradient(180deg, ${col.color}08 0%, transparent 100%)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    backgroundColor: col.color + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: col.color,
                  }}>
                    {col.icon}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{col.label}</span>
                  <span style={{
                    fontSize: 10,
                    color: col.color,
                    backgroundColor: col.color + '15',
                    padding: '1px 6px',
                    borderRadius: 10,
                    fontWeight: 600,
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
                      backgroundColor: selectedTask?.id === task.id ? '#1a2a3a' : '#0d0d0d',
                      borderRadius: 8,
                      border: `1px solid ${selectedTask?.id === task.id ? col.color + '66' : blocked ? '#f59e0b33' : '#1a1a1a'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                      onClick={() => handleTaskClick(task)}
                      onMouseEnter={(e) => {
                        if (selectedTask?.id !== task.id) e.currentTarget.style.borderColor = col.color + '44'
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTask?.id !== task.id) e.currentTarget.style.borderColor = blocked ? '#f59e0b33' : '#1a1a1a'
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
                          borderRadius: 4,
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          border: '1px dashed rgba(245, 158, 11, 0.3)',
                        }}>
                          <Link2 size={9} color="#f59e0b" />
                          <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 500 }}>Blocked by dependency</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        {/* Priority indicator */}
                        <div style={{
                          width: 3,
                          height: 32,
                          borderRadius: 2,
                          backgroundColor: pCfg.color,
                          flexShrink: 0,
                          marginTop: 1,
                        }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: '#fff',
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
                              color: '#555',
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
                                borderRadius: 3,
                                letterSpacing: 0.5,
                              }}>
                                {pCfg.label}
                              </span>

                              {/* Assignee avatar */}
                              {task.assignee && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <img
                                    src={pixelAvatarToDataUrl(task.assignee, 14)}
                                    alt={task.assignee}
                                    style={{ width: 14, height: 14, borderRadius: 3 }}
                                  />
                                  <span style={{ fontSize: 9, color: agentColor, fontWeight: 500 }}>{task.assignee}</span>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {/* Dependency count */}
                              {task.dependsOn && task.dependsOn.length > 0 && (
                                <span style={{ fontSize: 9, color: '#555', display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Link2 size={8} />
                                  {task.dependsOn.length}
                                </span>
                              )}

                              <span style={{ fontSize: 9, color: '#444', display: 'flex', alignItems: 'center', gap: 2 }}>
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
                                <Trash2 size={10} color="#888" />
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
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #1a1a1a',
                      borderRadius: 6,
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleAddTask(col.id)}
                    style={{ width: 30, height: 30, borderRadius: 6 }}
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

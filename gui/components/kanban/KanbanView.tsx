'use client'

import * as React from 'react'
import { Plus, Clock, AlertCircle, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TaskDetailPanel } from './TaskDetailPanel'
import type { Task } from '@/types'

const columns: { id: Task['status']; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: '#3b82f6' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'verify', label: 'Verify', color: '#a855f7' },
  { id: 'done', label: 'Done', color: '#22c55e' },
  { id: 'failed', label: 'Failed', color: '#ef4444' },
]

const priorityColors = {
  low: '#666',
  medium: '#f59e0b',
  high: '#ef4444',
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
    if (fullTask) {
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
  }

  const getTasksByStatus = (status: Task['status']) => tasks.filter((t) => t.status === status)

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#0a0a0a',
        color: '#666'
      }}>
        Loading tasks...
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
        gap: 8,
        padding: 12,
        overflow: 'hidden'
      }}>
        {columns.map((col) => {
          const colTasks = getTasksByStatus(col.id)
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid #1a1a1a',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: col.color
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{col.label}</span>
                  <span style={{ fontSize: 11, color: '#666' }}>({colTasks.length})</span>
                </div>
              </div>

              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                {colTasks.map((task) => (
                  <div key={task.id} style={{
                    padding: 10,
                    backgroundColor: selectedTask?.id === task.id ? '#1a2a3a' : '#0a0a0a',
                    borderRadius: 6,
                    border: `1px solid ${selectedTask?.id === task.id ? col.color : '#1a1a1a'}`,
                    transition: 'border-color 0.15s',
                    cursor: 'pointer'
                  }}
                    onClick={() => handleTaskClick(task)}
                    onMouseEnter={(e) => {
                      if (selectedTask?.id !== task.id) e.currentTarget.style.borderColor = col.color
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTask?.id !== task.id) e.currentTarget.style.borderColor = '#1a1a1a'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      {task.priority === 'high' && (
                        <AlertCircle size={10} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#fff',
                          marginBottom: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p style={{
                            fontSize: 10,
                            color: '#666',
                            marginBottom: 4,
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 500,
                            color: priorityColors[task.priority],
                            textTransform: 'uppercase'
                          }}>
                            {task.priority}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {task.assignee && (
                              <span style={{ fontSize: 9, color: '#888' }}>{task.assignee}</span>
                            )}
                            <span style={{ fontSize: 9, color: '#666', display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Clock size={9} />
                              {formatDistanceToNow(task.updatedAt, { addSuffix: false })}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteTask(e, task.id)}
                              style={{ width: 16, height: 16, opacity: 0.5 }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                            >
                              <Trash2 size={10} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 4, marginTop: 'auto', paddingTop: 4 }}>
                  <Input
                    placeholder="New..."
                    value={newTaskTitle[col.id] || ''}
                    onChange={(e) => setNewTaskTitle((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask(col.id)}
                    style={{
                      flex: 1,
                      height: 28,
                      fontSize: 11,
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #222'
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleAddTask(col.id)}
                    style={{ width: 28, height: 28 }}
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
    </div>
  )
}
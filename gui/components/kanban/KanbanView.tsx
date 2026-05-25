'use client'

import * as React from 'react'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import { Plus, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

const columns: { id: Task['status']; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-blue-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { id: 'verify', label: 'Verify', color: 'bg-purple-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
  { id: 'failed', label: 'Failed', color: 'bg-red-500' },
]

const priorityColors = {
  low: 'text-muted-foreground',
  medium: 'text-yellow-600',
  high: 'text-red-600',
}

export function KanbanView() {
  const { tasks, addTask } = useAppStore()
  const [newTaskTitle, setNewTaskTitle] = React.useState<Record<string, string>>({})

  const handleAddTask = (status: Task['status']) => {
    const title = newTaskTitle[status]?.trim()
    if (!title) return
    addTask({ title, status, priority: 'medium' })
    setNewTaskTitle((prev) => ({ ...prev, [status]: '' }))
  }

  const getTasksByStatus = (status: Task['status']) => tasks.filter((t) => t.status === status)

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4">
      {columns.map((col) => {
        const colTasks = getTasksByStatus(col.id)
        return (
          <div key={col.id} className="flex flex-col w-72 shrink-0 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', col.color)} />
                <span className="font-medium text-sm">{col.label}</span>
                <span className="text-xs text-muted-foreground">({colTasks.length})</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div key={task.id} className="bg-background rounded-md p-3 shadow-sm">
                    <h4 className="text-sm font-medium">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className={cn('text-xs font-medium', priorityColors[task.priority])}>
                        {task.priority}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="New task..."
                    value={newTaskTitle[col.id] || ''}
                    onChange={(e) => setNewTaskTitle((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask(col.id)}
                    className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1 placeholder:text-muted-foreground"
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleAddTask(col.id)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>
        )
      })}
    </div>
  )
}
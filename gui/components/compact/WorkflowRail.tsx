'use client'

import * as React from 'react'
import { CheckCircle, XCircle, Clock, Loader2, ChevronRight, Eye } from 'lucide-react'

const statusDotConfig: Record<string, { color: string; bg: string }> = {
  todo: { color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  in_progress: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.15)' },
  verify: { color: 'var(--status-purple)', bg: 'rgba(123,104,192,0.15)' },
  done: { color: 'var(--status-green)', bg: 'rgba(92,184,92,0.15)' },
  failed: { color: 'var(--warm-red)', bg: 'rgba(220,80,80,0.15)' },
  skipped: { color: 'var(--text-faint)', bg: 'var(--surface-1)' },
}

interface WorkflowRailProps {
  tasks: Array<{ id: string; title: string; status: string }>
  onExpand: () => void
}

export function WorkflowRail({ tasks, onExpand }: WorkflowRailProps) {
  return (
    <div
      onClick={onExpand}
      style={{
        width: 24,
        minWidth: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '8px 0',
        backgroundColor: 'var(--surface-1)',
        borderRight: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'width 0.2s, min-width 0.2s',
      }}
      title="Expand workflow"
    >
      {tasks.map((task) => {
        const cfg = statusDotConfig[task.status] || statusDotConfig.todo
        const isActive = task.status === 'in_progress'
        return (
          <div
            key={task.id}
            title={`${task.title}: ${task.status}`}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: cfg.bg,
              border: `2px solid ${cfg.color}`,
              flexShrink: 0,
              animation: isActive ? 'pulse 2s infinite' : undefined,
              transition: 'border-color 0.3s, background-color 0.3s',
            }}
          />
        )
      })}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}

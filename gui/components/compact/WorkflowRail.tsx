'use client'

import * as React from 'react'

const statusDotConfig: Record<string, { color: string; bg: string }> = {
  todo: { color: '#7dd3fc', bg: 'rgba(125,211,252,0.15)' },
  in_progress: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  pausing: { color: '#fde68a', bg: 'rgba(253,230,138,0.15)' },
  paused: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  cancelling: { color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  cancelled: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  verify: { color: '#c4b5fd', bg: 'rgba(196,181,253,0.15)' },
  done: { color: '#86efac', bg: 'rgba(134,239,172,0.15)' },
  failed: { color: '#fca5a5', bg: 'rgba(252,165,165,0.15)' },
  skipped: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
}

interface RailTask {
  id: string
  title: string
  status: string
  requiresApproval?: boolean
}

interface WorkflowRailProps {
  tasks: RailTask[]
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
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

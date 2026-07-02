'use client'

import * as React from 'react'
import { GitBranch, ChevronRight } from 'lucide-react'

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
  lastError?: string
}

interface WorkflowRailProps {
  tasks: RailTask[]
  onExpand: () => void
}

function getDotConfig(task: RailTask) {
  if (task.status === 'paused' && task.lastError) {
    return statusDotConfig.failed
  }
  return statusDotConfig[task.status] || statusDotConfig.todo
}

export function WorkflowRail({ tasks, onExpand }: WorkflowRailProps) {
  const doneCount = tasks.filter(t =>
    t.status === 'done' || t.status === 'failed' || t.status === 'cancelled' || t.status === 'skipped'
  ).length
  const totalCount = tasks.length

  return (
    <div
      onClick={onExpand}
      style={{
        width: 32,
        minWidth: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 0',
        backgroundColor: 'var(--surface-1)',
        borderRight: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'width 0.2s, min-width 0.2s',
      }}
      title="Expand workflow"
    >
      {/* Top icon — GitBranch, indicates this is the workflow progress column */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        marginBottom: 4, paddingBottom: 4,
        borderBottom: '1px solid var(--border-subtle)',
        width: '100%',
      }}>
        <GitBranch size={14} color="var(--amber)" strokeWidth={1.8} />
        {totalCount > 0 && (
          <span style={{
            fontSize: 8, fontFamily: 'IBM Plex Mono, monospace',
            color: 'var(--text-secondary)', fontWeight: 700,
            lineHeight: 1,
          }}>
            {doneCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Status dots */}
      {tasks.map((task) => {
        const cfg = getDotConfig(task)
        const isActive = task.status === 'in_progress'
        const isFailedPaused = task.status === 'paused' && task.lastError

        return (
          <div
            key={task.id}
            title={`${task.title}: ${isFailedPaused ? 'Failed' : task.status}`}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: cfg.bg,
              border: `2px solid ${cfg.color}`,
              flexShrink: 0,
              animation: isActive ? 'railPulse 1.5s ease-in-out infinite' : undefined,
              boxShadow: isActive ? `0 0 8px ${cfg.color}, 0 0 4px ${cfg.color}` : 'none',
              transition: 'border-color 0.3s, background-color 0.3s, box-shadow 0.3s',
            }}
          />
        )
      })}

      {/* Bottom expand hint */}
      <div style={{
        marginTop: 'auto', paddingTop: 4,
        borderTop: '1px solid var(--border-subtle)',
        width: '100%', display: 'flex', justifyContent: 'center',
      }}>
        <ChevronRight size={12} color="var(--text-faint)" style={{ transform: 'rotate(90deg)' }} />
      </div>

      <style>{`
        @keyframes railPulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 8px #fbbf24, 0 0 4px #fbbf24; }
          50% { opacity: 0.6; transform: scale(1.15); box-shadow: 0 0 14px #fbbf24, 0 0 8px #fbbf24; }
        }
      `}</style>
    </div>
  )
}

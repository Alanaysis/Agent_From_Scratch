'use client'

import * as React from 'react'
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, Eye, ChevronRight } from 'lucide-react'
import type { Task } from '@/types'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  todo: { color: '#6b7280', icon: <ChevronRight size={12} />, label: 'Pending' },
  in_progress: { color: '#f59e0b', icon: <Loader2 size={12} />, label: 'Running' },
  verify: { color: '#a855f7', icon: <Eye size={12} />, label: 'Verify' },
  done: { color: '#22c55e', icon: <CheckCircle size={12} />, label: 'Done' },
  failed: { color: '#ef4444', icon: <XCircle size={12} />, label: 'Failed' },
}

interface WorkflowStep {
  id: string
  title: string
  status: Task['status']
  dependsOn?: string[]
  assignee?: string
}

interface Props {
  steps: WorkflowStep[]
  title?: string
}

export function WorkflowProgressView({ steps, title }: Props) {
  // Build adjacency for dependency edges
  const stepMap = new Map(steps.map(s => [s.id, s]))

  // Calculate layout: group by dependency depth
  const depths = new Map<string, number>()
  const getDepth = (id: string, visited = new Set<string>()): number => {
    if (depths.has(id)) return depths.get(id)!
    if (visited.has(id)) return 0 // cycle protection
    visited.add(id)
    const step = stepMap.get(id)
    if (!step?.dependsOn || step.dependsOn.length === 0) {
      depths.set(id, 0)
      return 0
    }
    const maxDep = Math.max(...step.dependsOn.map(d => getDepth(d, visited)))
    const depth = maxDep + 1
    depths.set(id, depth)
    return depth
  }
  steps.forEach(s => getDepth(s.id))

  // Group steps by depth level
  const levels = new Map<number, WorkflowStep[]>()
  for (const step of steps) {
    const depth = depths.get(step.id) || 0
    if (!levels.has(depth)) levels.set(depth, [])
    levels.get(depth)!.push(step)
  }

  const maxLevel = Math.max(...levels.keys(), 0)
  const nodeWidth = 160
  const nodeHeight = 56
  const levelGap = 80
  const nodeGap = 16

  // Calculate positions
  const positions = new Map<string, { x: number; y: number }>()
  for (let level = 0; level <= maxLevel; level++) {
    const levelSteps = levels.get(level) || []
    const totalHeight = levelSteps.length * (nodeHeight + nodeGap) - nodeGap
    let startY = (Math.max(...[...levels.values()].map(l => l.length * (nodeHeight + nodeGap) - nodeGap)) - totalHeight) / 2
    levelSteps.forEach((step, i) => {
      positions.set(step.id, {
        x: level * (nodeWidth + levelGap) + 20,
        y: startY + i * (nodeHeight + nodeGap) + 20,
      })
    })
  }

  const svgWidth = (maxLevel + 1) * (nodeWidth + levelGap) + 40
  const maxNodesInLevel = Math.max(...[...levels.values()].map(l => l.length), 1)
  const svgHeight = maxNodesInLevel * (nodeHeight + nodeGap) - nodeGap + 40

  // Build edges
  const edges: Array<{ from: string; to: string }> = []
  for (const step of steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (stepMap.has(depId)) {
          edges.push({ from: depId, to: step.id })
        }
      }
    }
  }

  // Calculate progress
  const doneCount = steps.filter(s => s.status === 'done').length
  const failedCount = steps.filter(s => s.status === 'failed').length
  const runningCount = steps.filter(s => s.status === 'in_progress').length
  const progressPct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8 }}>{title}</div>
      )}

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%',
            backgroundColor: failedCount > 0 ? '#ef4444' : '#22c55e',
            borderRadius: 3,
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: 11, color: '#888', minWidth: 36 }}>{progressPct}%</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 10 }}>
        {runningCount > 0 && <span style={{ color: '#f59e0b' }}>{runningCount} running</span>}
        {doneCount > 0 && <span style={{ color: '#22c55e' }}>{doneCount} done</span>}
        {failedCount > 0 && <span style={{ color: '#ef4444' }}>{failedCount} failed</span>}
        <span style={{ color: '#666' }}>{steps.length - doneCount - failedCount - runningCount} pending</span>
      </div>

      {/* DAG visualization */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const fromPos = positions.get(edge.from)
            const toPos = positions.get(edge.to)
            if (!fromPos || !toPos) return null
            const fromCfg = statusConfig[stepMap.get(edge.from)?.status || 'todo']
            const toCfg = statusConfig[stepMap.get(edge.to)?.status || 'todo']
            const edgeColor = fromCfg?.color === '#22c55e' ? '#22c55e44' : '#333'

            const x1 = fromPos.x + nodeWidth
            const y1 = fromPos.y + nodeHeight / 2
            const x2 = toPos.x
            const y2 = toPos.y + nodeHeight / 2
            const cx = (x1 + x2) / 2

            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                stroke={edgeColor}
                strokeWidth={2}
                fill="none"
                strokeDasharray={fromCfg?.color === '#22c55e' ? 'none' : '4 4'}
              />
            )
          })}

          {/* Nodes */}
          {steps.map((step) => {
            const pos = positions.get(step.id)
            if (!pos) return null
            const cfg = statusConfig[step.status || 'todo']

            return (
              <g key={step.id}>
                {/* Node background */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={8}
                  fill="#0d0d0d"
                  stroke={cfg.color}
                  strokeWidth={step.status === 'in_progress' ? 2 : 1}
                  strokeOpacity={step.status === 'in_progress' ? 1 : 0.4}
                />
                {/* Status indicator */}
                <circle
                  cx={pos.x + 14}
                  cy={pos.y + 14}
                  r={5}
                  fill={cfg.color}
                />
                {/* Title */}
                <text
                  x={pos.x + 26}
                  y={pos.y + 18}
                  fill="#fff"
                  fontSize={11}
                  fontWeight={500}
                >
                  {step.title.length > 16 ? step.title.slice(0, 16) + '…' : step.title}
                </text>
                {/* Status label */}
                <text
                  x={pos.x + 14}
                  y={pos.y + 40}
                  fill={cfg.color}
                  fontSize={9}
                >
                  {cfg.label}
                </text>
                {/* Assignee */}
                {step.assignee && (
                  <text
                    x={pos.x + nodeWidth - 8}
                    y={pos.y + 40}
                    fill="#555"
                    fontSize={9}
                    textAnchor="end"
                  >
                    {step.assignee}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 9, color: '#666' }}>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  )
}

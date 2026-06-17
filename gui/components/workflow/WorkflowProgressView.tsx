'use client'

import * as React from 'react'
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, Eye, ChevronRight, GitBranch, Repeat, Maximize2, Minimize2, MessageCircle, Pencil } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { Task, TaskDraft } from '@/types'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  todo: { color: 'var(--text-muted)', icon: <ChevronRight size={12} />, label: 'Pending' },
  in_progress: { color: 'var(--amber)', icon: <Loader2 size={12} />, label: 'Running' },
  verify: { color: 'var(--status-purple)', icon: <Eye size={12} />, label: 'Verify' },
  done: { color: 'var(--status-green)', icon: <CheckCircle size={12} />, label: 'Done' },
  failed: { color: 'var(--warm-red)', icon: <XCircle size={12} />, label: 'Failed' },
}

interface WorkflowStep {
  id: string
  title: string
  status: Task['status']
  dependsOn?: string[]
  assignee?: string
  sessionId?: string
  isDraft?: boolean
  draft?: TaskDraft
  condition?: {
    type: 'step_result' | 'llm_judge'
    source?: string
    field?: string
    equals?: string
  }
  loop?: {
    max: number
    steps: string[]
  }
}

interface Props {
  steps: WorkflowStep[]
  title?: string
  onViewChat?: (sessionId: string) => void
  onEditDraft?: (draft: TaskDraft) => void
  onUpdateDraft?: (tempId: string, updates: Partial<TaskDraft>) => void
  agents?: Array<{ name: string }>
  isFullscreen?: boolean
  actionButtons?: React.ReactNode
  sessionMessages?: Map<string, Array<{ type: string; content: string; timestamp?: number }>>
}

export function WorkflowProgressView({ steps, title, onViewChat, onEditDraft, onUpdateDraft, agents, isFullscreen: isFullscreenProp, actionButtons, sessionMessages }: Props) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [editingStep, setEditingStep] = React.useState<string | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(600)
  const fullscreen = isFullscreenProp !== undefined ? isFullscreenProp : isFullscreen

  // Track container width
  React.useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])
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
  const nodeWidth = 130
  const nodeHeight = 50
  const levelGap = 50
  const nodeGap = 10

  // Calculate positions (vertical layout: levels go top-to-bottom)
  const hasAnyPreview = steps.some(s => s.sessionId && sessionMessages?.has(s.sessionId) && (sessionMessages.get(s.sessionId) || []).length > 0)
  const previewWidth = hasAnyPreview ? 116 : 0

  const positions = new Map<string, { x: number; y: number }>()
  const padding = 16
  const svgHeight = (maxLevel + 1) * (nodeHeight + levelGap) + padding * 2

  // Center nodes based on container width
  const centerPositions = (width: number) => {
    for (let level = 0; level <= maxLevel; level++) {
      const levelSteps = levels.get(level) || []
      const stepWidths = levelSteps.map(s => {
        const hasP = s.sessionId && sessionMessages?.has(s.sessionId) && (sessionMessages.get(s.sessionId) || []).length > 0
        return nodeWidth + (hasP ? previewWidth : 0)
      })
      const totalWidth = stepWidths.reduce((a, b) => a + b, 0) + Math.max(0, levelSteps.length - 1) * nodeGap
      const startX = Math.max((width - totalWidth) / 2, padding)
      let currentX = startX
      levelSteps.forEach((step, i) => {
        positions.set(step.id, { x: currentX, y: level * (nodeHeight + levelGap) + padding })
        currentX += stepWidths[i]! + nodeGap
      })
    }
  }

  // Use container width (minus scrollbar/border) for centering
  const usableWidth = Math.max(containerWidth - 10, 100)
  centerPositions(usableWidth)

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

  // Auto-scroll to running node
  const runningStep = steps.find(s => s.status === 'in_progress')
  React.useEffect(() => {
    if (!runningStep || !containerRef.current) return
    const pos = positions.get(runningStep.id)
    if (!pos) return
    const container = containerRef.current
    const targetY = pos.y + nodeHeight / 2 - container.clientHeight / 2
    const targetX = pos.x + nodeWidth / 2 - container.clientWidth / 2
    container.scrollTo({ top: Math.max(0, targetY), left: Math.max(0, targetX), behavior: 'smooth' })
  }, [runningStep?.id])

  // Edit panel for draft nodes
  const editingDraftData = editingStep ? steps.find(s => s.id === editingStep)?.draft : null
  const editPanel = editingDraftData ? (
    <div style={{
      position: 'absolute', top: 10, right: 10, width: 240,
      backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-medium)',
      padding: 10, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        Edit: {editingDraftData.title}
      </div>
      {/* Agent selector */}
      {agents && agents.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>Agent</label>
          <select
            value={editingDraftData.agent || ''}
            onChange={(e) => onUpdateDraft?.(editingDraftData.tempId, { agent: e.target.value || undefined })}
            style={{ width: '100%', height: 24, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, color: 'var(--text-primary)', padding: '0 4px' }}
          >
            <option value="">Auto</option>
            {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </div>
      )}
      {/* Priority selector */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>Priority</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['low', 'medium', 'high'] as const).map(p => (
            <button
              key={p}
              onClick={() => onUpdateDraft?.(editingDraftData.tempId, { priority: p })}
              style={{
                flex: 1, height: 22, fontSize: 10, fontFamily: 'IBM Plex Mono, monospace',
                backgroundColor: editingDraftData.priority === p ? 'var(--surface-2)' : 'transparent',
                border: `1px solid ${editingDraftData.priority === p ? 'var(--amber)' : 'var(--border-subtle)'}`,
                color: editingDraftData.priority === p ? 'var(--amber)' : 'var(--text-muted)',
                cursor: 'pointer', borderRadius: 0,
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {/* Close button */}
      <button
        onClick={() => setEditingStep(null)}
        style={{
          width: '100%', height: 22, fontSize: 10, fontFamily: 'IBM Plex Mono, monospace',
          backgroundColor: 'transparent', border: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 0,
        }}
      >
        Close
      </button>
    </div>
  ) : null

  const dagContent = (
    <>
      {/* Header: action buttons (fullscreen) + fullscreen toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        {fullscreen && actionButtons ? (
          <div style={{ display: 'flex', gap: 6 }}>{actionButtons}</div>
        ) : <div />}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          style={{
            background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 2,
            cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4,
            color: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace',
          }}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          {isFullscreen ? 'Exit' : 'Expand'}
        </button>
      </div>

      {/* DAG visualization */}
      <div ref={containerRef} style={{
        position: 'relative',
        overflowX: 'auto',
        overflowY: 'auto',
        backgroundColor: 'var(--surface-0)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 2,
        padding: 4,
        flex: 1,
        minHeight: 0,
      }}>
        <svg width="100%" height={svgHeight} style={{ display: 'block' }}>
          {/* Edges with dependency labels */}
          {edges.map((edge, i) => {
            const fromPos = positions.get(edge.from)
            const toPos = positions.get(edge.to)
            if (!fromPos || !toPos) return null
            const fromCfg = statusConfig[stepMap.get(edge.from)?.status || 'todo']
            const edgeColor = fromCfg?.color === 'var(--status-green)' ? '#5cb85c44' : 'var(--border-medium)'

            // Vertical layout: edges go from bottom of source to top of target
            const x1 = fromPos.x + nodeWidth / 2
            const y1 = fromPos.y + nodeHeight
            const x2 = toPos.x + nodeWidth / 2
            const y2 = toPos.y
            const cy = (y1 + y2) / 2

            // Check if target has a condition
            const targetStep = stepMap.get(edge.to)
            const hasCondition = !!targetStep?.condition

            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`}
                  stroke={edgeColor}
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray={fromCfg?.color === 'var(--status-green)' ? 'none' : '4 4'}
                />
                {/* Condition indicator on edge */}
                {hasCondition && (() => {
                  const cond = targetStep!.condition!
                  const label = cond.type === 'llm_judge'
                    ? 'LLM'
                    : cond.equals === 'success' ? '✓'
                    : cond.equals === 'failure' ? '✗'
                    : cond.equals || '?'
                  const labelWidth = label.length * 5 + 8
                  const midX = (x1 + x2) / 2
                  const midY = (y1 + y2) / 2
                  return (
                    <g>
                      <rect x={midX - labelWidth / 2} y={midY - 8} width={labelWidth} height={16} rx={3} fill="var(--surface-1)" stroke="var(--amber)" strokeWidth={1} />
                      <text x={midX} y={midY + 4} fill="var(--amber)" fontSize={8} textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{label}</text>
                    </g>
                  )
                })()}
              </g>
            )
          })}

          {/* Nodes */}
          {steps.map((step) => {
            const pos = positions.get(step.id)
            if (!pos) return null
            const cfg = statusConfig[step.status || 'todo']
            const hasCondition = !!step.condition
            const hasLoop = !!step.loop

            return (
              <g key={step.id}>
                {/* Node background */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={2}
                  fill="var(--surface-1)"
                  stroke={step.status === 'in_progress' ? 'var(--amber)' : hasCondition ? 'var(--amber)' : cfg.color}
                  strokeWidth={step.status === 'in_progress' ? 2 : 1}
                  strokeOpacity={step.status === 'in_progress' ? 1 : 0.5}
                  strokeDasharray={hasCondition ? '4 2' : 'none'}
                />
                {/* Status indicator */}
                <circle
                  cx={pos.x + 14}
                  cy={pos.y + 14}
                  r={4}
                  fill={cfg.color}
                />
                {/* Title - truncate more if condition/loop indicators present */}
                <text
                  x={pos.x + 24}
                  y={pos.y + 17}
                  fill="var(--text-primary)"
                  fontSize={10}
                  fontWeight={500}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {(() => {
                    const maxLen = (hasCondition && hasLoop) ? 6 : (hasCondition || hasLoop) ? 10 : 14
                    return step.title.length > maxLen ? step.title.slice(0, maxLen) + '...' : step.title
                  })()}
                </text>
                {/* Status label */}
                <text
                  x={pos.x + 14}
                  y={pos.y + 34}
                  fill={cfg.color}
                  fontSize={8}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {cfg.label}
                </text>
                {/* Condition indicator - top right */}
                {hasCondition && (() => {
                  const cond = step.condition!
                  const label = cond.type === 'llm_judge' ? 'LLM' : 'IF'
                  const xOff = hasLoop ? 30 : 4
                  return (
                    <g>
                      <rect x={pos.x + nodeWidth - xOff - 22} y={pos.y + 2} width={22} height={12} rx={2} fill="rgba(245,158,11,0.15)" />
                      <text x={pos.x + nodeWidth - xOff - 11} y={pos.y + 11} fill="var(--amber)" fontSize={7} textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{label}</text>
                    </g>
                  )
                })()}
                {/* Loop indicator - top right, left of condition */}
                {hasLoop && (
                  <g>
                    <rect x={pos.x + nodeWidth - 4 - 22} y={pos.y + 2} width={22} height={12} rx={2} fill="rgba(139,120,208,0.15)" />
                    <text x={pos.x + nodeWidth - 4 - 11} y={pos.y + 11} fill="var(--status-purple)" fontSize={7} textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
                      ×{step.loop?.max}
                    </text>
                  </g>
                )}
                {/* Assignee */}
                {step.assignee && (
                  <text
                    x={pos.x + nodeWidth - 8}
                    y={pos.y + nodeHeight - 4}
                    fill="var(--text-faint)"
                    fontSize={7}
                    textAnchor="end"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {step.assignee}
                  </text>
                )}
                {/* Draft edit button (pencil) or View in Chat button */}
                {step.isDraft && step.draft ? (
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setEditingStep(editingStep === step.id ? null : step.id) }}
                  >
                    <rect
                      x={pos.x + nodeWidth - 22}
                      y={pos.y + nodeHeight / 2 - 7}
                      width={18}
                      height={14}
                      rx={2}
                      fill="rgba(245,158,11,0.12)"
                    />
                    <text
                      x={pos.x + nodeWidth - 13}
                      y={pos.y + nodeHeight / 2 + 4}
                      fill="var(--amber)"
                      fontSize={9}
                      textAnchor="middle"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      ✏️
                    </text>
                  </g>
                ) : step.sessionId && onViewChat ? (
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onViewChat(step.sessionId!) }}
                  >
                    <rect
                      x={pos.x + nodeWidth - 22}
                      y={pos.y + nodeHeight / 2 - 7}
                      width={18}
                      height={14}
                      rx={2}
                      fill="rgba(0,134,205,0.12)"
                    />
                    <text
                      x={pos.x + nodeWidth - 13}
                      y={pos.y + nodeHeight / 2 + 4}
                      fill="var(--amber)"
                      fontSize={8}
                      textAnchor="middle"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      💬
                    </text>
                  </g>
                ) : null}
                {/* Message preview — shows latest messages from session */}
                {step.sessionId && sessionMessages?.has(step.sessionId) && (() => {
                  const msgs = sessionMessages.get(step.sessionId) || []
                  if (msgs.length === 0) return null
                  const lastMsg = msgs[msgs.length - 1]
                  if (!lastMsg) return null
                  const previewX = pos.x + nodeWidth + 6
                  const previewY = pos.y
                  const previewWidth = 110
                  const previewHeight = nodeHeight
                  const maxCharsPerLine = 20 // approx chars that fit in 110px at 7px font
                  const content = lastMsg.content.replace(/\n/g, ' ').trim()
                  const lines: string[] = []
                  for (let i = 0; i < content.length && lines.length < 3; i += maxCharsPerLine) {
                    lines.push(content.slice(i, i + maxCharsPerLine))
                  }
                  if (content.length > maxCharsPerLine * 3) {
                    lines[2] = lines[2]?.slice(0, -3) + '...'
                  }
                  const icon = lastMsg.type === 'assistant' ? '🤖' : lastMsg.type === 'tool_result' ? '🔧' : '👤'
                  return (
                    <g>
                      <rect
                        x={previewX}
                        y={previewY}
                        width={previewWidth}
                        height={previewHeight}
                        rx={2}
                        fill="var(--surface-2)"
                        stroke="var(--border-subtle)"
                        strokeWidth={0.5}
                      />
                      {/* Header: icon + message count */}
                      <text
                        x={previewX + 4}
                        y={previewY + 11}
                        fill="var(--text-secondary)"
                        fontSize={7}
                        fontFamily="IBM Plex Mono, monospace"
                      >
                        {icon} {msgs.length} msg{msgs.length > 1 ? 's' : ''}
                      </text>
                      {/* Content lines */}
                      {lines.map((line, li) => (
                        <text
                          key={li}
                          x={previewX + 4}
                          y={previewY + 21 + li * 9}
                          fill="var(--text-muted)"
                          fontSize={7}
                          fontFamily="IBM Plex Mono, monospace"
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  )
                })()}
              </g>
            )
          })}
        </svg>
        {/* Edit panel overlay */}
        {editPanel}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 8,
        fontSize: 9,
        color: 'var(--text-muted)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: cfg.color,
              display: 'inline-block',
            }} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Action buttons (non-fullscreen) */}
      {!fullscreen && actionButtons && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {actionButtons}
        </div>
      )}
    </>
  )

  // Fullscreen mode — covers the parent main content area
  if (isFullscreen) {
    return (
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'var(--surface-0)', zIndex: 100,
        display: 'flex', flexDirection: 'column',
        padding: 10, overflow: 'hidden',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}>
        {dagContent}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} style={{ padding: 8, fontFamily: 'IBM Plex Sans, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {dagContent}
    </div>
  )
}

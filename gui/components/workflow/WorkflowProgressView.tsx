'use client'

import * as React from 'react'
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, Eye, ChevronRight, GitBranch, Repeat, Maximize2, Minimize2, MessageCircle, Pencil, Pause, SkipForward } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { Task, TaskDraft } from '@/types'

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string; bg: string }> = {
  todo: { color: 'var(--text-muted)', icon: <ChevronRight size={12} />, label: 'Pending', bg: 'var(--surface-2)' },
  in_progress: { color: 'var(--amber)', icon: <Loader2 size={12} />, label: 'Running', bg: 'rgba(245,158,11,0.08)' },
  verify: { color: 'var(--status-purple)', icon: <Eye size={12} />, label: 'Verify', bg: 'rgba(123,104,192,0.08)' },
  done: { color: 'var(--status-green)', icon: <CheckCircle size={12} />, label: 'Done', bg: 'rgba(92,184,92,0.08)' },
  failed: { color: 'var(--warm-red)', icon: <XCircle size={12} />, label: 'Failed', bg: 'rgba(220,80,80,0.08)' },
  skipped: { color: 'var(--text-faint)', icon: <SkipForward size={12} />, label: 'Skipped', bg: 'var(--surface-1)' },
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
  checkpointAfter?: boolean
  checkpointMessage?: string
  skipped?: boolean
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

function condLabel(cond: WorkflowStep['condition']): string | null {
  if (!cond) return null
  if (cond.type === 'llm_judge') return 'LLM'
  if (cond.equals === 'success') return '✓'
  if (cond.equals === 'failure') return '✗'
  return cond.equals || '?'
}

export function WorkflowProgressView({ steps, title, onViewChat, onEditDraft, onUpdateDraft, agents, isFullscreen: isFullscreenProp, actionButtons, sessionMessages }: Props) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [editingStep, setEditingStep] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const fullscreen = isFullscreenProp !== undefined ? isFullscreenProp : isFullscreen

  const stepMap = new Map(steps.map(s => [s.id, s]))

  const dependents = new Map<string, string[]>()
  for (const step of steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!dependents.has(depId)) dependents.set(depId, [])
        dependents.get(depId)!.push(step.id)
      }
    }
  }

  const depths = new Map<string, number>()
  const getDepth = (id: string, seen = new Set<string>()): number => {
    if (depths.has(id)) return depths.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const step = stepMap.get(id)
    if (!step?.dependsOn || step.dependsOn.length === 0) {
      depths.set(id, 0)
      return 0
    }
    const maxDep = Math.max(...step.dependsOn.map(d => getDepth(d, seen)))
    depths.set(id, maxDep + 1)
    return maxDep + 1
  }
  steps.forEach(s => getDepth(s.id))

  const branchGroupOf = new Map<string, number>()
  let branchGroupCounter = 0
  for (const [parentId, childIds] of dependents) {
    const condChildren = childIds.filter(cid => stepMap.get(cid)?.condition)
    if (condChildren.length >= 2) {
      const groupIdx = branchGroupCounter++
      for (const cid of condChildren) {
        branchGroupOf.set(cid, groupIdx)
      }
    }
  }

  const branchOffset = new Map<string, number>()
  const processedGroups = new Set<number>()
  for (const [parentId, childIds] of dependents) {
    const condChildren = childIds.filter(cid => stepMap.get(cid)?.condition)
    if (condChildren.length >= 2) {
      const groupIdx = branchGroupOf.get(condChildren[0])!
      if (processedGroups.has(groupIdx)) continue
      processedGroups.add(groupIdx)
      const sorted = condChildren.sort((a, b) => steps.findIndex(s => s.id === a) - steps.findIndex(s => s.id === b))
      for (let i = 0; i < sorted.length; i++) {
        branchOffset.set(sorted[i], i === 0 ? -1 : i === 1 ? 1 : (i % 2 === 0 ? -i : i))
      }
    }
  }

  const nodeBranch = new Map<string, number>()

  const getBranchSubtree = (id: string, visited = new Set<string>()): number[] => {
    if (visited.has(id)) return []
    visited.add(id)
    const myOffset = branchOffset.get(id)
    if (myOffset !== undefined) return [myOffset]
    const step = stepMap.get(id)
    if (!step?.dependsOn || step.dependsOn.length === 0) return [0]
    const parentOffsets: number[] = []
    for (const depId of step.dependsOn) {
      parentOffsets.push(...getBranchSubtree(depId, visited))
    }
    return [...new Set(parentOffsets)]
  }

  const isMergeNode = new Set<string>()
  for (const step of steps) {
    if (step.dependsOn && step.dependsOn.length >= 2) {
      const subtreeOffsets = getBranchSubtree(step.id)
      if (new Set(subtreeOffsets).size >= 2) {
        isMergeNode.add(step.id)
      }
    }
  }

  const propagateBranch = (id: string, offset: number, visited = new Set<string>()) => {
    if (visited.has(id)) return
    visited.add(id)
    if (!nodeBranch.has(id)) {
      nodeBranch.set(id, isMergeNode.has(id) ? 0 : offset)
    }
    const children = dependents.get(id) || []
    const myOffset = nodeBranch.get(id) ?? offset
    for (const childId of children) {
      if (branchOffset.has(childId)) {
        propagateBranch(childId, branchOffset.get(childId)!, visited)
      } else if (!nodeBranch.has(childId)) {
        propagateBranch(childId, myOffset, visited)
      }
    }
  }
  for (const step of steps) {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      if (!nodeBranch.has(step.id)) nodeBranch.set(step.id, 0)
      const children = dependents.get(step.id) || []
      for (const childId of children) {
        if (branchOffset.has(childId)) {
          propagateBranch(childId, branchOffset.get(childId)!)
        } else if (!nodeBranch.has(childId)) {
          propagateBranch(childId, 0)
        }
      }
    }
  }
  for (const [stepId, offset] of branchOffset) {
    nodeBranch.set(stepId, offset)
    const children = dependents.get(stepId) || []
    for (const childId of children) {
      if (branchOffset.has(childId)) {
        propagateBranch(childId, branchOffset.get(childId)!)
      } else if (!nodeBranch.has(childId)) {
        propagateBranch(childId, offset)
      }
    }
  }
  for (const step of steps) {
    if (!nodeBranch.has(step.id)) nodeBranch.set(step.id, 0)
  }

  // Determine indent level for each step
  // Branch nodes get indent=1, their downstream inherits indent until merge
  const nodeIndent = new Map<string, number>()
  const propagateIndent = (id: string, indent: number, visited = new Set<string>()) => {
    if (visited.has(id)) return
    visited.add(id)
    if (!nodeIndent.has(id)) {
      nodeIndent.set(id, isMergeNode.has(id) ? 0 : indent)
    }
    const children = dependents.get(id) || []
    const myIndent = nodeIndent.get(id) ?? indent
    for (const childId of children) {
      if (branchOffset.has(childId)) {
        propagateIndent(childId, 1, visited)
      } else if (!nodeIndent.has(childId)) {
        propagateIndent(childId, myIndent, visited)
      }
    }
  }
  for (const step of steps) {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      if (!nodeIndent.has(step.id)) nodeIndent.set(step.id, 0)
      const children = dependents.get(step.id) || []
      for (const childId of children) {
        if (branchOffset.has(childId)) {
          propagateIndent(childId, 1)
        } else if (!nodeIndent.has(childId)) {
          propagateIndent(childId, 0)
        }
      }
    }
  }
  for (const [stepId] of branchOffset) {
    nodeIndent.set(stepId, 1)
    const children = dependents.get(stepId) || []
    for (const childId of children) {
      if (branchOffset.has(childId)) {
        propagateIndent(childId, 1)
      } else if (!nodeIndent.has(childId)) {
        propagateIndent(childId, 1)
      }
    }
  }
  for (const step of steps) {
    if (!nodeIndent.has(step.id)) nodeIndent.set(step.id, 0)
  }

  // Sort steps for display: depth-first, then by branch offset, then original order
  const displayOrder = [...steps].sort((a, b) => {
    const da = depths.get(a.id) || 0
    const db = depths.get(b.id) || 0
    if (da !== db) return da - db
    const oa = nodeBranch.get(a.id) || 0
    const ob = nodeBranch.get(b.id) || 0
    if (oa !== ob) return oa - ob
    return steps.indexOf(a) - steps.indexOf(b)
  })

  // Auto-scroll to active step
  const activeStep = steps.find(s => s.status === 'in_progress' || s.status === 'verify') ||
    steps.find(s => s.status === 'todo' && steps.every(o => o.id === s.id || ['done', 'failed', 'in_progress'].includes(o.status)))

  React.useEffect(() => {
    if (!activeStep || !containerRef.current) return
    const el = containerRef.current.querySelector(`[data-step-id="${activeStep.id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeStep?.id ?? '', activeStep?.status ?? ''])

  // Edit panel for draft nodes
  const editingDraftData = editingStep ? steps.find(s => s.id === editingStep)?.draft : null

  const timelineContent = (
    <>
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

      <div ref={containerRef} style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'var(--surface-0)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 2,
        padding: '8px 6px',
      }}>
        {displayOrder.map((step, idx) => {
          const cfg = statusConfig[step.status || 'todo']
          const indent = nodeIndent.get(step.id) || 0
          const isSkipped = step.status === 'skipped'
          const isLast = idx === displayOrder.length - 1
          const hasCondition = !!step.condition
          const hasLoop = !!step.loop
          const cLabel = condLabel(step.condition)
          const isActive = step.status === 'in_progress' || step.status === 'verify'

          const parentStep = step.dependsOn?.[0] ? stepMap.get(step.dependsOn[0]) : null
          const parentHasCheckpoint = !!parentStep?.checkpointAfter

          const msgs = step.sessionId && sessionMessages?.has(step.sessionId)
            ? sessionMessages.get(step.sessionId) || []
            : []
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null
          const msgCount = msgs.length

          return (
            <div key={step.id} data-step-id={step.id} style={{
              marginLeft: indent * 20,
              opacity: isSkipped ? 0.45 : 1,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                left: 8 - indent * 20,
                top: 0,
                bottom: isLast ? 16 : 0,
                width: 1,
                backgroundColor: isSkipped ? 'var(--border-subtle)' : 'var(--border-medium)',
              }} />

              {parentHasCheckpoint && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginLeft: 2,
                  marginBottom: 3,
                  marginTop: idx > 0 ? 0 : 2,
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 2,
                    backgroundColor: 'var(--surface-1)',
                    border: '1px solid var(--status-green)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: 'var(--status-green)',
                    flexShrink: 0,
                  }}>
                    ⏸
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--status-green)', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}>
                    checkpoint
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 8,
                padding: '6px 0',
                position: 'relative',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: isSkipped ? 'var(--surface-2)' : cfg.bg,
                  border: `2px solid ${cfg.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 3,
                  animation: step.status === 'in_progress' ? 'pulse 2s infinite' : undefined,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color }} />
                </div>

                <div style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: isActive ? cfg.bg : 'var(--surface-1)',
                  border: `1px solid ${isActive ? cfg.color : 'var(--border-subtle)'}`,
                  borderRadius: 3,
                  padding: '6px 8px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
                      {hasCondition && cLabel && (
                        <span style={{
                          fontSize: 9, fontFamily: 'IBM Plex Mono, monospace',
                          padding: '1px 5px', height: 16, lineHeight: '14px',
                          backgroundColor: 'rgba(245,158,11,0.15)',
                          color: 'var(--amber)',
                          border: '1px solid rgba(245,158,11,0.4)',
                          borderRadius: 2,
                          flexShrink: 0,
                          fontWeight: 600,
                        }}>
                          {cLabel}
                        </span>
                      )}
                      {hasLoop && (
                        <span style={{
                          fontSize: 9, fontFamily: 'IBM Plex Mono, monospace',
                          padding: '1px 5px', height: 16, lineHeight: '14px',
                          backgroundColor: 'rgba(139,120,208,0.15)',
                          color: 'var(--status-purple)',
                          border: '1px solid rgba(139,120,208,0.4)',
                          borderRadius: 2,
                          flexShrink: 0,
                          fontWeight: 600,
                        }}>
                          ×{step.loop?.max}
                        </span>
                      )}
                      <span style={{
                        fontSize: 13, fontWeight: 600, color: isSkipped ? 'var(--text-faint)' : 'var(--text-primary)',
                        fontFamily: 'IBM Plex Sans, sans-serif',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: 1.2,
                      }}>
                        {step.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 9, color: cfg.color,
                        fontFamily: 'IBM Plex Mono, monospace',
                        display: 'flex', alignItems: 'center', gap: 3,
                        fontWeight: 500,
                      }}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      {step.assignee && (
                        <span style={{
                          fontSize: 9, color: 'var(--text-faint)',
                          fontFamily: 'IBM Plex Mono, monospace',
                          backgroundColor: 'var(--surface-2)',
                          padding: '0 4px',
                          borderRadius: 2,
                          height: 16,
                          lineHeight: '16px',
                        }}>
                          @{step.assignee}
                        </span>
                      )}
                      {step.isDraft && step.draft && (
                        <button
                          onClick={() => setEditingStep(editingStep === step.id ? null : step.id)}
                          style={{
                            fontSize: 9, color: 'var(--amber)',
                            fontFamily: 'IBM Plex Mono, monospace',
                            background: 'none', border: '1px solid rgba(245,158,11,0.4)',
                            borderRadius: 2, padding: '0 5px', cursor: 'pointer',
                            height: 16, lineHeight: '14px',
                          }}
                        >
                          ✏
                        </button>
                      )}
                      {step.sessionId && onViewChat && !step.isDraft && (
                        <button
                          onClick={() => onViewChat(step.sessionId!)}
                          style={{
                            fontSize: 9, color: 'var(--status-blue)',
                            fontFamily: 'IBM Plex Mono, monospace',
                            background: 'none', border: '1px solid rgba(59,130,246,0.4)',
                            borderRadius: 2, padding: '0 5px', cursor: 'pointer',
                            height: 16, lineHeight: '14px',
                            display: 'flex', alignItems: 'center', gap: 2,
                          }}
                        >
                          <MessageCircle size={9} />
                          {msgCount > 0 ? msgCount : ''}
                        </button>
                      )}
                    </div>
                  </div>

                  {lastMsg && (
                    <div style={{
                      marginTop: 4,
                      padding: '4px 8px',
                      backgroundColor: 'var(--surface-2)',
                      borderLeft: `2px solid ${lastMsg.type === 'assistant' ? 'var(--status-green)' : lastMsg.type === 'tool_result' ? 'var(--amber)' : 'var(--status-blue)'}`,
                      fontSize: 9,
                      color: 'var(--text-muted)',
                      fontFamily: 'IBM Plex Mono, monospace',
                      lineHeight: 1.4,
                      maxHeight: 42,
                      overflow: 'hidden',
                      wordBreak: 'break-all',
                    }}>
                      <span style={{ color: 'var(--text-faint)' }}>
                        {lastMsg.type === 'assistant' ? '🤖' : lastMsg.type === 'tool_result' ? '🔧' : '👤'}
                      </span>
                      {' '}
                      {lastMsg.content.replace(/\n/g, ' ').trim().slice(0, 150)}
                      {lastMsg.content.length > 150 && '...'}
                    </div>
                  )}

                  {editingStep === step.id && editingDraftData && step.draft && (
                    <div style={{
                      marginTop: 6,
                      padding: 8,
                      backgroundColor: 'var(--surface-0)',
                      border: '1px solid var(--border-medium)',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'IBM Plex Mono, monospace' }}>
                        Edit: {editingDraftData.title}
                      </div>
                      {agents && agents.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 2, fontFamily: 'IBM Plex Mono, monospace' }}>Agent</label>
                          <select
                            value={editingDraftData.agent || ''}
                            onChange={(e) => onUpdateDraft?.(editingDraftData.tempId, { agent: e.target.value || undefined })}
                            style={{ width: '100%', height: 24, fontSize: 10, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, color: 'var(--text-primary)', padding: '0 4px' }}
                          >
                            <option value="">Auto</option>
                            {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 2, fontFamily: 'IBM Plex Mono, monospace' }}>Priority</label>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {(['low', 'medium', 'high'] as const).map(p => (
                            <button
                              key={p}
                              onClick={() => onUpdateDraft?.(editingDraftData.tempId, { priority: p })}
                              style={{
                                flex: 1, height: 22, fontSize: 9, fontFamily: 'IBM Plex Mono, monospace',
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
                      <button
                        onClick={() => setEditingStep(null)}
                        style={{
                          width: '100%', height: 22, fontSize: 9, fontFamily: 'IBM Plex Mono, monospace',
                          backgroundColor: 'transparent', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 0,
                        }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginTop: 6,
        fontSize: 8,
        color: 'var(--text-muted)',
        fontFamily: 'IBM Plex Mono, monospace',
        flexWrap: 'wrap',
      }}>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              backgroundColor: cfg.color, display: 'inline-block',
            }} />
            {cfg.label}
          </span>
        ))}
        {steps.some(s => s.checkpointAfter) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9 }}>⏸</span>
            Checkpoint
          </span>
        )}
      </div>

      {/* Action buttons (non-fullscreen) */}
      {!fullscreen && actionButtons && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {actionButtons}
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  )

  if (isFullscreen) {
    return (
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'var(--surface-0)', zIndex: 100,
        display: 'flex', flexDirection: 'column',
        padding: 10, overflow: 'hidden',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}>
        {timelineContent}
      </div>
    )
  }

  return (
    <div style={{ padding: 8, fontFamily: 'IBM Plex Sans, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {timelineContent}
    </div>
  )
}

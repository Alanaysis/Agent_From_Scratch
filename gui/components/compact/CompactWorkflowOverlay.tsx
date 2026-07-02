'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, XCircle, RotateCcw } from 'lucide-react'
import {
  type CompactTask,
  getStatusConfig, getTaskColor, mono, sans,
} from './compactTypes'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : ''

interface RewindTarget {
  status: string
  timestamp: string
}

export interface CompactWorkflowOverlayProps {
  tasks: CompactTask[]
  workflowName: string
  expandedFailedDesc: Set<string>
  onToggleFailedDesc: (taskId: string, expand: boolean) => void
  onClose: () => void
  onTaskRewound?: () => void
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function CompactWorkflowOverlay({
  tasks, workflowName, expandedFailedDesc, onToggleFailedDesc, onClose, onTaskRewound,
}: CompactWorkflowOverlayProps) {
  const [rewindMenuTaskId, setRewindMenuTaskId] = React.useState<string | null>(null)
  const [rewindTargets, setRewindTargets] = React.useState<RewindTarget[]>([])

  const loadRewindTargets = React.useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/rewind-targets`)
      const data = await res.json()
      setRewindTargets(data.targets || [])
    } catch (e) {
      console.error('[Rewind] load targets error:', e)
      setRewindTargets([])
    }
  }, [])

  const handleRewind = React.useCallback(async (taskId: string, targetStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/rewind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus }),
      })
      const data = await res.json()
      if (data.ok) {
        console.log(`[Rewind] ${taskId}: ${data.from} → ${data.to}`)
        setRewindMenuTaskId(null)
        onTaskRewound?.()
      } else {
        console.error('[Rewind] error:', data.error)
      }
    } catch (e) {
      console.error('[Rewind] error:', e)
    }
  }, [onTaskRewound])

  const toggleRewindMenu = React.useCallback((taskId: string) => {
    if (rewindMenuTaskId === taskId) {
      setRewindMenuTaskId(null)
    } else {
      setRewindMenuTaskId(taskId)
      loadRewindTargets(taskId)
    }
  }, [rewindMenuTaskId, loadRewindTargets])

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(12,12,12,0.88)',
      backdropFilter: 'blur(4px)',
      zIndex: 50,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Overlay header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Workflow
          </span>
          {workflowName && (
            <span style={{ fontSize: 10, color: '#d4d4d4', fontFamily: mono }}>
              — {workflowName}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 2, cursor: 'pointer', padding: '3px 8px',
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#d4d4d4', fontSize: 10, fontFamily: mono,
          }}
        >
          <ChevronLeft size={10} />
          Collapse
        </button>
      </div>

      {/* Workflow steps */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {tasks.map((task, idx) => {
          const cfg = getStatusConfig(task)
          const color = getTaskColor(task.id, tasks)
          const isActive = task.status === 'in_progress'
          const isLast = idx === tasks.length - 1
          const hasCondition = !!task.condition
          const hasLoop = !!task.loop
          const hasCheckpoint = !!task.checkpointAfter

          return (
            <div key={task.id} style={{
              marginLeft: 0, position: 'relative',
              opacity: task.status === 'skipped' ? 0.45 : 1,
            }}>
              <div style={{
                position: 'absolute', left: 9, top: 0,
                bottom: isLast ? 16 : 0, width: 2,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }} />

              <div style={{
                display: 'flex', alignItems: 'stretch', gap: 10, padding: '6px 0',
              }}>
                {/* Status dot */}
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  backgroundColor: isActive ? hexToRgba(color, 0.4) : hexToRgba(color, 0.2),
                  border: `2px solid ${color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 3,
                  animation: isActive ? 'pulse 2s infinite' : undefined,
                  boxShadow: isActive ? `0 0 10px ${hexToRgba(color, 0.6)}` : 'none',
                  zIndex: 1,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                </div>

                {/* Task card */}
                <div style={{
                  flex: 1, minWidth: 0,
                  backgroundColor: isActive ? hexToRgba(color, 0.15) : 'rgba(40,40,40,0.8)',
                  border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 3, padding: '8px 10px',
                }}>
                  {/* Badges row */}
                  {(hasCondition || hasLoop || hasCheckpoint) && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
                      {hasCondition && (
                        <span style={{
                          fontSize: 9, fontFamily: mono, fontWeight: 700,
                          padding: '2px 6px',
                          backgroundColor: 'rgba(251,191,36,0.25)',
                          color: '#fbbf24',
                          border: '1px solid #fbbf24',
                          borderRadius: 2,
                        }}>
                          {task.condition?.type === 'llm_judge' ? 'LLM?' : `IF=${task.condition?.equals || '?'}`}
                        </span>
                      )}
                      {hasLoop && (
                        <span style={{
                          fontSize: 9, fontFamily: mono, fontWeight: 700,
                          padding: '2px 6px',
                          backgroundColor: 'rgba(196,181,253,0.25)',
                          color: '#c4b5fd',
                          border: '1px solid #c4b5fd',
                          borderRadius: 2,
                        }}>
                          ⟳ ×{task.loop?.max}
                        </span>
                      )}
                      {hasCheckpoint && (
                        <span style={{
                          fontSize: 9, fontFamily: mono, fontWeight: 700,
                          padding: '2px 6px',
                          backgroundColor: 'rgba(134,239,172,0.25)',
                          color: '#86efac',
                          border: '1px solid #86efac',
                          borderRadius: 2,
                        }}>
                          ⏸ CP
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title + status row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    justifyContent: 'space-between',
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: task.status === 'skipped' ? '#94a3b8' : '#ffffff',
                      fontFamily: sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}>
                      {task.title}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, color: cfg.color, fontFamily: mono,
                        display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700,
                        backgroundColor: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: 2,
                      }}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {task.assignee && (
                        <span style={{
                          fontSize: 9, color: '#e8e0d4', fontFamily: mono,
                          backgroundColor: 'rgba(0,0,0,0.4)', padding: '1px 5px',
                          borderRadius: 2, fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                          @{task.assignee}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {task.description && (isActive || task.status === 'failed') && (
                    task.status === 'failed' && !expandedFailedDesc.has(task.id) ? (
                      <button
                        onClick={() => onToggleFailedDesc(task.id, true)}
                        style={{
                          marginTop: 5, width: '100%', textAlign: 'left',
                          fontSize: 10, fontFamily: mono,
                          color: '#fca5a5', cursor: 'pointer',
                          padding: '3px 6px',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          borderRadius: 2,
                          border: '1px solid rgba(252,165,165,0.2)',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <ChevronRight size={10} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {task.description.slice(0, 60)}
                        </span>
                        <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0 }}>展开</span>
                      </button>
                    ) : task.status === 'failed' ? (
                      <div style={{ marginTop: 5 }}>
                        <button
                          onClick={() => onToggleFailedDesc(task.id, false)}
                          style={{
                            width: '100%', textAlign: 'left',
                            fontSize: 10, fontFamily: mono,
                            color: '#fca5a5', cursor: 'pointer',
                            padding: '3px 6px', marginBottom: 3,
                            backgroundColor: 'transparent',
                            border: 'none',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <ChevronDown size={10} />
                          <span style={{ fontSize: 9, opacity: 0.7 }}>收起描述</span>
                        </button>
                        <div style={{
                          fontSize: 11, fontFamily: mono,
                          color: '#fca5a5', lineHeight: 1.45,
                          padding: '4px 6px',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          borderRadius: 2,
                          maxHeight: 80, overflow: 'auto',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          border: '1px solid rgba(255,255,255,0.15)',
                        }}>
                          {task.description.slice(0, 400)}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: 5, fontSize: 11, fontFamily: mono,
                        color: '#e8e0d4', lineHeight: 1.45,
                        padding: '4px 6px',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: 2,
                        maxHeight: 80, overflow: 'auto',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}>
                        {task.description.slice(0, 400)}
                      </div>
                    )
                  )}

                  {/* Error summary for failed tasks */}
                  {task.status === 'failed' && task.lastError && (
                    <div style={{
                      marginTop: 5, fontSize: 11, fontFamily: mono,
                      color: '#fca5a5', lineHeight: 1.45,
                      padding: '5px 8px',
                      backgroundColor: 'rgba(252,165,165,0.1)',
                      borderRadius: 2,
                      border: '1px solid rgba(252,165,165,0.3)',
                      borderLeft: '3px solid #fca5a5',
                      display: 'flex', alignItems: 'flex-start', gap: 5,
                    }}>
                      <XCircle size={11} color="#fca5a5" style={{ marginTop: 1, flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {task.lastError}
                      </span>
                    </div>
                  )}

                  {/* Rewind button for terminal states */}
                  {(task.status === 'failed' || task.status === 'done' || task.status === 'cancelled') && (
                    <div style={{ marginTop: 5 }}>
                      <button
                        onClick={() => toggleRewindMenu(task.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px',
                          background: rewindMenuTaskId === task.id ? 'rgba(96,165,250,0.2)' : 'transparent',
                          border: '1px solid rgba(96,165,250,0.4)',
                          borderRadius: 2,
                          color: '#60a5fa', fontSize: 10, fontFamily: mono,
                          cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        <RotateCcw size={10} />
                        Rewind
                      </button>
                      {rewindMenuTaskId === task.id && (
                        <div style={{
                          marginTop: 4, padding: '4px 6px',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          border: '1px solid rgba(96,165,250,0.3)',
                          borderRadius: 2,
                        }}>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3, fontFamily: mono }}>
                            回退到历史状态：
                          </div>
                          {rewindTargets.length === 0 ? (
                            <div style={{ fontSize: 9, color: '#64748b', fontFamily: mono }}>
                              No rewind targets available
                            </div>
                          ) : (
                            rewindTargets.map(target => (
                              <button
                                key={target.status}
                                onClick={() => handleRewind(task.id, target.status)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  width: '100%', padding: '3px 6px', marginBottom: 2,
                                  background: 'transparent',
                                  border: '1px solid transparent',
                                  borderRadius: 2,
                                  color: '#d4d4d4', fontSize: 10, fontFamily: mono,
                                  cursor: 'pointer', textAlign: 'left',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = 'rgba(96,165,250,0.15)'
                                  e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = 'transparent'
                                  e.currentTarget.style.borderColor = 'transparent'
                                }}
                              >
                                <RotateCcw size={9} color="#60a5fa" />
                                <span style={{ fontWeight: 600 }}>{target.status}</span>
                                <span style={{ color: '#64748b', fontSize: 8 }}>
                                  {new Date(target.timestamp).toLocaleTimeString()}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>

      {/* Progress summary */}
      {tasks.length > 0 && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-medium)',
          backgroundColor: 'rgba(0,0,0,0.5)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: mono, flexWrap: 'wrap' }}>
            {tasks.filter(t => t.status === 'in_progress').length > 0 && (
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>{tasks.filter(t => t.status === 'in_progress').length} running</span>
            )}
            {tasks.filter(t => t.status === 'done').length > 0 && (
              <span style={{ color: '#86efac', fontWeight: 700 }}>{tasks.filter(t => t.status === 'done').length} done</span>
            )}
            {tasks.filter(t => t.status === 'failed').length > 0 && (
              <span style={{ color: '#fca5a5', fontWeight: 700 }}>{tasks.filter(t => t.status === 'failed').length} failed</span>
            )}
            <span style={{ color: '#d4d4d4', fontWeight: 600 }}>
              {tasks.filter(t => t.status === 'todo').length} pending
            </span>
          </div>
          <div style={{ marginTop: 6, height: 4, backgroundColor: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
            {(() => {
              const done = tasks.filter(t => t.status === 'done').length
              const total = tasks.length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#86efac', borderRadius: 2, transition: 'width 0.3s' }} />
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

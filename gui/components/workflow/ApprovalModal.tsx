'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle, Clock, XCircle, ArrowRight, X, RotateCcw, Play, Hand } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

const S = {
  amber: 'var(--amber)',
  red: 'var(--warm-red)',
  green: 'var(--status-green)',
  surface: 'var(--surface-1)',
  border: 'var(--border-medium)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
}

export function ApprovalModal() {
  const { approvalRequest, resolveApproval } = useAppStore()

  if (!approvalRequest) return null

  const { taskId, taskTitle, approvalMessage, stepIndex, stepTotal, requestType, errorMessage } = approvalRequest
  const isFailure = requestType === 'task_failure'

  return (
    <div data-testid="approval-modal" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: S.surface,
        border: `1px solid ${isFailure ? S.red : S.amber}33`,
        width: 420, maxWidth: '90%',
        animation: 'slide-in-right 0.15s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${S.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: 0,
            backgroundColor: isFailure ? 'rgba(220,80,80,0.15)' : 'rgba(212,165,116,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isFailure ? <XCircle size={12} color={S.red} /> : <AlertCircle size={12} color={S.amber} />}
          </div>
          <span style={{
            fontSize: 13, fontWeight: 600, color: isFailure ? S.red : S.amber,
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            {isFailure ? 'Task Failed' : 'Approval Required'}
          </span>
          {!isFailure && (
            <span data-testid="approval-step" style={{ marginLeft: 'auto', fontSize: 10, color: S.textMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
              Step {stepIndex}/{stepTotal}
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 16 }}>
          {/* Step indicator (only for normal approvals) */}
          {!isFailure && stepTotal > 1 && (
            <div data-testid="approval-progress" style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
              {Array.from({ length: stepTotal }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3,
                  backgroundColor: i < stepIndex - 1 ? S.green : i === stepIndex - 1 ? S.amber : 'var(--surface-2)',
                  borderRadius: 0,
                }} />
              ))}
            </div>
          )}

          {/* Task title */}
          <div style={{
            fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 8,
          }}>
            {taskTitle}
          </div>

          {/* Error message (for failures) */}
          {isFailure && errorMessage && (
            <div style={{
              fontSize: 11, color: S.red, lineHeight: 1.5,
              padding: '8px 10px', backgroundColor: 'rgba(220,80,80,0.06)',
              border: `1px solid rgba(220,80,80,0.2)`, marginBottom: 12,
              fontFamily: 'IBM Plex Mono, monospace', maxHeight: 120, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {errorMessage}
            </div>
          )}

          {/* Approval message */}
          {approvalMessage && (
            <div style={{
              fontSize: 12, color: S.textSec, lineHeight: 1.5,
              padding: '8px 10px', backgroundColor: 'var(--surface-0)',
              border: `1px solid var(--border-subtle)`, marginBottom: 16,
            }}>
              {approvalMessage}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '10px 16px',
          borderTop: `1px solid ${S.border}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          {isFailure ? (
            <>
              {/* Task failure actions: Stop, Continue, Retry */}
              <button
                data-testid="approval-stop"
                onClick={() => resolveApproval(taskId, 'stop')}
                style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                  color: S.textMuted, backgroundColor: 'transparent',
                  border: `1px solid var(--border-subtle)`, borderRadius: 0, cursor: 'pointer',
                }}
              >
                <Hand size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
                Stop
              </button>
              <button
                data-testid="approval-continue"
                onClick={() => resolveApproval(taskId, 'continue')}
                style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                  color: S.amber, backgroundColor: 'transparent',
                  border: `1px solid ${S.amber}33`, borderRadius: 0, cursor: 'pointer',
                }}
              >
                <Play size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
                Continue
              </button>
              <button
                data-testid="approval-retry"
                onClick={() => resolveApproval(taskId, 'retry')}
                style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                  color: '#0c0c0c', backgroundColor: S.amber,
                  border: 'none', borderRadius: 0, cursor: 'pointer', fontWeight: 600,
                }}
              >
                <RotateCcw size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
                Retry
              </button>
            </>
          ) : (
            <>
              {/* Normal approval actions: Abort, Later, Execute */}
              <button
                data-testid="approval-abort"
                onClick={() => resolveApproval(taskId, 'abort')}
                style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                  color: S.red, backgroundColor: 'transparent',
                  border: `1px solid ${S.red}33`, borderRadius: 0, cursor: 'pointer',
                }}
              >
                <XCircle size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
                Abort
              </button>
              <button
                data-testid="approval-later"
                onClick={() => resolveApproval(taskId, 'later')}
                style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                  color: S.textMuted, backgroundColor: 'transparent',
                  border: `1px solid var(--border-subtle)`, borderRadius: 0, cursor: 'pointer',
                }}
              >
                <Clock size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
                Later
              </button>
              <button
                data-testid="approval-execute"
                onClick={() => resolveApproval(taskId, 'execute')}
                style={{
                  padding: '6px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                  color: '#0c0c0c', backgroundColor: S.amber,
                  border: 'none', borderRadius: 0, cursor: 'pointer', fontWeight: 600,
                }}
              >
                <ArrowRight size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
                Execute Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

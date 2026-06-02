'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle, Clock, XCircle, ArrowRight, X } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

const S = {
  amber: 'var(--amber)',
  red: 'var(--warm-red)',
  green: '#5cb85c',
  surface: 'var(--surface-1)',
  border: 'var(--border-medium)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
}

export function ApprovalModal() {
  const { approvalRequest, resolveApproval } = useAppStore()

  if (!approvalRequest) return null

  const { taskId, taskTitle, approvalMessage, stepIndex, stepTotal } = approvalRequest

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: S.surface,
        border: `1px solid ${S.amber}33`,
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
            backgroundColor: 'rgba(212,165,116,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertCircle size={12} color={S.amber} />
          </div>
          <span style={{
            fontSize: 13, fontWeight: 600, color: S.amber,
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            Approval Required
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: S.textMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
            Step {stepIndex}/{stepTotal}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: 16 }}>
          {/* Step indicator */}
          {stepTotal > 1 && (
            <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
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

          {/* Task ID hint */}
          <div style={{ fontSize: 10, color: S.textMuted, marginBottom: 16, fontFamily: 'IBM Plex Mono, monospace' }}>
            Task: {taskTitle}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '10px 16px',
          borderTop: `1px solid ${S.border}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
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
        </div>
      </div>
    </div>
  )
}

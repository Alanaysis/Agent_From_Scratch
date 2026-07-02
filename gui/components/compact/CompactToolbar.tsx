'use client'

import * as React from 'react'
import { Cpu, Plus, History, Play, Trash2 } from 'lucide-react'

const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
const mono = `'IBM Plex Mono', 'SF Mono', Menlo, Consolas, monospace`

export interface SessionItem {
  id: string
  title?: string
  messageCount?: number
  updatedAt?: string
  createdAt?: string
}

export interface CompactToolbarProps {
  sessions: SessionItem[]
  showHistory: boolean
  isLoading: boolean
  onNewSession: () => void
  onToggleHistory: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onOpenPicker: () => void
}

function ToolbarButton({
  icon, label, onClick, accent, disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  accent?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', fontSize: 10, fontFamily: mono, fontWeight: 500,
        backgroundColor: accent ? 'var(--amber)' : 'transparent',
        border: accent ? 'none' : '1px solid var(--border-subtle)',
        borderRadius: 2,
        color: accent ? '#0c0c0c' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        letterSpacing: '0.03em',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

export function CompactToolbar({
  sessions, showHistory, isLoading,
  onNewSession, onToggleHistory, onSelectSession, onDeleteSession, onOpenPicker,
}: CompactToolbarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '6px 10px',
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--surface-1)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
        <Cpu size={14} color="var(--amber)" strokeWidth={1.5} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: mono, letterSpacing: '0.05em' }}>IRG</span>
      </div>
      <div style={{ flex: 1 }} />
      <ToolbarButton icon={<Plus size={12} />} label="Chat" onClick={onNewSession} />
      <div style={{ position: 'relative' }}>
        <ToolbarButton icon={<History size={12} />} label="History" onClick={onToggleHistory} />
        {showHistory && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 100,
            width: 260, maxHeight: 300, overflow: 'auto',
            backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-medium)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            {sessions.length === 0 && (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-faint)', fontSize: 11 }}>No sessions</div>
            )}
            {sessions.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <button
                  onClick={() => onSelectSession(s.id)}
                  style={{
                    flex: 1, display: 'block', padding: '6px 10px',
                    background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || s.id}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: mono }}>
                    {s.messageCount || 0} msgs · {new Date(s.updatedAt || s.createdAt || '').toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                  title="Delete session"
                  style={{
                    padding: '6px 8px', background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--text-faint)',
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--warm-red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <ToolbarButton
        icon={<Play size={12} />}
        label="Start"
        onClick={onOpenPicker}
        accent
        disabled={isLoading}
      />
    </div>
  )
}

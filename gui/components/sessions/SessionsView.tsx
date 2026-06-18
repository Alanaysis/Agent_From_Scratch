'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Search, MessageSquare, Clock, X, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Session } from '@/types'

const defaultStatus = { color: 'var(--text-muted)', bgColor: 'var(--surface-2)', label: 'Unknown' }
const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  active: { color: 'var(--status-green)', bgColor: 'rgba(92,184,92,0.1)', label: 'Active' },
  ready: { color: 'var(--status-blue)', bgColor: 'rgba(59,130,246,0.1)', label: 'Ready' },
  needs_attention: { color: 'var(--amber)', bgColor: 'rgba(245,158,11,0.08)', label: 'Needs Attention' },
  closed: { color: 'var(--text-muted)', bgColor: 'var(--surface-2)', label: 'Closed' },
  // Legacy fallbacks
  paused: { color: 'var(--amber)', bgColor: 'rgba(245,158,11,0.08)', label: 'Paused' },
  completed: { color: 'var(--status-blue)', bgColor: 'rgba(59,130,246,0.1)', label: 'Completed' },
  failed: { color: 'var(--warm-red)', bgColor: 'rgba(239,68,68,0.1)', label: 'Failed' },
}

export function SessionsView() {
  const { sessions, currentSession, setCurrentSession, deleteSession, loadSessions, loadSessionMessages, setViewMode } = useAppStore()
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    loadSessions()
  }, [])

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteSession(id)
    if (currentSession?.id === id) {
      setCurrentSession(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--surface-0)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans, sans-serif', minWidth: 0, overflow: 'hidden' }}>
      {/* Session List */}
      <div style={{
        height: '45%',
        minHeight: 200,
        maxHeight: 400,
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--surface-1)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Search + Clear */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} />
            <Input
              data-testid="session-search"
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 32,
                height: 34,
                fontSize: 12,
                backgroundColor: 'var(--surface-0)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 0,
                fontFamily: 'IBM Plex Mono, monospace',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          {sessions.length > 0 && (
            <button
              data-testid="clear-all-sessions"
              onClick={async () => {
                if (confirm(`Delete all ${sessions.length} sessions?`)) {
                  for (const s of sessions) {
                    await deleteSession(s.id).catch(() => {})
                  }
                  setCurrentSession(null)
                  // Also clear localStorage
                  try {
                    const stored = localStorage.getItem('irg-store')
                    if (stored) {
                      const parsed = JSON.parse(stored)
                      if (parsed?.state) parsed.state.sessions = []
                      localStorage.setItem('irg-store', JSON.stringify(parsed))
                    }
                  } catch {}
                  await loadSessions()
                }
              }}
              style={{
                width: '100%', marginTop: 8, height: 28, fontSize: 10,
                fontFamily: 'IBM Plex Mono, monospace',
                color: 'var(--warm-red)', backgroundColor: 'transparent',
                border: '1px solid rgba(192,80,80,0.15)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(192,80,80,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Trash2 size={11} />
              CLEAR ALL ({sessions.length})
            </button>
          )}
        </div>

        {/* Session List */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ padding: 4 }}>
            {filteredSessions.length === 0 ? (
              <div style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12
              }}>
                No sessions found
              </div>
            ) : (
              filteredSessions.map((session) => {
                const status = statusConfig[session.status] || defaultStatus
                const isSelected = currentSession?.id === session.id
                return (
                  <div
                    key={session.id}
                    data-testid={`session-${session.id}`}
                    onClick={() => setCurrentSession(session)}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 2,
                      borderRadius: 0,
                      backgroundColor: isSelected ? 'var(--surface-2)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                      border: isSelected ? `1px solid ${status.color}` : '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-medium)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Status indicator */}
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: 0,
                        backgroundColor: status.color,
                        marginTop: 7,
                        flexShrink: 0
                      }} />

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          marginBottom: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {session.title || 'Untitled Session'}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 10,
                          color: 'var(--text-faint)',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MessageSquare size={10} />
                            {session.messageCount}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} />
                            {formatDistanceToNow(session.updatedAt, { addSuffix: false })}
                          </span>
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        data-testid={`delete-session-${session.id}`}
                        onClick={(e) => handleDelete(e, session.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-faint)',
                          transition: 'color 0.15s',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--warm-red)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-faint)'}
                        title="Delete session"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Status badge */}
                    <div style={{
                      display: 'inline-block',
                      marginTop: 6,
                      padding: '1px 6px',
                      borderRadius: 0,
                      backgroundColor: 'var(--surface-0)',
                      color: status.color,
                      fontSize: 9,
                      fontWeight: 600,
                      fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      {status.label}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentSession ? (
          <>
            {/* Header */}
            <div style={{
              padding: 16,
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 0,
                  backgroundColor: 'var(--surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {currentSession.title?.slice(0, 2).toUpperCase() || 'UN'}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {currentSession.title || 'Untitled Session'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>
                    Created {formatDistanceToNow(currentSession.createdAt, { addSuffix: true })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await deleteSession(currentSession.id)
                    setCurrentSession(null)
                  }}
                  style={{ width: 26, height: 26, borderRadius: 0 }}
                >
                  <Trash2 size={14} color="var(--text-muted)" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentSession(null)}
                  style={{ width: 26, height: 26, borderRadius: 0 }}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            {/* Info Grid */}
            <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                maxWidth: 500
              }}>
                <InfoCard label="Status" value={
                  <span style={{ color: (statusConfig[currentSession.status] || defaultStatus).color }}>
                    {(statusConfig[currentSession.status] || defaultStatus).label}
                  </span>
                } />
                <InfoCard label="Messages" value={currentSession.messageCount?.toString() || '0'} />
                <InfoCard label="Model" value={currentSession.model || 'N/A'} />
                <InfoCard label="Provider" value={currentSession.provider || 'N/A'} />
              </div>

              {currentSession.lastPrompt && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'IBM Plex Mono, monospace' }}>
                    Last Prompt
                  </div>
                  <div style={{
                    padding: 12,
                    backgroundColor: 'var(--surface-0)',
                    borderRadius: 0,
                    border: '1px solid var(--border-subtle)',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    {currentSession.lastPrompt}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <Button
                  data-testid="continue-session"
                  variant="outline"
                  onClick={async () => {
                    await loadSessionMessages(currentSession.id)
                    setViewMode('chat')
                  }}
                  style={{
                    gap: 6,
                    borderColor: 'var(--amber)',
                    color: 'var(--amber)',
                    borderRadius: 0,
                    fontFamily: 'IBM Plex Sans, sans-serif',
                  }}
                >
                  <ChevronRight size={14} />
                  Continue Session
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13
          }}>
            Select a session to view details
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      padding: 10,
      backgroundColor: 'var(--surface-0)',
      borderRadius: 0,
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'IBM Plex Mono, monospace' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

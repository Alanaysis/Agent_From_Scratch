'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trash2, Search, MessageSquare, Clock, X, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Session } from '@/types'

const defaultStatus = { color: '#666', bgColor: 'rgba(102, 102, 102, 0.1)', label: 'Unknown' }
const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  active: { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)', label: 'Active' },
  paused: { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', label: 'Paused' },
  completed: { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', label: 'Completed' },
  failed: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Failed' },
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
  }

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#0a0a0a', color: '#fff' }}>
      {/* Session List */}
      <div style={{
        width: 340,
        borderRight: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111'
      }}>
        {/* Search */}
        <div style={{ padding: 12, borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#666'
            }} />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 32,
                height: 36,
                fontSize: 13,
                backgroundColor: '#0a0a0a',
                border: '1px solid #222'
              }}
            />
          </div>
        </div>

        {/* Session List */}
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: 8 }}>
            {filteredSessions.length === 0 ? (
              <div style={{
                padding: 24,
                textAlign: 'center',
                color: '#666',
                fontSize: 13
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
                    onClick={() => setCurrentSession(session)}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 4,
                      borderRadius: 8,
                      backgroundColor: isSelected ? '#1e3a5f' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#1a1a1a'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Status indicator */}
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: status.color,
                        marginTop: 6,
                        flexShrink: 0
                      }} />

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#fff',
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
                          fontSize: 11,
                          color: '#888'
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(e, session.id)}
                        style={{
                          width: 24,
                          height: 24,
                          opacity: 0.5,
                          transition: 'opacity 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>

                    {/* Status badge */}
                    <div style={{
                      display: 'inline-block',
                      marginTop: 6,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: status.bgColor,
                      color: status.color,
                      fontSize: 10,
                      fontWeight: 500
                    }}>
                      {status.label}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentSession ? (
          <>
            {/* Header */}
            <div style={{
              padding: 20,
              borderBottom: '1px solid #1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: '#1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff'
                }}>
                  {currentSession.title?.slice(0, 2).toUpperCase() || 'UN'}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
                    {currentSession.title || 'Untitled Session'}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
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
                  style={{ width: 28, height: 28 }}
                >
                  <Trash2 size={14} color="#888" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentSession(null)}
                  style={{ width: 28, height: 28 }}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            {/* Info Grid */}
            <div style={{ padding: 20, flex: 1, overflow: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
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
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Last Prompt
                  </div>
                  <div style={{
                    padding: 12,
                    backgroundColor: '#111',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#ccc',
                    lineHeight: 1.5
                  }}>
                    {currentSession.lastPrompt}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await loadSessionMessages(currentSession.id)
                    setViewMode('chat')
                  }}
                  style={{
                    gap: 6,
                    borderColor: '#333',
                    color: '#fff'
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
            color: '#666',
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
      padding: 12,
      backgroundColor: '#111',
      borderRadius: 8
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: '#fff' }}>
        {value}
      </div>
    </div>
  )
}
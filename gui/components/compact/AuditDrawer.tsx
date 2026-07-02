'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, XCircle, CheckCircle, AlertTriangle, Shield } from 'lucide-react'
import { mono, sans } from './compactTypes'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : ''

interface AuditEntry {
  id: string
  timestamp: string
  taskId: string
  sessionId?: string
  tool: string
  input: unknown
  output?: unknown
  error?: string
  durationMs?: number
  actor?: string
  blocked?: boolean
  blockReason?: string
}

export function AuditDrawer() {
  const [expanded, setExpanded] = React.useState(false)
  const [entries, setEntries] = React.useState<AuditEntry[]>([])
  const [filter, setFilter] = React.useState<'all' | 'blocked' | 'errors' | 'grpc'>('all')
  const [loading, setLoading] = React.useState(false)

  const loadEntries = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/audit?limit=50`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (e) {
      console.error('[AuditDrawer] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (expanded) loadEntries()
  }, [expanded, loadEntries])

  // Auto-refresh every 5s when expanded
  React.useEffect(() => {
    if (!expanded) return
    const timer = setInterval(loadEntries, 5000)
    return () => clearInterval(timer)
  }, [expanded, loadEntries])

  const filtered = React.useMemo(() => {
    if (filter === 'all') return entries
    if (filter === 'blocked') return entries.filter(e => e.blocked)
    if (filter === 'errors') return entries.filter(e => e.error && !e.blocked)
    if (filter === 'grpc') return entries.filter(e => e.tool === 'GrpcClient')
    return entries
  }, [entries, filter])

  const blockedCount = entries.filter(e => e.blocked).length
  const errorCount = entries.filter(e => e.error && !e.blocked).length
  const grpcCount = entries.filter(e => e.tool === 'GrpcClient').length

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'var(--surface-1)',
      borderTop: '1px solid var(--border-medium)',
      zIndex: 30,
      maxHeight: expanded ? 280 : 32,
      transition: 'max-height 0.2s',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: 10, fontFamily: mono, fontWeight: 600,
          color: 'var(--text-secondary)',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <Shield size={11} color="var(--text-faint)" />
        <span>AUDIT</span>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <span style={{ color: grpcCount > 0 ? 'var(--blue)' : 'var(--text-faint)' }}>{grpcCount} gRPC</span>
        {blockedCount > 0 && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>·</span>
            <span style={{ color: 'var(--amber)' }}>{blockedCount} blocked</span>
          </>
        )}
        {errorCount > 0 && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>·</span>
            <span style={{ color: 'var(--warm-red)' }}>{errorCount} errors</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        {expanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: '2px 10px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            {([
              ['all', `All (${entries.length})`],
              ['grpc', `gRPC (${grpcCount})`],
              ['blocked', `Blocked (${blockedCount})`],
              ['errors', `Errors (${errorCount})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); setFilter(key) }}
                style={{
                  padding: '2px 6px', fontSize: 9, fontFamily: mono,
                  background: filter === key ? 'var(--surface-3)' : 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 2,
                  color: filter === key ? 'var(--text-primary)' : 'var(--text-faint)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Entries list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
            {loading && entries.length === 0 && (
              <div style={{ padding: 8, textAlign: 'center', color: 'var(--text-faint)', fontSize: 10 }}>
                Loading...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 8, textAlign: 'center', color: 'var(--text-faint)', fontSize: 10 }}>
                No audit entries
              </div>
            )}
            {filtered.map(entry => (
              <AuditEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = React.useState(false)
  const time = new Date(entry.timestamp).toLocaleTimeString()
  const isBlocked = entry.blocked
  const isError = entry.error && !entry.blocked
  const isGrpc = entry.tool === 'GrpcClient'

  const icon = isBlocked
    ? <Shield size={10} color="var(--amber)" />
    : isError
      ? <XCircle size={10} color="var(--warm-red)" />
      : <CheckCircle size={10} color="var(--green)" />

  const inputStr = typeof entry.input === 'object' && entry.input !== null
    ? JSON.stringify(entry.input).slice(0, 120)
    : String(entry.input || '').slice(0, 120)

  return (
    <div style={{
      padding: '3px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 10, fontFamily: mono,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
      >
        {icon}
        <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>{time}</span>
        <span style={{
          fontWeight: 700,
          color: isGrpc ? 'var(--blue)' : isBlocked ? 'var(--amber)' : isError ? 'var(--warm-red)' : 'var(--text-primary)',
        }}>
          {entry.tool}
        </span>
        {entry.durationMs !== undefined && (
          <span style={{ color: 'var(--text-faint)' }}>{entry.durationMs}ms</span>
        )}
        {entry.actor && (
          <span style={{ color: 'var(--text-faint)', fontSize: 9 }}>@{entry.actor}</span>
        )}
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'var(--text-faint)',
        }}>
          {inputStr}
        </span>
        {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
      </div>
      {expanded && (
        <div style={{ padding: '4px 8px', marginTop: 2 }}>
          {isBlocked && entry.blockReason && (
            <div style={{
              padding: '3px 6px', marginBottom: 4,
              backgroundColor: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 2,
              color: 'var(--amber)',
              fontSize: 10,
            }}>
              <Shield size={9} style={{ display: 'inline', marginRight: 4 }} />
              {entry.blockReason}
            </div>
          )}
          {entry.error && !isBlocked && (
            <div style={{
              padding: '3px 6px', marginBottom: 4,
              backgroundColor: 'rgba(252,165,165,0.1)',
              border: '1px solid rgba(252,165,165,0.3)',
              borderRadius: 2,
              color: 'var(--warm-red)',
              fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {entry.error}
            </div>
          )}
          <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2 }}>Input:</div>
          <pre style={{
            fontSize: 9, fontFamily: mono,
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--surface-2)',
            padding: '4px 6px', borderRadius: 2,
            overflow: 'auto', maxHeight: 100,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            margin: 0,
          }}>
            {String(JSON.stringify(entry.input, null, 2))}
          </pre>
          {entry.output != null && (
            <>
              <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 4, marginBottom: 2 }}>Output:</div>
              <pre style={{
                fontSize: 9, fontFamily: mono,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--surface-2)',
                padding: '4px 6px', borderRadius: 2,
                overflow: 'auto', maxHeight: 100,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                margin: 0,
              }}>
                {typeof entry.output === 'string' ? entry.output : String(JSON.stringify(entry.output, null, 2))}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

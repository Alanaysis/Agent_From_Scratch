'use client'

import * as React from 'react'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { mono } from './compactTypes'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : ''

interface ConstraintEntry {
  id: string
  content: string
  confidence: number
  tags: string[]
  usageCount: number
  createdAt: string
}

export function ConstraintPanel() {
  const [entries, setEntries] = React.useState<ConstraintEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)

  const loadEntries = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/constraints`)
      const data = await res.json()
      setEntries(data.constraints || [])
    } catch (e) {
      console.error('[ConstraintPanel] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (expanded) loadEntries()
  }, [expanded, loadEntries])

  const blockCount = entries.filter(e => e.confidence >= 0.8 || e.tags.includes('block')).length
  const warnCount = entries.length - blockCount

  return (
    <div style={{
      padding: '4px 10px',
      backgroundColor: 'var(--surface-1)',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer',
          fontSize: 10, fontFamily: mono, fontWeight: 600,
          color: 'var(--text-secondary)',
          userSelect: 'none',
        }}
      >
        <Shield size={11} color="var(--text-faint)" />
        <span>CONSTRAINTS</span>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <span style={{ color: blockCount > 0 ? 'var(--warm-red)' : 'var(--text-faint)' }}>
          {blockCount} block
        </span>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <span style={{ color: warnCount > 0 ? 'var(--amber)' : 'var(--text-faint)' }}>
          {warnCount} warn
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
          {expanded ? '▾' : '▸'}
        </span>
      </div>
      {expanded && (
        <div style={{ marginTop: 4, maxHeight: 120, overflowY: 'auto' }}>
          {loading && entries.length === 0 && (
            <div style={{ padding: 6, textAlign: 'center', color: 'var(--text-faint)', fontSize: 10 }}>
              Loading...
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div style={{ padding: 6, textAlign: 'center', color: 'var(--text-faint)', fontSize: 10 }}>
              No constraints learned yet. They appear after reflection extracts hard rules.
            </div>
          )}
          {entries.map(entry => {
            const isBlock = entry.confidence >= 0.8 || entry.tags.includes('block')
            // Parse "agentType=X toolName=Y: rule" format
            const colonIdx = entry.content.indexOf(':')
            const matchPart = colonIdx > 0 ? entry.content.slice(0, colonIdx).trim() : ''
            const rulePart = colonIdx > 0 ? entry.content.slice(colonIdx + 1).trim() : entry.content

            return (
              <div key={entry.id} style={{
                padding: '4px 6px', marginBottom: 3,
                backgroundColor: isBlock ? 'rgba(252,165,165,0.08)' : 'rgba(251,191,36,0.08)',
                borderRadius: 2,
                border: `1px solid ${isBlock ? 'rgba(252,165,165,0.3)' : 'rgba(251,191,36,0.3)'}`,
                fontSize: 10, fontFamily: mono,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  {isBlock ? (
                    <ShieldAlert size={10} color="var(--warm-red)" />
                  ) : (
                    <ShieldCheck size={10} color="var(--amber)" />
                  )}
                  <span style={{
                    fontWeight: 700,
                    color: isBlock ? 'var(--warm-red)' : 'var(--amber)',
                    fontSize: 9,
                  }}>
                    {isBlock ? 'BLOCK' : 'WARN'}
                  </span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 8 }}>
                    {Math.round(entry.confidence * 100)}% · used {entry.usageCount}×
                  </span>
                </div>
                {matchPart && (
                  <div style={{ color: 'var(--text-faint)', fontSize: 8, marginBottom: 2 }}>
                    {matchPart}
                  </div>
                )}
                <div style={{ color: 'var(--text-secondary)', fontSize: 9, lineHeight: 1.4 }}>
                  {rulePart.slice(0, 150)}
                  {rulePart.length > 150 && '...'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

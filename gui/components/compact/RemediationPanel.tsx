'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Wrench, Trash2 } from 'lucide-react'
import { mono } from './compactTypes'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : ''

interface RemediationEntry {
  id: string
  category: string
  content: string
  source: string
  confidence: number
  usageCount: number
  tags: string[]
  createdAt: string
}

export function RemediationPanel() {
  const [expanded, setExpanded] = React.useState(false)
  const [entries, setEntries] = React.useState<RemediationEntry[]>([])
  const [loading, setLoading] = React.useState(false)

  const loadEntries = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/remediations`)
      const data = await res.json()
      setEntries(data.remediations || [])
    } catch (e) {
      console.error('[RemediationPanel] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (expanded) loadEntries()
  }, [expanded, loadEntries])

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
        <Wrench size={11} color="var(--text-faint)" />
        <span>REMEDIATIONS</span>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <span style={{ color: entries.length > 0 ? 'var(--purple)' : 'var(--text-faint)' }}>
          {entries.length} learned
        </span>
        <div style={{ flex: 1 }} />
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
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
              No remediations learned yet. They appear after reflection extracts error fixes.
            </div>
          )}
          {entries.map(entry => (
            <RemediationRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function RemediationRow({ entry }: { entry: RemediationEntry }) {
  // Parse "fingerprint | strategy" format
  const pipeIndex = entry.content.indexOf("|")
  const fingerprint = pipeIndex > 0 ? entry.content.slice(0, pipeIndex).trim() : entry.content.slice(0, 50)
  const strategy = pipeIndex > 0 ? entry.content.slice(pipeIndex + 1).trim() : entry.content

  const isUserAction = entry.tags.includes("user-action")
  const confidencePct = Math.round(entry.confidence * 100)

  return (
    <div style={{
      padding: '4px 6px', marginBottom: 3,
      backgroundColor: 'var(--surface-2)',
      borderRadius: 2,
      border: '1px solid var(--border-subtle)',
      fontSize: 10, fontFamily: mono,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{
          fontWeight: 700,
          color: isUserAction ? 'var(--green)' : 'var(--purple)',
          fontSize: 9,
        }}>
          {fingerprint}
        </span>
        <span style={{ color: 'var(--text-faint)', fontSize: 8 }}>
          {confidencePct}% · used {entry.usageCount}×
        </span>
        {isUserAction && (
          <span style={{
            fontSize: 8, padding: '0 3px',
            backgroundColor: 'rgba(134,239,172,0.2)',
            color: 'var(--green)',
            borderRadius: 2,
          }}>
            USER
          </span>
        )}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 9, lineHeight: 1.4 }}>
        {strategy.slice(0, 150)}
        {strategy.length > 150 && '...'}
      </div>
    </div>
  )
}

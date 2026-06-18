'use client'

import * as React from 'react'
import { X, FileText, Loader2 } from 'lucide-react'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : ''

interface RemoteFile {
  name: string
  path: string
  type: string
}

interface ProposalPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (filePath: string) => void
}

export function ProposalPicker({ open, onClose, onSelect }: ProposalPickerProps) {
  const [files, setFiles] = React.useState<RemoteFile[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/workflows/files`)
      .then(r => r.json())
      .then(data => {
        setFiles(data.files || [])
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border-medium)',
          width: '100%',
          maxWidth: 420,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--surface-2)',
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'IBM Plex Mono, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Select Workflow
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Loading...
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--warm-red)', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}>
              {error}
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-faint)', fontSize: 11 }}>
              No workflow files found. Place *.yaml files in the workflows/ directory.
            </div>
          )}

          {!loading && files.map(file => (
            <button
              key={file.path}
              onClick={() => { onSelect(file.path); onClose() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FileText size={14} color="var(--amber)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {file.name}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'var(--text-faint)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {file.path}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

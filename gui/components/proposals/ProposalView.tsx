'use client'

import * as React from 'react'
import { Plus, FileText, CheckCircle, XCircle, Clock, Loader2, Trash2, ChevronRight, Eye, Upload, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProposalDetailPanel } from './ProposalDetailPanel'
import type { Proposal } from '@/types'

const columns: { id: Proposal['status']; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'draft', label: 'Draft', color: '#3b82f6', icon: <FileText size={12} /> },
  { id: 'pending', label: 'Pending Review', color: 'var(--amber)', icon: <Clock size={12} /> },
  { id: 'approved', label: 'Approved', color: '#5cb85c', icon: <CheckCircle size={12} /> },
  { id: 'rejected', label: 'Rejected', color: 'var(--warm-red)', icon: <XCircle size={12} /> },
]

export function ProposalView() {
  const { proposals, loadProposals, createProposal, deleteProposal, setViewMode } = useAppStore()
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedProposal, setSelectedProposal] = React.useState<Proposal | null>(null)

  React.useEffect(() => {
    loadProposals().finally(() => setIsLoading(false))
  }, [])

  React.useEffect(() => {
    if (selectedProposal) {
      const updated = proposals.find(p => p.id === selectedProposal.id)
      if (updated) {
        setSelectedProposal(updated)
      }
    }
  }, [proposals])

  const handleCreate = async () => {
    // Open the proposal editor
    useAppStore.getState().editingProposalId = null
    setViewMode('proposal-editor')
  }

  const [showFilePicker, setShowFilePicker] = React.useState(false)
  const [remoteFiles, setRemoteFiles] = React.useState<Array<{ name: string; path: string; type: string }>>([])
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleImportWorkflow = async () => {
    // Browser mode — list remote files
    if (!window.electronAPI?.invoke) {
      setIsLoadingFiles(true)
      setShowFilePicker(true)
      try {
        const result = await useAppStore.getState().sendToBackend('workflows:list_files') as { files: Array<{ name: string; path: string; type: string }> }
        setRemoteFiles(result?.files || [])
      } catch (e) {
        console.error('[ProposalView] Failed to list remote files:', e)
        setRemoteFiles([])
      }
      setIsLoadingFiles(false)
      return
    }
    // Electron mode — use native file dialog
    try {
      const dialogResult = await useAppStore.getState().sendToBackend('workflows:open_file_dialog') as { filePath: string | null }
      if (!dialogResult?.filePath) return
      const result = await useAppStore.getState().sendToBackend('workflows:import_file', {
        filePath: dialogResult.filePath,
      }) as { proposalId: string }
      await loadProposals()
      const updated = useAppStore.getState().proposals.find(p => p.id === result.proposalId)
      if (updated) setSelectedProposal(updated)
    } catch (e) {
      console.error('[ProposalView] Import workflow error:', e)
    }
  }

  const handleImportRemoteFile = async (filePath: string) => {
    setShowFilePicker(false)
    try {
      const result = await useAppStore.getState().sendToBackend('workflows:import_remote', {
        filePath,
        createdBy: 'user',
      }) as { workflow: any; proposalId: string }
      await loadProposals()
      // Select the newly created proposal
      const updated = useAppStore.getState().proposals.find(p => p.id === result.proposalId)
      if (updated) setSelectedProposal(updated)
    } catch (e) {
      console.error('[ProposalView] Import remote file error:', e)
    }
  }

  const handlePasteYaml = async () => {
    const yaml = prompt('Paste workflow YAML content:')
    if (!yaml) return
    try {
      const result = await useAppStore.getState().sendToBackend('workflows:import_yaml', {
        yaml,
        createdBy: 'user',
      }) as { proposalId: string }
      await loadProposals()
      const updated = useAppStore.getState().proposals.find(p => p.id === result.proposalId)
      if (updated) setSelectedProposal(updated)
    } catch (e) {
      console.error('[ProposalView] Import yaml error:', e)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteProposal(id)
    if (selectedProposal?.id === id) {
      setSelectedProposal(null)
    }
  }

  const getProposalsByStatus = (status: Proposal['status']) =>
    proposals.filter((p) => p.status === status)

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: 'var(--surface-0)',
        color: 'var(--text-muted)',
        gap: 8,
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Loading proposals...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: 'var(--surface-0)',
      overflow: 'hidden',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 2,
        padding: 6,
        overflow: 'hidden'
      }}>
        {columns.map((col) => {
          const colProposals = getProposalsByStatus(col.id)
          return (
            <div key={col.id} style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              backgroundColor: 'var(--surface-1)',
              borderRadius: 0,
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden'
            }}>
              {/* Column header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
                borderTop: `2px solid ${col.color}`,
                backgroundColor: 'var(--surface-1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 0,
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: col.color,
                  }}>
                    {col.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{col.label}</span>
                  <span style={{
                    fontSize: 9,
                    color: col.color,
                    backgroundColor: 'var(--surface-0)',
                    padding: '1px 5px',
                    borderRadius: 0,
                    fontWeight: 600,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    {colProposals.length}
                  </span>
                </div>
              </div>

              {/* Proposal cards */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}>
                {colProposals.map((proposal) => (
                  <div key={proposal.id} style={{
                    padding: '8px 10px',
                    backgroundColor: selectedProposal?.id === proposal.id ? 'var(--surface-2)' : 'var(--surface-0)',
                    borderRadius: 0,
                    border: `1px solid ${selectedProposal?.id === proposal.id ? col.color : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                    onClick={() => setSelectedProposal(proposal)}
                    onMouseEnter={(e) => {
                      if (selectedProposal?.id !== proposal.id) e.currentTarget.style.borderColor = 'var(--border-medium)'
                    }}
                    onMouseLeave={(e) => {
                      if (selectedProposal?.id !== proposal.id) e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    }}
                  >
                    <h4 style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'IBM Plex Sans, sans-serif',
                    }}>
                      {proposal.title}
                    </h4>

                    {proposal.description && (
                      <p style={{
                        fontSize: 10,
                        color: 'var(--text-faint)',
                        marginBottom: 6,
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {proposal.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {proposal.taskDrafts.length > 0 && (
                          <span style={{
                            fontSize: 9,
                            color: '#3b82f6',
                            backgroundColor: 'rgba(59,130,246,0.1)',
                            padding: '1px 5px',
                            borderRadius: 0,
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontWeight: 600,
                          }}>
                            {proposal.taskDrafts.length} tasks
                          </span>
                        )}
                        {proposal.documentDrafts.length > 0 && (
                          <span style={{
                            fontSize: 9,
                            color: '#7b68c0',
                            backgroundColor: 'rgba(123,104,192,0.1)',
                            padding: '1px 5px',
                            borderRadius: 0,
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontWeight: 600,
                          }}>
                            {proposal.documentDrafts.length} docs
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono, monospace' }}>
                          {formatDistanceToNow(proposal.updatedAt, { addSuffix: false })}
                        </span>
                        <button
                          onClick={(e) => handleDelete(e, proposal.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 2,
                            opacity: 0.3,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                        >
                          <Trash2 size={10} color="var(--text-muted)" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* New proposal + import (only in draft column) */}
                {col.id === 'draft' && (
                  <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={handleCreate}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        height: 32, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                        color: '#0c0c0c', backgroundColor: 'var(--amber)',
                        border: 'none', borderRadius: 0, cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      <Plus size={12} />
                      New Proposal
                    </button>
                    <button
                      onClick={handleImportWorkflow}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 26,
                        fontSize: 10,
                        color: 'var(--copper)',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 0,
                        cursor: 'pointer',
                        fontFamily: 'IBM Plex Mono, monospace',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--copper)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                    >
                      <Upload size={11} />
                      Import Workflow YAML
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedProposal && (
        <ProposalDetailPanel
          proposal={selectedProposal}
          onClose={() => setSelectedProposal(null)}
        />
      )}

      {/* Remote file picker modal */}
      {showFilePicker && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--surface-1)', padding: 20, width: 420, maxHeight: '70vh',
            border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace' }}>
                Import Workflow
              </span>
              <button onClick={() => setShowFilePicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {isLoadingFiles ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Loading files from server...
              </div>
            ) : remoteFiles.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                <div style={{ marginBottom: 12 }}>No workflow files found on server.</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  Place <code style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--amber)' }}>*.yaml</code> files in the <code style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--amber)' }}>workflows/</code> directory on the server.
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono, monospace', marginBottom: 4 }}>
                  Available on server:
                </div>
                {remoteFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => handleImportRemoteFile(file.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', backgroundColor: 'var(--surface-0)',
                      border: '1px solid var(--border-subtle)', cursor: 'pointer',
                      textAlign: 'left', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--amber)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
                    <span style={{
                      fontSize: 8, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700,
                      color: file.type === 'proto' ? '#7b68c0' : 'var(--amber)',
                      backgroundColor: file.type === 'proto' ? 'rgba(123,104,192,0.1)' : 'rgba(212,165,116,0.1)',
                      padding: '1px 4px', borderRadius: 0,
                    }}>
                      {file.type === 'proto' ? 'PROTO' : 'YAML'}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{file.path}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
              <button
                onClick={handlePasteYaml}
                style={{
                  flex: 1, height: 32, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace',
                  color: 'var(--text-secondary)', backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle)', cursor: 'pointer',
                }}
              >
                Paste YAML instead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

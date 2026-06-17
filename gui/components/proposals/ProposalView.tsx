'use client'

import * as React from 'react'
import { Plus, FileText, CheckCircle, XCircle, Clock, Loader2, Trash2, ChevronRight, ChevronDown, Eye, Upload, X, Pencil } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProposalDetailPanel } from './ProposalDetailPanel'
import type { Proposal } from '@/types'

const statusGroups = [
  { id: 'draft', label: 'Draft', color: 'var(--status-blue)', icon: <FileText size={10} />, statuses: ['draft'] as Proposal['status'][] },
  { id: 'review', label: 'Review', color: 'var(--amber)', icon: <Clock size={10} />, statuses: ['pending'] as Proposal['status'][] },
  { id: 'resolved', label: 'Resolved', color: 'var(--status-green)', icon: <CheckCircle size={10} />, statuses: ['approved', 'rejected'] as Proposal['status'][] },
]

const statusBadge: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'DRAFT', color: 'var(--status-blue)', bgColor: 'rgba(59,130,246,0.1)' },
  pending: { label: 'PENDING', color: 'var(--amber)', bgColor: 'rgba(245,158,11,0.08)' },
  approved: { label: 'APPROVED', color: 'var(--status-green)', bgColor: 'rgba(92,184,92,0.1)' },
  rejected: { label: 'REJECTED', color: 'var(--warm-red)', bgColor: 'rgba(239,68,68,0.1)' },
}

export function ProposalView() {
  const { proposals, loadProposals, createProposal, deleteProposal, setViewMode } = useAppStore()
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedProposal, setSelectedProposal] = React.useState<Proposal | null>(null)
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set())
  const [showAddInput, setShowAddInput] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('')

  const [showFilePicker, setShowFilePicker] = React.useState(false)
  const [remoteFiles, setRemoteFiles] = React.useState<Array<{ name: string; path: string; type: string }>>([])
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false)

  React.useEffect(() => {
    loadProposals().finally(() => setIsLoading(false))
  }, [])

  React.useEffect(() => {
    if (selectedProposal) {
      const updated = proposals.find(p => p.id === selectedProposal.id)
      if (updated) setSelectedProposal(updated)
    }
  }, [proposals])

  const handleCreate = async () => {
    if (newTitle.trim()) {
      await createProposal({ title: newTitle.trim() })
      setNewTitle('')
      setShowAddInput(false)
    } else {
      useAppStore.getState().editingProposalId = null
      setViewMode('proposal-editor')
    }
  }

  const handleImportWorkflow = async () => {
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
    const proposal = proposals.find(p => p.id === id)
    if (!confirm(`Delete proposal "${proposal?.title || id}"? This will also delete all associated tasks and sessions.`)) return
    await deleteProposal(id)
    if (selectedProposal?.id === id) setSelectedProposal(null)
  }

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getProposalsByStatuses = (statuses: Proposal['status'][]) =>
    proposals.filter(p => statuses.includes(p.status))

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
      position: 'relative',
    }}>
      {/* Proposal list */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          backgroundColor: 'var(--surface-1)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
            Proposals ({proposals.length})
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleImportWorkflow}
              title="Import Workflow YAML"
              style={{ width: 24, height: 24, borderRadius: 0 }}
            >
              <Upload size={12} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowAddInput(!showAddInput)}
              style={{ width: 24, height: 24, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000' }}
            >
              <Plus size={12} />
            </Button>
          </div>
        </div>

        {/* Add proposal input */}
        {showAddInput && (
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 4, flexShrink: 0 }}>
            <Input
              placeholder="Proposal title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1, height: 26, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}
            />
            <Button size="icon" variant="ghost" onClick={handleCreate} style={{ width: 26, height: 26, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000' }}>
              <Plus size={10} />
            </Button>
          </div>
        )}

        {/* Grouped proposal list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {statusGroups.map(group => {
            const groupProposals = getProposalsByStatuses(group.statuses)
            if (groupProposals.length === 0) return null
            const isCollapsed = collapsedGroups.has(group.id)

            return (
              <div key={group.id} style={{ marginBottom: 2 }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'IBM Plex Mono, monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  <span style={{ color: group.color }}>{group.icon}</span>
                  <span>{group.label}</span>
                  <span style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--surface-2)',
                    padding: '1px 5px',
                    borderRadius: 0,
                    fontWeight: 600,
                  }}>
                    {groupProposals.length}
                  </span>
                </button>

                {/* Proposal rows */}
                {!isCollapsed && groupProposals.map(proposal => {
                  const badge = statusBadge[proposal.status]
                  const isSelected = selectedProposal?.id === proposal.id

                  return (
                    <div
                      key={proposal.id}
                      data-testid={`proposal-${proposal.id}`}
                      onClick={() => setSelectedProposal(proposal)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px 4px 24px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--surface-2)' : 'transparent',
                        borderLeft: isSelected ? `2px solid ${group.color}` : '2px solid transparent',
                        transition: 'background-color 0.1s',
                        minWidth: 0,
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--surface-1)' }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      {/* Status badge */}
                      <span style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: badge.color,
                        backgroundColor: badge.bgColor,
                        padding: '1px 4px',
                        borderRadius: 0,
                        fontFamily: 'IBM Plex Mono, monospace',
                        flexShrink: 0,
                        letterSpacing: '0.03em',
                      }}>
                        {badge.label}
                      </span>

                      {/* Task/doc counts */}
                      {proposal.taskDrafts.length > 0 && (
                        <span style={{
                          fontSize: 8,
                          color: 'var(--status-blue)',
                          backgroundColor: 'rgba(59,130,246,0.1)',
                          padding: '1px 3px',
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}>
                          {proposal.taskDrafts.length}T
                        </span>
                      )}
                      {proposal.documentDrafts.length > 0 && (
                        <span style={{
                          fontSize: 8,
                          color: 'var(--status-purple)',
                          backgroundColor: 'rgba(123,104,192,0.1)',
                          padding: '1px 3px',
                          borderRadius: 0,
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}>
                          {proposal.documentDrafts.length}D
                        </span>
                      )}

                      {/* Title */}
                      <span style={{
                        flex: 1,
                        fontSize: 11,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {proposal.title}
                      </span>

                      {/* Time */}
                      <span style={{
                        fontSize: 9,
                        color: 'var(--text-faint)',
                        fontFamily: 'IBM Plex Mono, monospace',
                        flexShrink: 0,
                      }}>
                        {formatDistanceToNow(proposal.updatedAt, { addSuffix: false })}
                      </span>

                      {/* Edit button (draft only) */}
                      {proposal.status === 'draft' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            useAppStore.getState().editingProposalId = proposal.id
                            setViewMode('proposal-editor')
                          }}
                          className="proposal-action-btn"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 2,
                            opacity: 0,
                            display: 'flex',
                            flexShrink: 0,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          <Pencil size={10} color="var(--amber)" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={(e) => handleDelete(e, proposal.id)}
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          cursor: 'pointer',
                          padding: '3px 6px',
                          display: 'flex',
                          flexShrink: 0,
                          borderRadius: 2,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                      >
                        <Trash2 size={10} color="var(--warm-red)" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
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
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2147483647,
          padding: 16,
        }}>
          <div style={{
            backgroundColor: 'var(--surface-1)', padding: 24,
            width: '100%', maxWidth: 700, maxHeight: '85vh',
            border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minWidth: 0, gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                Import Workflow YAML
              </span>
              <button onClick={() => setShowFilePicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
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
                      minWidth: 0,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--amber)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
                    <span style={{
                      fontSize: 8, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700,
                      color: file.type === 'proto' ? 'var(--status-purple)' : 'var(--amber)',
                      backgroundColor: file.type === 'proto' ? 'rgba(123,104,192,0.1)' : 'rgba(212,165,116,0.1)',
                      padding: '1px 4px', borderRadius: 0, flexShrink: 0,
                    }}>
                      {file.type === 'proto' ? 'PROTO' : 'YAML'}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <button
                onClick={handlePasteYaml}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', height: 28, fontSize: 10,
                  color: 'var(--copper)', backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle)', borderRadius: 0,
                  cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--copper)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              >
                Paste YAML Content
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .proposal-row:hover .proposal-action-btn { opacity: 0.5 !important; }
        .proposal-row:hover .proposal-action-btn:hover { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

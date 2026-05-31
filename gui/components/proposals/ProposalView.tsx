'use client'

import * as React from 'react'
import { Plus, FileText, CheckCircle, XCircle, Clock, Loader2, Trash2, ChevronRight, Eye, Upload } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProposalDetailPanel } from './ProposalDetailPanel'
import type { Proposal } from '@/types'

const columns: { id: Proposal['status']; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'draft', label: 'Draft', color: '#6b7280', icon: <FileText size={12} /> },
  { id: 'pending', label: 'Pending Review', color: '#f59e0b', icon: <Clock size={12} /> },
  { id: 'approved', label: 'Approved', color: '#22c55e', icon: <CheckCircle size={12} /> },
  { id: 'rejected', label: 'Rejected', color: '#ef4444', icon: <XCircle size={12} /> },
]

export function ProposalView() {
  const { proposals, loadProposals, createProposal, deleteProposal } = useAppStore()
  const [newTitle, setNewTitle] = React.useState('')
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
    const title = newTitle.trim()
    if (!title) return
    await createProposal({ title })
    setNewTitle('')
  }

  const handleImportWorkflow = async () => {
    try {
      const dialogResult = await useAppStore.getState().sendToBackend('workflows:open_file_dialog') as { filePath: string | null }
      if (!dialogResult?.filePath) return

      const result = await useAppStore.getState().sendToBackend('workflows:import_file', {
        filePath: dialogResult.filePath,
      }) as { proposalId: string }

      await loadProposals()
      // Select the newly created proposal
      const updated = useAppStore.getState().proposals.find(p => p.id === result.proposalId)
      if (updated) setSelectedProposal(updated)
    } catch (e) {
      console.error('[ProposalView] Import workflow error:', e)
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
        backgroundColor: '#0a0a0a',
        color: '#666',
        gap: 8,
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
      backgroundColor: '#0a0a0a',
      overflow: 'hidden'
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 6,
        padding: 10,
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
              backgroundColor: '#111',
              borderRadius: 10,
              border: '1px solid #1a1a1a',
              overflow: 'hidden'
            }}>
              {/* Column header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid #1a1a1a',
                flexShrink: 0,
                background: `linear-gradient(180deg, ${col.color}08 0%, transparent 100%)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    backgroundColor: col.color + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: col.color,
                  }}>
                    {col.icon}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{col.label}</span>
                  <span style={{
                    fontSize: 10,
                    color: col.color,
                    backgroundColor: col.color + '15',
                    padding: '1px 6px',
                    borderRadius: 10,
                    fontWeight: 600,
                  }}>
                    {colProposals.length}
                  </span>
                </div>
              </div>

              {/* Proposal cards */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                {colProposals.map((proposal) => (
                  <div key={proposal.id} style={{
                    padding: 10,
                    backgroundColor: selectedProposal?.id === proposal.id ? '#1a2a3a' : '#0d0d0d',
                    borderRadius: 8,
                    border: `1px solid ${selectedProposal?.id === proposal.id ? col.color + '66' : '#1a1a1a'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                    onClick={() => setSelectedProposal(proposal)}
                    onMouseEnter={(e) => {
                      if (selectedProposal?.id !== proposal.id) e.currentTarget.style.borderColor = col.color + '44'
                    }}
                    onMouseLeave={(e) => {
                      if (selectedProposal?.id !== proposal.id) e.currentTarget.style.borderColor = '#1a1a1a'
                    }}
                  >
                    <h4 style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#fff',
                      marginBottom: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {proposal.title}
                    </h4>

                    {proposal.description && (
                      <p style={{
                        fontSize: 10,
                        color: '#555',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {proposal.taskDrafts.length > 0 && (
                          <span style={{
                            fontSize: 9,
                            color: '#3b82f6',
                            backgroundColor: 'rgba(59,130,246,0.1)',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}>
                            {proposal.taskDrafts.length} tasks
                          </span>
                        )}
                        {proposal.documentDrafts.length > 0 && (
                          <span style={{
                            fontSize: 9,
                            color: '#a855f7',
                            backgroundColor: 'rgba(168,85,247,0.1)',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}>
                            {proposal.documentDrafts.length} docs
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: '#444' }}>
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
                          <Trash2 size={10} color="#888" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* New proposal input + import (only in draft column) */}
                {col.id === 'draft' && (
                  <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Input
                        placeholder="New proposal..."
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        style={{
                          flex: 1,
                          height: 30,
                          fontSize: 11,
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #1a1a1a',
                          borderRadius: 6,
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCreate}
                        style={{ width: 30, height: 30, borderRadius: 6 }}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                    <button
                      onClick={handleImportWorkflow}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 28,
                        fontSize: 10,
                        color: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.08)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.08)'}
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
    </div>
  )
}

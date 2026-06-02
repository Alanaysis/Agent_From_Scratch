'use client'

import * as React from 'react'
import { X, Plus, Trash2, FileText, CheckCircle, XCircle, Clock, ArrowRight, Link2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pixelAvatarToDataUrl, getAgentColor } from '@/lib/pixelAvatar'
import { WorkflowProgressView } from '@/components/workflow/WorkflowProgressView'
import type { Proposal, TaskDraft } from '@/types'

const statusConfig: Record<string, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  draft: { color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', label: 'Draft', icon: <FileText size={11} /> },
  pending: { color: 'var(--amber)', bgColor: 'rgba(245,158,11,0.08)', label: 'Pending', icon: <Clock size={11} /> },
  approved: { color: '#5cb85c', bgColor: 'rgba(92,184,92,0.1)', label: 'Approved', icon: <CheckCircle size={11} /> },
  rejected: { color: 'var(--warm-red)', bgColor: 'rgba(239,68,68,0.1)', label: 'Rejected', icon: <XCircle size={11} /> },
}

const priorityConfig = {
  low: { color: 'var(--text-muted)', label: 'Low' },
  medium: { color: 'var(--amber)', label: 'Medium' },
  high: { color: 'var(--warm-red)', label: 'High' },
}

interface Props {
  proposal: Proposal
  onClose: () => void
}

export function ProposalDetailPanel({ proposal, onClose }: Props) {
  const { addTaskDraft, removeTaskDraft, updateTaskDraft, addDocumentDraft, removeDocumentDraft, submitProposal, approveProposal, rejectProposal, agents, loadAgents } = useAppStore()
  const [showAddTask, setShowAddTask] = React.useState(false)
  const [showAddDoc, setShowAddDoc] = React.useState(false)
  const [newTaskTitle, setNewTaskTitle] = React.useState('')
  const [newDocTitle, setNewDocTitle] = React.useState('')
  const [newDocType, setNewDocType] = React.useState<'prd' | 'tech_design' | 'adr' | 'spec' | 'guide' | 'report'>('spec')
  const [expandedDraft, setExpandedDraft] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)

  React.useEffect(() => {
    if (agents.length === 0) loadAgents()
  }, [agents.length])

  const status = statusConfig[proposal.status] || statusConfig.draft
  const isDraft = proposal.status === 'draft'
  const isPending = proposal.status === 'pending'

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    await addTaskDraft(proposal.id, { title: newTaskTitle.trim(), priority: 'medium' })
    setNewTaskTitle('')
    setShowAddTask(false)
  }

  const handleAddDocument = async () => {
    if (!newDocTitle.trim()) return
    await addDocumentDraft(proposal.id, { type: newDocType, title: newDocTitle.trim(), content: '' })
    setNewDocTitle('')
    setShowAddDoc(false)
  }

  const handleSubmit = async () => {
    setIsProcessing(true)
    try {
      await submitProposal(proposal.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await approveProposal(proposal.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await rejectProposal(proposal.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const getDraftDependencies = (draft: TaskDraft): TaskDraft[] => {
    if (!draft.dependsOnTempIds) return []
    return draft.dependsOnTempIds
      .map(id => proposal.taskDrafts.find(d => d.tempId === id))
      .filter(Boolean) as TaskDraft[]
  }

  return (
    <div style={{
      width: 380,
      height: '100%',
      backgroundColor: 'var(--surface-1)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: `2px solid ${status.color}`,
        backgroundColor: 'var(--surface-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: 0,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: status.color,
          }}>
            {status.icon}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Proposal</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} style={{ width: 22, height: 22, borderRadius: 0 }}>
          <X size={14} />
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {/* Title & Status */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{proposal.title}</h2>
          {proposal.description && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>{proposal.description}</p>
          )}
          <span style={{
            padding: '2px 8px',
            borderRadius: 0,
            backgroundColor: 'var(--surface-0)',
            color: status.color,
            fontSize: 10,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'IBM Plex Mono, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: '1px solid var(--border-subtle)',
          }}>
            {status.icon}
            {status.label}
          </span>
        </div>

        {/* Task Drafts */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'IBM Plex Mono, monospace' }}>
              Task Drafts ({proposal.taskDrafts.length})
            </label>
            {isDraft && (
              <Button size="icon" variant="ghost" onClick={() => setShowAddTask(!showAddTask)} style={{ width: 18, height: 18, borderRadius: 0 }}>
                <Plus size={12} />
              </Button>
            )}
          </div>

          {showAddTask && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <Input
                placeholder="Task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                style={{ flex: 1, height: 28, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}
              />
              <Button size="icon" variant="ghost" onClick={handleAddTask} style={{ width: 28, height: 28, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000' }}>
                <Plus size={12} />
              </Button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {proposal.taskDrafts.map((draft, index) => {
              const isExpanded = expandedDraft === draft.tempId
              const deps = getDraftDependencies(draft)
              const pCfg = priorityConfig[draft.priority || 'medium']

              return (
                <div key={draft.tempId} style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-0)',
                  borderRadius: 0,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isDraft ? 'pointer' : 'default' }}
                    onClick={() => isDraft && setExpandedDraft(isExpanded ? null : draft.tempId)}
                  >
                    <span style={{ fontSize: 9, color: 'var(--text-faint)', minWidth: 16, fontFamily: 'IBM Plex Mono, monospace' }}>{index + 1}</span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: pCfg.color,
                      backgroundColor: 'var(--surface-1)',
                      padding: '1px 4px',
                      borderRadius: 0,
                      fontFamily: 'IBM Plex Mono, monospace',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      {pCfg.label.charAt(0)}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {draft.title}
                    </span>
                    {draft.agent && (
                      <img
                        src={pixelAvatarToDataUrl(draft.agent, 14)}
                        alt={draft.agent}
                        style={{ width: 14, height: 14, borderRadius: 0 }}
                        title={draft.agent}
                      />
                    )}
                    {deps.length > 0 && (
                      <span style={{ fontSize: 9, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'IBM Plex Mono, monospace' }}>
                        <Link2 size={8} />{deps.length}
                      </span>
                    )}
                    {isDraft && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTaskDraft(proposal.id, draft.tempId) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.3 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                      >
                        <Trash2 size={10} color="var(--text-muted)" />
                      </button>
                    )}
                    {isDraft && (isExpanded ? <ChevronUp size={10} color="var(--text-muted)" /> : <ChevronDown size={10} color="var(--text-muted)" />)}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && isDraft && (
                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                      {/* Agent selector */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Agent</label>
                        <select
                          value={draft.agent || ''}
                          onChange={(e) => updateTaskDraft(proposal.id, draft.tempId, { agent: e.target.value || undefined })}
                          style={{ width: '100%', height: 26, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, color: 'var(--text-primary)', padding: '0 6px', fontFamily: 'IBM Plex Mono, monospace' }}
                        >
                          <option value="">Auto</option>
                          {agents.map(a => (
                            <option key={a.name} value={a.name}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Priority */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Priority</label>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {(['low', 'medium', 'high'] as const).map(p => (
                            <button
                              key={p}
                              onClick={() => updateTaskDraft(proposal.id, draft.tempId, { priority: p })}
                              style={{
                                flex: 1,
                                height: 24,
                                fontSize: 10,
                                backgroundColor: draft.priority === p ? 'var(--surface-2)' : 'var(--surface-0)',
                                border: `1px solid ${draft.priority === p ? priorityConfig[p].color : 'var(--border-subtle)'}`,
                                borderRadius: 0,
                                color: draft.priority === p ? priorityConfig[p].color : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontFamily: 'IBM Plex Mono, monospace',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              {priorityConfig[p].label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dependencies */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Depends on</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {proposal.taskDrafts
                            .filter(d => d.tempId !== draft.tempId)
                            .map(d => {
                              const isDep = draft.dependsOnTempIds?.includes(d.tempId)
                              return (
                                <label key={d.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isDep ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={isDep}
                                    onChange={(e) => {
                                      const current = draft.dependsOnTempIds || []
                                      const next = e.target.checked
                                        ? [...current, d.tempId]
                                        : current.filter(id => id !== d.tempId)
                                      updateTaskDraft(proposal.id, draft.tempId, { dependsOnTempIds: next })
                                    }}
                                    style={{ width: 12, height: 12 }}
                                  />
                                  {d.title}
                                </label>
                              )
                            })}
                        </div>
                      </div>

                      {/* Acceptance Criteria */}
                      <div>
                        <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Acceptance Criteria</label>
                        {(draft.acceptanceCriteria || []).map((ac, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>{ac}</span>
                            <button
                              onClick={() => {
                                const next = (draft.acceptanceCriteria || []).filter((_, j) => j !== i)
                                updateTaskDraft(proposal.id, draft.tempId, { acceptanceCriteria: next })
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                            >
                              <X size={10} color="var(--text-muted)" />
                            </button>
                          </div>
                        ))}
                        <AddCriterionInput onAdd={(text) => {
                          const next = [...(draft.acceptanceCriteria || []), text]
                          updateTaskDraft(proposal.id, draft.tempId, { acceptanceCriteria: next })
                        }} />
                      </div>

                      {/* Related Documents */}
                      {proposal.documentDrafts.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Related Documents</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {proposal.documentDrafts.map(doc => {
                              const isLinked = draft.relatedDocumentTempIds?.includes(doc.tempId)
                              const docColor = { prd: '#3b82f6', tech_design: '#7b68c0', adr: 'var(--amber)', spec: '#5cb85c', guide: 'var(--copper)', report: 'var(--warm-red)' }[doc.type] || 'var(--text-muted)'
                              return (
                                <label key={doc.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isLinked ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={isLinked}
                                    onChange={(e) => {
                                      const current = draft.relatedDocumentTempIds || []
                                      const next = e.target.checked
                                        ? [...current, doc.tempId]
                                        : current.filter(id => id !== doc.tempId)
                                      updateTaskDraft(proposal.id, draft.tempId, { relatedDocumentTempIds: next })
                                    }}
                                    style={{ width: 12, height: 12 }}
                                  />
                                  <span style={{ fontSize: 8, fontWeight: 700, color: docColor, backgroundColor: 'var(--surface-1)', padding: '1px 3px', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', border: '1px solid var(--border-subtle)' }}>
                                    {doc.type === 'tech_design' ? 'TECH' : doc.type.toUpperCase()}
                                  </span>
                                  {doc.title}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Document Drafts */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'IBM Plex Mono, monospace' }}>
              Document Drafts ({proposal.documentDrafts.length})
            </label>
            {isDraft && (
              <Button size="icon" variant="ghost" onClick={() => setShowAddDoc(!showAddDoc)} style={{ width: 18, height: 18, borderRadius: 0 }}>
                <Plus size={12} />
              </Button>
            )}
          </div>

          {showAddDoc && (
            <div style={{ marginBottom: 8, padding: 8, backgroundColor: 'var(--surface-0)', borderRadius: 0, border: '1px solid var(--border-subtle)' }}>
              <Input
                placeholder="Document title..."
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                style={{ width: '100%', height: 26, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, marginBottom: 6, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}
              />
              <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                {(['prd', 'tech_design', 'adr', 'spec', 'guide', 'report'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setNewDocType(t)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 9,
                      borderRadius: 0,
                      backgroundColor: newDocType === t ? 'var(--surface-2)' : 'var(--surface-0)',
                      border: `1px solid ${newDocType === t ? 'var(--amber)' : 'var(--border-subtle)'}`,
                      color: newDocType === t ? 'var(--amber)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {t === 'tech_design' ? 'Tech' : t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button size="icon" variant="ghost" onClick={handleAddDocument} style={{ width: 24, height: 24, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000' }}>
                  <Plus size={10} />
                </Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {proposal.documentDrafts.map((doc) => {
              const typeColors: Record<string, string> = {
                prd: '#3b82f6', tech_design: '#7b68c0', adr: 'var(--amber)',
                spec: '#5cb85c', guide: 'var(--copper)', report: 'var(--warm-red)',
              }
              const color = typeColors[doc.type] || 'var(--text-muted)'
              return (
                <div key={doc.tempId} style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-0)',
                  borderRadius: 0,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color,
                      backgroundColor: 'var(--surface-1)',
                      padding: '1px 4px',
                      borderRadius: 0,
                      fontFamily: 'IBM Plex Mono, monospace',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      {doc.type === 'tech_design' ? 'TECH' : doc.type.toUpperCase()}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.title}
                    </span>
                    {isDraft && (
                      <button
                        onClick={() => removeDocumentDraft(proposal.id, doc.tempId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.3 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                      >
                        <Trash2 size={10} color="var(--text-muted)" />
                      </button>
                    )}
                  </div>
                  {doc.content && (
                    <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {doc.content}
                    </p>
                  )}
                  {/* Related Tasks */}
                  {isDraft && proposal.taskDrafts.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                      <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Related Tasks</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {proposal.taskDrafts.map(td => {
                          const isLinked = doc.relatedTaskTempIds?.includes(td.tempId)
                          return (
                            <label key={td.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isLinked ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isLinked}
                                onChange={(e) => {
                                  const current = doc.relatedTaskTempIds || []
                                  const next = e.target.checked
                                    ? [...current, td.tempId]
                                    : current.filter(id => id !== td.tempId)
                                  // Update via store
                                  useAppStore.getState().sendToBackend('proposals:update_document_draft', {
                                    proposalId: proposal.id,
                                    tempId: doc.tempId,
                                    updates: { relatedTaskTempIds: next },
                                  }).then(() => useAppStore.getState().loadProposals())
                                }}
                                style={{ width: 12, height: 12 }}
                              />
                              {td.title}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isDraft && proposal.taskDrafts.length > 0 && (
            <ActionButton
              onClick={handleSubmit}
              disabled={isProcessing}
              color="var(--amber)"
              icon={<ArrowRight size={13} />}
              label="Submit for Review"
            />
          )}
          {isPending && (
            <>
              <ActionButton
                onClick={handleApprove}
                disabled={isProcessing}
                color="#5cb85c"
                icon={<CheckCircle size={13} />}
                label="Approve & Create Tasks"
              />
              <ActionButton
                onClick={handleReject}
                disabled={isProcessing}
                color="var(--warm-red)"
                icon={<XCircle size={13} />}
                label="Reject"
              />
            </>
          )}
          {proposal.status === 'rejected' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>
              Revise the proposal and resubmit.
            </div>
          )}
          {proposal.status === 'approved' && (() => {
            // Find tasks created from this proposal (matched by title from taskDrafts)
            const draftTitles = new Set(proposal.taskDrafts.map(d => d.title))
            const relatedTasks = useAppStore.getState().tasks.filter(t => draftTitles.has(t.title))
            if (relatedTasks.length > 0) {
              return (
                <WorkflowProgressView
                  title="Workflow Progress"
                  steps={relatedTasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    dependsOn: t.dependsOn,
                    assignee: t.assignee,
                  }))}
                />
              )
            }
            return (
              <div style={{ fontSize: 11, color: '#5cb85c', padding: '8px 0' }}>
                Tasks have been created. Check the Kanban view.
              </div>
            )
          })()}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        color: 'var(--text-faint)',
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        <span>Created {formatDistanceToNow(proposal.createdAt, { addSuffix: true })}</span>
        <span>{proposal.taskDrafts.length} tasks</span>
      </div>
    </div>
  )
}

function ActionButton({ onClick, disabled, color, icon, label }: {
  onClick: () => void
  disabled: boolean
  color: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 0,
        backgroundColor: 'var(--surface-0)',
        border: `1px solid ${color}`,
        color: disabled ? 'var(--text-faint)' : color,
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: '100%',
        transition: 'background-color 0.15s',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = 'var(--surface-2)' }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = 'var(--surface-0)' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function AddCriterionInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = React.useState('')
  const handleAdd = () => {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
      <Input
        placeholder="Add criterion..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        style={{ flex: 1, height: 24, fontSize: 10, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}
      />
      <Button size="icon" variant="ghost" onClick={handleAdd} style={{ width: 24, height: 24, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000' }}>
        <Plus size={10} />
      </Button>
    </div>
  )
}

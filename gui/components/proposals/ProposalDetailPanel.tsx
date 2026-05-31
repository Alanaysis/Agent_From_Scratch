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
  draft: { color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)', label: 'Draft', icon: <FileText size={11} /> },
  pending: { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: 'Pending', icon: <Clock size={11} /> },
  approved: { color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)', label: 'Approved', icon: <CheckCircle size={11} /> },
  rejected: { color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: 'Rejected', icon: <XCircle size={11} /> },
}

const priorityConfig = {
  low: { color: '#666', label: 'Low' },
  medium: { color: '#f59e0b', label: 'Medium' },
  high: { color: '#ef4444', label: 'High' },
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
      backgroundColor: '#111',
      borderLeft: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: `linear-gradient(180deg, ${status.color}08 0%, transparent 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            backgroundColor: status.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: status.color,
          }}>
            {status.icon}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Proposal</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} style={{ width: 24, height: 24 }}>
          <X size={14} />
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Title & Status */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{proposal.title}</h2>
          {proposal.description && (
            <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 8 }}>{proposal.description}</p>
          )}
          <span style={{
            padding: '3px 8px',
            borderRadius: 5,
            backgroundColor: status.bgColor,
            color: status.color,
            fontSize: 11,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {status.icon}
            {status.label}
          </span>
        </div>

        {/* Task Drafts */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Task Drafts ({proposal.taskDrafts.length})
            </label>
            {isDraft && (
              <Button size="icon" variant="ghost" onClick={() => setShowAddTask(!showAddTask)} style={{ width: 20, height: 20 }}>
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
                style={{ flex: 1, height: 30, fontSize: 11, backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6 }}
              />
              <Button size="icon" variant="ghost" onClick={handleAddTask} style={{ width: 30, height: 30 }}>
                <Plus size={12} />
              </Button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {proposal.taskDrafts.map((draft, index) => {
              const isExpanded = expandedDraft === draft.tempId
              const deps = getDraftDependencies(draft)
              const pCfg = priorityConfig[draft.priority || 'medium']

              return (
                <div key={draft.tempId} style={{
                  padding: '8px 10px',
                  backgroundColor: '#0d0d0d',
                  borderRadius: 6,
                  border: '1px solid #1a1a1a',
                  cursor: isDraft ? 'pointer' : 'default',
                }}
                  onClick={() => isDraft && setExpandedDraft(isExpanded ? null : draft.tempId)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: '#444', minWidth: 16 }}>{index + 1}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: pCfg.color,
                      backgroundColor: pCfg.color + '15',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}>
                      {pCfg.label.charAt(0)}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {draft.title}
                    </span>
                    {draft.agent && (
                      <img
                        src={pixelAvatarToDataUrl(draft.agent, 14)}
                        alt={draft.agent}
                        style={{ width: 14, height: 14, borderRadius: 3 }}
                        title={draft.agent}
                      />
                    )}
                    {deps.length > 0 && (
                      <span style={{ fontSize: 9, color: '#555', display: 'flex', alignItems: 'center', gap: 2 }}>
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
                        <Trash2 size={10} color="#888" />
                      </button>
                    )}
                    {isDraft && (isExpanded ? <ChevronUp size={10} color="#666" /> : <ChevronDown size={10} color="#666" />)}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && isDraft && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1a1a1a' }}>
                      {/* Agent selector */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 3 }}>Agent</label>
                        <select
                          value={draft.agent || ''}
                          onChange={(e) => updateTaskDraft(proposal.id, draft.tempId, { agent: e.target.value || undefined })}
                          style={{ width: '100%', height: 26, fontSize: 11, backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, color: '#fff', padding: '0 6px' }}
                        >
                          <option value="">Auto</option>
                          {agents.map(a => (
                            <option key={a.name} value={a.name}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Priority */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 3 }}>Priority</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['low', 'medium', 'high'] as const).map(p => (
                            <button
                              key={p}
                              onClick={() => updateTaskDraft(proposal.id, draft.tempId, { priority: p })}
                              style={{
                                flex: 1,
                                height: 24,
                                fontSize: 10,
                                backgroundColor: draft.priority === p ? priorityConfig[p].color + '20' : '#0a0a0a',
                                border: `1px solid ${draft.priority === p ? priorityConfig[p].color + '66' : '#1a1a1a'}`,
                                borderRadius: 4,
                                color: draft.priority === p ? priorityConfig[p].color : '#666',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              {priorityConfig[p].label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dependencies */}
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 3 }}>Depends on</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {proposal.taskDrafts
                            .filter(d => d.tempId !== draft.tempId)
                            .map(d => {
                              const isDep = draft.dependsOnTempIds?.includes(d.tempId)
                              return (
                                <label key={d.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isDep ? '#fff' : '#666', cursor: 'pointer' }}>
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
                        <label style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 3 }}>Acceptance Criteria</label>
                        {(draft.acceptanceCriteria || []).map((ac, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, color: '#888', flex: 1 }}>{ac}</span>
                            <button
                              onClick={() => {
                                const next = (draft.acceptanceCriteria || []).filter((_, j) => j !== i)
                                updateTaskDraft(proposal.id, draft.tempId, { acceptanceCriteria: next })
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                            >
                              <X size={10} color="#666" />
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
                          <label style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 3 }}>Related Documents</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {proposal.documentDrafts.map(doc => {
                              const isLinked = draft.relatedDocumentTempIds?.includes(doc.tempId)
                              const docColor = { prd: '#3b82f6', tech_design: '#8b5cf6', adr: '#f59e0b', spec: '#22c55e', guide: '#06b6d4', report: '#ef4444' }[doc.type] || '#666'
                              return (
                                <label key={doc.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isLinked ? '#fff' : '#666', cursor: 'pointer' }}>
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
                                  <span style={{ fontSize: 8, fontWeight: 700, color: docColor, backgroundColor: docColor + '15', padding: '1px 3px', borderRadius: 2 }}>
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
            <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Document Drafts ({proposal.documentDrafts.length})
            </label>
            {isDraft && (
              <Button size="icon" variant="ghost" onClick={() => setShowAddDoc(!showAddDoc)} style={{ width: 20, height: 20 }}>
                <Plus size={12} />
              </Button>
            )}
          </div>

          {showAddDoc && (
            <div style={{ marginBottom: 8, padding: 8, backgroundColor: '#0d0d0d', borderRadius: 6, border: '1px solid #1a1a1a' }}>
              <Input
                placeholder="Document title..."
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                style={{ width: '100%', height: 28, fontSize: 11, backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 6 }}
              />
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {(['prd', 'tech_design', 'adr', 'spec', 'guide', 'report'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setNewDocType(t)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 9,
                      borderRadius: 3,
                      backgroundColor: newDocType === t ? '#3b82f6' + '20' : '#0a0a0a',
                      border: `1px solid ${newDocType === t ? '#3b82f6' + '66' : '#1a1a1a'}`,
                      color: newDocType === t ? '#3b82f6' : '#666',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {t === 'tech_design' ? 'Tech' : t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button size="icon" variant="ghost" onClick={handleAddDocument} style={{ width: 24, height: 24 }}>
                  <Plus size={10} />
                </Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {proposal.documentDrafts.map((doc) => {
              const typeColors: Record<string, string> = {
                prd: '#3b82f6', tech_design: '#8b5cf6', adr: '#f59e0b',
                spec: '#22c55e', guide: '#06b6d4', report: '#ef4444',
              }
              const color = typeColors[doc.type] || '#666'
              return (
                <div key={doc.tempId} style={{
                  padding: '8px 10px',
                  backgroundColor: '#0d0d0d',
                  borderRadius: 6,
                  border: '1px solid #1a1a1a',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color,
                      backgroundColor: color + '15',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}>
                      {doc.type === 'tech_design' ? 'TECH' : doc.type.toUpperCase()}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.title}
                    </span>
                    {isDraft && (
                      <button
                        onClick={() => removeDocumentDraft(proposal.id, doc.tempId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.3 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                      >
                        <Trash2 size={10} color="#888" />
                      </button>
                    )}
                  </div>
                  {doc.content && (
                    <p style={{ fontSize: 10, color: '#555', marginTop: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {doc.content}
                    </p>
                  )}
                  {/* Related Tasks */}
                  {isDraft && proposal.taskDrafts.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #1a1a1a' }}>
                      <label style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 3 }}>Related Tasks</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {proposal.taskDrafts.map(td => {
                          const isLinked = doc.relatedTaskTempIds?.includes(td.tempId)
                          return (
                            <label key={td.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isLinked ? '#fff' : '#666', cursor: 'pointer' }}>
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
              color="#f59e0b"
              icon={<ArrowRight size={13} />}
              label="Submit for Review"
            />
          )}
          {isPending && (
            <>
              <ActionButton
                onClick={handleApprove}
                disabled={isProcessing}
                color="#22c55e"
                icon={<CheckCircle size={13} />}
                label="Approve & Create Tasks"
              />
              <ActionButton
                onClick={handleReject}
                disabled={isProcessing}
                color="#ef4444"
                icon={<XCircle size={13} />}
                label="Reject"
              />
            </>
          )}
          {proposal.status === 'rejected' && (
            <div style={{ fontSize: 11, color: '#888', padding: '8px 0' }}>
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
              <div style={{ fontSize: 11, color: '#22c55e', padding: '8px 0' }}>
                Tasks have been created. Check the Kanban view.
              </div>
            )
          })()}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #1a1a1a',
        fontSize: 10,
        color: '#444',
        display: 'flex',
        justifyContent: 'space-between',
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
        borderRadius: 6,
        backgroundColor: color + '10',
        border: `1px solid ${color + '25'}`,
        color: disabled ? '#444' : color,
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = color + '20' }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = color + '10' }}
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
        style={{ flex: 1, height: 24, fontSize: 10, backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4 }}
      />
      <Button size="icon" variant="ghost" onClick={handleAdd} style={{ width: 24, height: 24 }}>
        <Plus size={10} />
      </Button>
    </div>
  )
}

'use client'

import * as React from 'react'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, FileText, Save, Send, GripVertical } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pixelAvatarToDataUrl } from '@/lib/pixelAvatar'
import type { TaskDraft, DocumentDraft, Proposal } from '@/types'

// ====== Templates ======

interface ProposalTemplate {
  id: string
  name: string
  description: string
  icon: string
  taskDrafts: Omit<TaskDraft, 'tempId'>[]
  documentDrafts: Omit<DocumentDraft, 'tempId'>[]
}

const TEMPLATES: ProposalTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from scratch',
    icon: '📝',
    taskDrafts: [],
    documentDrafts: [],
  },
  {
    id: 'grpc-workflow',
    name: 'gRPC Workflow',
    description: 'Init → Execute → Collect results via gRPC',
    icon: '⚡',
    taskDrafts: [
      { title: 'Initialize connection', agent: 'grpc-worker', priority: 'medium', description: 'Check gRPC service availability' },
      { title: 'Execute operation', agent: 'grpc-worker', priority: 'high', description: 'Execute the main gRPC call', dependsOnTempIds: [] },
      { title: 'Collect results', agent: 'grpc-worker', priority: 'medium', description: 'Retrieve and process results', dependsOnTempIds: [] },
    ],
    documentDrafts: [],
  },
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    description: 'Extract → Transform → Load',
    icon: '🔄',
    taskDrafts: [
      { title: 'Extract data', agent: 'general-purpose', priority: 'high', description: 'Extract data from source' },
      { title: 'Transform data', agent: 'general-purpose', priority: 'high', description: 'Clean and transform data', dependsOnTempIds: [] },
      { title: 'Load data', agent: 'general-purpose', priority: 'medium', description: 'Load data into target', dependsOnTempIds: [] },
    ],
    documentDrafts: [],
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Review → Fix issues',
    icon: '🔍',
    taskDrafts: [
      { title: 'Code review', agent: 'general-purpose', priority: 'high', description: 'Review codebase for issues' },
      { title: 'Fix issues', agent: 'general-purpose', priority: 'high', description: 'Fix identified issues', dependsOnTempIds: [] },
    ],
    documentDrafts: [
      { type: 'report', title: 'Review Report', content: '' },
    ],
  },
  {
    id: 'feature-dev',
    name: 'Feature Development',
    description: 'Design → Implement → Test → Document',
    icon: '🚀',
    taskDrafts: [
      { title: 'Design architecture', agent: 'general-purpose', priority: 'high', description: 'Design the feature architecture and plan' },
      { title: 'Implement feature', agent: 'general-purpose', priority: 'high', description: 'Write the implementation', dependsOnTempIds: [] },
      { title: 'Write tests', agent: 'general-purpose', priority: 'medium', description: 'Write unit and integration tests', dependsOnTempIds: [] },
      { title: 'Write documentation', agent: 'general-purpose', priority: 'low', description: 'Update docs and README', dependsOnTempIds: [] },
    ],
    documentDrafts: [
      { type: 'tech_design', title: 'Technical Design', content: '' },
    ],
  },
]

// ====== Component ======

export function ProposalEditor() {
  const { agents, loadAgents, createProposal, loadProposals, setViewMode, proposals, editingProposalId } = useAppStore()
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>('blank')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [taskDrafts, setTaskDrafts] = React.useState<TaskDraft[]>([])
  const [documentDrafts, setDocumentDrafts] = React.useState<DocumentDraft[]>([])
  const [expandedTask, setExpandedTask] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [showSaveDialog, setShowSaveDialog] = React.useState(false)
  const [saveFileName, setSaveFileName] = React.useState('')
  const [isDirty, setIsDirty] = React.useState(false)

  React.useEffect(() => {
    if (agents.length === 0) loadAgents()
  }, [agents.length])

  // Load existing proposal if editing (only once on mount)
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    if (editingProposalId && !loaded) {
      const existing = proposals.find(p => p.id === editingProposalId)
      if (existing) {
        setTitle(existing.title)
        setDescription(existing.description || '')
        setTaskDrafts(existing.taskDrafts)
        setDocumentDrafts(existing.documentDrafts)
        setLoaded(true)
      }
    }
  }, [editingProposalId, proposals, loaded])

  // Apply template
  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = TEMPLATES.find(t => t.id === templateId)
    if (!template) return

    // Build task drafts with proper dependency resolution
    const tempIdMap = new Map<number, string>()
    const newTaskDrafts: TaskDraft[] = template.taskDrafts.map((t, i) => {
      const tempId = `draft-${Date.now()}-${i}`
      tempIdMap.set(i, tempId)
      return { ...t, tempId }
    })

    // Resolve dependsOnTempIds (template uses empty strings as placeholders)
    for (let i = 0; i < newTaskDrafts.length; i++) {
      const draft = newTaskDrafts[i]!
      if (draft.dependsOnTempIds !== undefined) {
        // Each task depends on the previous one (chain)
        draft.dependsOnTempIds = i > 0 ? [tempIdMap.get(i - 1)!] : []
      }
    }

    const newDocDrafts: DocumentDraft[] = template.documentDrafts.map((d, i) => ({
      ...d,
      tempId: `doc-${Date.now()}-${i}`,
    }))

    setTaskDrafts(newTaskDrafts)
    setDocumentDrafts(newDocDrafts)
  }

  // Task draft operations
  const markDirty = () => setIsDirty(true)

  const addTaskDraft = () => {
    setTaskDrafts([...taskDrafts, {
      tempId: `draft-${Date.now()}-${taskDrafts.length}`,
      title: '',
      priority: 'medium',
    }])
    markDirty()
  }

  // Build description text from gRPC config
  const buildDescriptionFromGrpc = (grpcConfig: TaskDraft['grpcConfig'], existingDescription?: string): string => {
    if (!grpcConfig) return existingDescription || ''

    // Extract non-gRPC description (user-written text before the gRPC block)
    let userDesc = existingDescription || ''
    const grpcBlockStart = userDesc.indexOf('gRPC Call:')
    if (grpcBlockStart >= 0) {
      userDesc = userDesc.substring(0, grpcBlockStart).trim()
    }

    // Build gRPC instruction block
    const parts = [`gRPC Call: ${grpcConfig.service}.${grpcConfig.method}`]
    if (grpcConfig.address) parts.push(`Address: ${grpcConfig.address}`)
    if (grpcConfig.protoFile) parts.push(`Proto: ${grpcConfig.protoFile}`)
    parts.push(`Payload: ${JSON.stringify(grpcConfig.payload)}`)
    if (grpcConfig.metadata) parts.push(`Metadata: ${JSON.stringify(grpcConfig.metadata)}`)
    if (grpcConfig.deadline) parts.push(`Deadline: ${grpcConfig.deadline}ms`)

    const grpcBlock = parts.join('\n')
    return userDesc ? `${userDesc}\n\n${grpcBlock}` : grpcBlock
  }

  const updateTaskDraft = (tempId: string, updates: Partial<TaskDraft>) => {
    setTaskDrafts(prev => prev.map(d => {
      if (d.tempId !== tempId) return d

      const newDraft = { ...d, ...updates }

      // If gRPC config changed, sync description
      if (updates.grpcConfig && d.grpcConfig) {
        newDraft.description = buildDescriptionFromGrpc(updates.grpcConfig, d.description)
      }

      return newDraft
    }))
    markDirty()
  }

  const removeTaskDraft = (tempId: string) => {
    setTaskDrafts(prev => prev
      .filter(d => d.tempId !== tempId)
      .map(d => ({
        ...d,
        dependsOnTempIds: d.dependsOnTempIds?.filter(id => id !== tempId),
      }))
    )
    markDirty()
  }

  // Document draft operations
  const addDocumentDraft = () => {
    setDocumentDrafts([...documentDrafts, {
      tempId: `doc-${Date.now()}-${documentDrafts.length}`,
      type: 'spec',
      title: '',
      content: '',
    }])
    markDirty()
  }

  const updateDocumentDraft = (tempId: string, updates: Partial<DocumentDraft>) => {
    setDocumentDrafts(documentDrafts.map(d => d.tempId === tempId ? { ...d, ...updates } : d))
    markDirty()
  }

  const removeDocumentDraft = (tempId: string) => {
    setDocumentDrafts(documentDrafts.filter(d => d.tempId !== tempId))
    markDirty()
  }

  // Save proposal
  const handleSave = async (submitAfterSave = false) => {
    if (!title.trim()) return
    setIsSaving(true)
    try {
      let proposalId = editingProposalId

      if (proposalId) {
        // Update existing proposal
        await useAppStore.getState().updateProposal(proposalId, {
          title: title.trim(),
          description: description.trim() || undefined,
        })
      } else {
        // Create new proposal
        const proposal = await createProposal({ title: title.trim(), description: description.trim() || undefined })
        if (proposal) {
          proposalId = proposal.id
          useAppStore.getState().editingProposalId = proposalId
        }
      }

      if (proposalId) {
        // Clear existing task drafts and re-add all
        const existingProposal = useAppStore.getState().proposals.find(p => p.id === proposalId)
        if (existingProposal) {
          for (const draft of existingProposal.taskDrafts) {
            await useAppStore.getState().removeTaskDraft(proposalId, draft.tempId)
          }
        }
        // Add all task drafts
        for (const draft of taskDrafts) {
          await useAppStore.getState().addTaskDraft(proposalId, {
            tempId: draft.tempId,
            title: draft.title,
            description: draft.description,
            agent: draft.agent,
            priority: draft.priority,
            dependsOnTempIds: draft.dependsOnTempIds,
            acceptanceCriteria: draft.acceptanceCriteria,
            grpcConfig: draft.grpcConfig,
            requiresApproval: draft.requiresApproval,
            approvalMessage: draft.approvalMessage,
            checkpointAfter: draft.checkpointAfter,
            checkpointMessage: draft.checkpointMessage,
          })
        }
        // Add all document drafts
        for (const draft of documentDrafts) {
          await useAppStore.getState().addDocumentDraft(proposalId, {
            type: draft.type,
            title: draft.title,
            content: draft.content,
          })
        }
        if (submitAfterSave) {
          await useAppStore.getState().submitProposal(proposalId)
          await loadProposals()
          setViewMode('proposals')
        } else {
          await loadProposals()
          setIsDirty(false)
          // Show success notification
          useAppStore.getState().addNotification({
            type: 'success',
            title: 'Draft Saved',
            message: `Proposal "${title.trim()}" saved successfully`,
          })
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Save as YAML file
  const handleSaveYaml = async () => {
    setIsSaving(true)
    try {
      const proposal = {
        title: title.trim(),
        description: description.trim() || undefined,
        taskDrafts,
      }

      let fileName = saveFileName || `${title.trim()}.yaml`

      // Call API to save YAML
      const result = await useAppStore.getState().sendToBackend('workflows:save-yaml', {
        proposal,
        fileName,
      }) as { filePath: string; fileName: string }

      if (result?.filePath) {
        // Also save as proposal draft
        await handleSave(false)
        alert(`YAML saved to: workflows/${result.fileName}`)
      }
    } catch (e) {
      console.error('[ProposalEditor] Save YAML error:', e)
      alert('Failed to save YAML')
    } finally {
      setIsSaving(false)
      setShowSaveDialog(false)
    }
  }

  const handleBack = () => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Are you sure you want to leave?')) return
    }
    useAppStore.getState().editingProposalId = null
    setViewMode('proposals')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--surface-0)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans, sans-serif', minWidth: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'var(--surface-1)' }}>
        <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}>
          {editingProposalId ? 'Edit Proposal' : 'New Proposal'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button
            data-testid="save-draft"
            variant="ghost"
            onClick={() => handleSave(false)}
            disabled={!title.trim() || isSaving}
            style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 0 }}
          >
            <Save size={12} style={{ marginRight: 4 }} />
            Save Draft
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const sanitized = title.trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
              setSaveFileName(`${sanitized}.yaml`)
              setShowSaveDialog(true)
            }}
            disabled={!title.trim() || isSaving}
            style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 0 }}
          >
            <Save size={12} style={{ marginRight: 4 }} />
            Save YAML
          </Button>
          <Button
            data-testid="submit-proposal"
            onClick={() => handleSave(true)}
            disabled={!title.trim() || taskDrafts.length === 0 || isSaving}
            style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--amber)', color: '#0c0c0c', borderRadius: 0 }}
          >
            <Send size={12} style={{ marginRight: 4 }} />
            Submit
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Template Selector */}
        <div>
          <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block', fontFamily: 'IBM Plex Mono, monospace' }}>
            Template
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: selectedTemplate === t.id ? 'rgba(212,165,116,0.1)' : 'var(--surface-1)',
                  border: `1px solid ${selectedTemplate === t.id ? 'var(--amber)' : 'var(--border-subtle)'}`,
                  borderRadius: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  minWidth: 120,
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 2 }}>{t.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: selectedTemplate === t.id ? 'var(--amber)' : 'var(--text-primary)' }}>{t.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title + Description */}
        <div>
          <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block', fontFamily: 'IBM Plex Mono, monospace' }}>
            Title
          </label>
          <Input
            data-testid="proposal-title-input"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty() }}
            placeholder="Proposal title..."
            style={{ height: 38, fontSize: 14, fontWeight: 600, backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 0 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block', fontFamily: 'IBM Plex Mono, monospace' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty() }}
            placeholder="Describe the proposal..."
            style={{
              width: '100%', height: 80, fontSize: 12, backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)', borderRadius: 0, padding: 10,
              color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans, sans-serif', resize: 'vertical',
            }}
          />
        </div>

        {/* Task Drafts */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'IBM Plex Mono, monospace' }}>
              Task Drafts ({taskDrafts.length})
            </label>
            <button
              onClick={addTaskDraft}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                fontSize: 10, color: 'var(--amber)', backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)', borderRadius: 0, cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              <Plus size={10} /> Add Task
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {taskDrafts.map((draft, index) => {
              const isExpanded = expandedTask === draft.tempId
              const depNames = (draft.dependsOnTempIds || [])
                .map(id => taskDrafts.find(d => d.tempId === id)?.title)
                .filter(Boolean)

              return (
                <div key={draft.tempId} style={{
                  backgroundColor: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {/* Header row */}
                  <div
                    onClick={() => setExpandedTask(isExpanded ? null : draft.tempId)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
                  >
                    <GripVertical size={12} color="var(--text-faint)" />
                    <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono, monospace', minWidth: 16 }}>{index + 1}</span>
                    <span style={{ flex: 1, fontSize: 12, color: draft.title ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                      {draft.title || 'Untitled task'}
                    </span>
                    {draft.agent && (
                      <img src={pixelAvatarToDataUrl(draft.agent, 16)} alt={draft.agent} style={{ width: 16, height: 16, borderRadius: 0 }} />
                    )}
                    {depNames.length > 0 && (
                      <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'IBM Plex Mono, monospace' }}>
                        depends on: {depNames.join(', ')}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTaskDraft(draft.tempId) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 2 }}
                    >
                      <Trash2 size={11} />
                    </button>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div onClick={(e) => e.stopPropagation()} style={{ padding: '8px 10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Input
                        value={draft.title}
                        onChange={(e) => updateTaskDraft(draft.tempId, { title: e.target.value })}
                        placeholder="Task title"
                        style={{ height: 30, fontSize: 12, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0 }}
                      />
                      <textarea
                        value={draft.description || ''}
                        onChange={(e) => updateTaskDraft(draft.tempId, { description: e.target.value })}
                        placeholder="Description..."
                        style={{ width: '100%', height: 50, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: 6, color: 'var(--text-primary)', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>Agent</label>
                          <select
                            value={draft.agent || ''}
                            onChange={(e) => updateTaskDraft(draft.tempId, { agent: e.target.value || undefined })}
                            style={{ width: '100%', height: 28, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, color: 'var(--text-primary)', padding: '0 6px' }}
                          >
                            <option value="">Auto</option>
                            {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>Priority</label>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {(['low', 'medium', 'high'] as const).map(p => {
                              const colors = { low: '#666', medium: 'var(--amber)', high: 'var(--warm-red)' }
                              return (
                                <button
                                  key={p}
                                  onClick={() => updateTaskDraft(draft.tempId, { priority: p })}
                                  style={{
                                    padding: '4px 8px', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
                                    backgroundColor: draft.priority === p ? colors[p] + '20' : 'var(--surface-0)',
                                    border: `1px solid ${draft.priority === p ? colors[p] + '66' : 'var(--border-subtle)'}`,
                                    color: draft.priority === p ? colors[p] : 'var(--text-faint)',
                                    cursor: 'pointer', borderRadius: 0, textTransform: 'uppercase',
                                  }}
                                >
                                  {p}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      {/* Dependencies */}
                      {taskDrafts.length > 1 && (
                        <div>
                          <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>Depends on</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {taskDrafts.filter(d => d.tempId !== draft.tempId).map(d => {
                              const isDep = draft.dependsOnTempIds?.includes(d.tempId) ?? false
                              return (
                                <label key={d.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isDep ? 'var(--text-primary)' : 'var(--text-faint)', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={isDep}
                                    onChange={(e) => {
                                      const current = draft.dependsOnTempIds || []
                                      const next = e.target.checked ? [...current, d.tempId] : current.filter(id => id !== d.tempId)
                                      updateTaskDraft(draft.tempId, { dependsOnTempIds: next })
                                    }}
                                    style={{ width: 12, height: 12 }}
                                  />
                                  {d.title || 'Untitled'}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {/* Checkpoint & Approval Settings */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace' }}>
                            <input
                              type="checkbox"
                              checked={draft.requiresApproval || false}
                              onChange={(e) => updateTaskDraft(draft.tempId, { requiresApproval: e.target.checked })}
                              style={{ width: 12, height: 12 }}
                            />
                            Requires approval before
                          </label>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace' }}>
                            <input
                              type="checkbox"
                              checked={draft.checkpointAfter || false}
                              onChange={(e) => updateTaskDraft(draft.tempId, { checkpointAfter: e.target.checked })}
                              style={{ width: 12, height: 12 }}
                            />
                            Checkpoint after
                          </label>
                        </div>
                      </div>
                      {(draft.requiresApproval || draft.checkpointAfter) && (
                        <Input
                          value={draft.approvalMessage || draft.checkpointMessage || ''}
                          onChange={(e) => {
                            if (draft.requiresApproval) {
                              updateTaskDraft(draft.tempId, { approvalMessage: e.target.value })
                            } else {
                              updateTaskDraft(draft.tempId, { checkpointMessage: e.target.value })
                            }
                          }}
                          placeholder={draft.requiresApproval ? "Approval message..." : "Checkpoint message..."}
                          style={{ height: 28, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0 }}
                        />
                      )}
                      {/* gRPC Config - Prominent Panel */}
                      {draft.grpcConfig && (
                        <div style={{
                          marginTop: 8,
                          padding: 12,
                          backgroundColor: 'rgba(212,165,116,0.06)',
                          border: '1px solid rgba(212,165,116,0.2)',
                          borderRadius: 2,
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 10,
                          }}>
                            <div style={{
                              width: 4,
                              height: 16,
                              backgroundColor: 'var(--amber)',
                              borderRadius: 1,
                            }} />
                            <label style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: 'var(--amber)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              fontFamily: 'IBM Plex Mono, monospace',
                            }}>
                              gRPC Configuration
                            </label>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Proto File */}
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
                                Proto File
                                <button
                                  onClick={() => {
                                    if (!confirm('Sync Proto File to all tasks?')) return
                                    const value = draft.grpcConfig!.protoFile
                                    taskDrafts.forEach(t => {
                                      if (t.tempId !== draft.tempId && t.grpcConfig) {
                                        updateTaskDraft(t.tempId, { grpcConfig: { ...t.grpcConfig, protoFile: value } })
                                      }
                                    })
                                  }}
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 8,
                                    color: 'var(--amber)',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--amber)',
                                    borderRadius: 0,
                                    padding: '1px 6px',
                                    cursor: 'pointer',
                                    fontFamily: 'IBM Plex Mono, monospace',
                                  }}
                                >
                                  同步全部
                                </button>
                              </label>
                              <Input
                                value={draft.grpcConfig.protoFile}
                                onChange={(e) => updateTaskDraft(draft.tempId, { grpcConfig: { ...draft.grpcConfig!, protoFile: e.target.value } })}
                                placeholder="protos/xxx.proto"
                                style={{ height: 28, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-medium)', borderRadius: 0 }}
                              />
                            </div>

                            {/* Address */}
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
                                Address
                                <button
                                  onClick={() => {
                                    if (!confirm('Sync Address to all tasks?')) return
                                    const value = draft.grpcConfig!.address
                                    taskDrafts.forEach(t => {
                                      if (t.tempId !== draft.tempId && t.grpcConfig) {
                                        updateTaskDraft(t.tempId, { grpcConfig: { ...t.grpcConfig, address: value } })
                                      }
                                    })
                                  }}
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 8,
                                    color: 'var(--amber)',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--amber)',
                                    borderRadius: 0,
                                    padding: '1px 6px',
                                    cursor: 'pointer',
                                    fontFamily: 'IBM Plex Mono, monospace',
                                  }}
                                >
                                  同步全部
                                </button>
                              </label>
                              <Input
                                value={draft.grpcConfig.address}
                                onChange={(e) => updateTaskDraft(draft.tempId, { grpcConfig: { ...draft.grpcConfig!, address: e.target.value } })}
                                placeholder="host:port"
                                style={{ height: 28, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-medium)', borderRadius: 0 }}
                              />
                            </div>

                            {/* Service */}
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
                                Service
                                <button
                                  onClick={() => {
                                    if (!confirm('Sync Service to all tasks?')) return
                                    const value = draft.grpcConfig!.service
                                    taskDrafts.forEach(t => {
                                      if (t.tempId !== draft.tempId && t.grpcConfig) {
                                        updateTaskDraft(t.tempId, { grpcConfig: { ...t.grpcConfig, service: value } })
                                      }
                                    })
                                  }}
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 8,
                                    color: 'var(--amber)',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--amber)',
                                    borderRadius: 0,
                                    padding: '1px 6px',
                                    cursor: 'pointer',
                                    fontFamily: 'IBM Plex Mono, monospace',
                                  }}
                                >
                                  同步全部
                                </button>
                              </label>
                              <Input
                                value={draft.grpcConfig.service}
                                onChange={(e) => updateTaskDraft(draft.tempId, { grpcConfig: { ...draft.grpcConfig!, service: e.target.value } })}
                                placeholder="package.ServiceName"
                                style={{ height: 28, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-medium)', borderRadius: 0 }}
                              />
                            </div>

                            {/* Method */}
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
                                Method
                                <button
                                  onClick={() => {
                                    if (!confirm('Sync Method to all tasks?')) return
                                    const value = draft.grpcConfig!.method
                                    taskDrafts.forEach(t => {
                                      if (t.tempId !== draft.tempId && t.grpcConfig) {
                                        updateTaskDraft(t.tempId, { grpcConfig: { ...t.grpcConfig, method: value } })
                                      }
                                    })
                                  }}
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 8,
                                    color: 'var(--amber)',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--amber)',
                                    borderRadius: 0,
                                    padding: '1px 6px',
                                    cursor: 'pointer',
                                    fontFamily: 'IBM Plex Mono, monospace',
                                  }}
                                >
                                  同步全部
                                </button>
                              </label>
                              <Input
                                value={draft.grpcConfig.method}
                                onChange={(e) => updateTaskDraft(draft.tempId, { grpcConfig: { ...draft.grpcConfig!, method: e.target.value } })}
                                placeholder="MethodName"
                                style={{ height: 28, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-medium)', borderRadius: 0 }}
                              />
                            </div>

                            {/* Payload Fields */}
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-faint)', display: 'block', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
                                Payload
                              </label>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-medium)' }}>
                                {Object.entries(draft.grpcConfig.payload).map(([key, value]) => (
                                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <label style={{ fontSize: 9, color: 'var(--text-muted)', width: 80, flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace' }}>{key}</label>
                                    {Array.isArray(value) ? (
                                      <Input
                                        value={JSON.stringify(value)}
                                        onChange={(e) => {
                                          try {
                                            const parsed = JSON.parse(e.target.value)
                                            updateTaskDraft(draft.tempId, { grpcConfig: { ...draft.grpcConfig!, payload: { ...draft.grpcConfig!.payload, [key]: parsed } } })
                                          } catch { /* ignore invalid JSON */ }
                                        }}
                                        placeholder="JSON array"
                                        style={{ flex: 1, height: 24, fontSize: 10, backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace' }}
                                      />
                                    ) : (
                                      <Input
                                        value={String(value ?? '')}
                                        onChange={(e) => updateTaskDraft(draft.tempId, { grpcConfig: { ...draft.grpcConfig!, payload: { ...draft.grpcConfig!.payload, [key]: e.target.value } } })}
                                        placeholder={key}
                                        style={{ flex: 1, height: 24, fontSize: 10, backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 0 }}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'IBM Plex Mono, monospace' }}>
              Document Drafts ({documentDrafts.length})
            </label>
            <button
              onClick={addDocumentDraft}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                fontSize: 10, color: 'var(--amber)', backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)', borderRadius: 0, cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              <Plus size={10} /> Add Document
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {documentDrafts.map((draft) => {
              const typeColors: Record<string, string> = { prd: '#3b82f6', tech_design: '#7b68c0', adr: 'var(--amber)', spec: '#5cb85c', guide: '#06b6d4', report: 'var(--warm-red)' }
              return (
                <div key={draft.tempId} style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 8, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: typeColors[draft.type] || 'var(--text-muted)', backgroundColor: 'var(--surface-2)', padding: '1px 4px', borderRadius: 0 }}>
                      {draft.type === 'tech_design' ? 'TECH' : draft.type.toUpperCase()}
                    </span>
                    <Input
                      value={draft.title}
                      onChange={(e) => updateDocumentDraft(draft.tempId, { title: e.target.value })}
                      placeholder="Document title"
                      style={{ flex: 1, height: 26, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0 }}
                    />
                    <select
                      value={draft.type}
                      onChange={(e) => updateDocumentDraft(draft.tempId, { type: e.target.value })}
                      style={{ height: 26, fontSize: 10, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, color: 'var(--text-primary)', padding: '0 4px' }}
                    >
                      {Object.entries(typeColors).map(([key]) => (
                        <option key={key} value={key}>{key === 'tech_design' ? 'Tech Design' : key.charAt(0).toUpperCase() + key.slice(1)}</option>
                      ))}
                    </select>
                    <button onClick={() => removeDocumentDraft(draft.tempId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 2 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Save YAML Dialog */}
      {showSaveDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--amber)',
            padding: 20,
            width: '100%',
            maxWidth: 400,
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--amber)',
              marginBottom: 16,
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
              Save to YAML
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                fontSize: 9,
                color: 'var(--text-faint)',
                display: 'block',
                marginBottom: 4,
                fontFamily: 'IBM Plex Mono, monospace',
              }}>
                File Name
              </label>
              <input
                value={saveFileName}
                onChange={(e) => setSaveFileName(e.target.value)}
                style={{
                  width: '100%',
                  height: 32,
                  fontSize: 12,
                  backgroundColor: 'var(--surface-0)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 0,
                  padding: '0 8px',
                  color: 'var(--text-primary)',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              />
              <div style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                marginTop: 4,
                fontFamily: 'IBM Plex Mono, monospace',
              }}>
                Will be saved to: workflows/{saveFileName}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveDialog(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  fontFamily: 'IBM Plex Mono, monospace',
                  color: 'var(--text-muted)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveYaml()}
                disabled={!saveFileName.trim() || isSaving}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  fontFamily: 'IBM Plex Mono, monospace',
                  color: 'var(--amber)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--amber)',
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                Save as New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

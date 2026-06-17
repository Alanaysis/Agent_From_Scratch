'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Bot, Plus, Trash2, Edit2, Check, X, Loader2, ChevronDown, ChevronRight, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const TOOL_OPTIONS = [
  { id: 'Read', label: 'Read files' },
  { id: 'Write', label: 'Write files' },
  { id: 'Edit', label: 'Edit files' },
  { id: 'Shell', label: 'Run shell commands' },
  { id: 'WebFetch', label: 'Fetch web pages' },
  { id: 'WebSearch', label: 'Web search' },
  { id: 'FileTree', label: 'List directory tree' },
  { id: 'SearchFiles', label: 'Search files' },
]

export function AgentsView() {
  const store = useAppStore()
  const [expandedAgent, setExpandedAgent] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [showGenerateModal, setShowGenerateModal] = React.useState(false)
  const [generateDesc, setGenerateDesc] = React.useState('')

  type PermissionValue = 'allow' | 'ask' | 'deny'

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    systemPrompt: '',
    allowedTools: [] as string[],
    maxTurns: 8,
    isReadOnly: false,
    permission: {
      read: 'allow' as PermissionValue,
      edit: 'allow' as PermissionValue,
      bash: 'allow' as PermissionValue,
      webfetch: 'allow' as PermissionValue,
      websearch: 'allow' as PermissionValue,
    }
  })

  const PERMISSION_OPTIONS: { key: string; label: string }[] = [
    { key: 'read', label: 'Read files' },
    { key: 'edit', label: 'Edit files' },
    { key: 'bash', label: 'Shell commands' },
    { key: 'webfetch', label: 'Web fetch' },
    { key: 'websearch', label: 'Web search' },
  ]

  React.useEffect(() => {
    if (store.backendConnected && store.agents.length === 0) {
      store.loadAgents()
    }
  }, [store.backendConnected, store.agents.length])

  const handleCreate = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    try {
      const systemPromptLines = formData.systemPrompt.split('\n').filter(l => l.trim())
      await store.createAgent({
        name: formData.name,
        description: formData.description,
        systemPrompt: systemPromptLines,
        allowedTools: formData.allowedTools.length > 0 ? formData.allowedTools : '*',
        maxTurns: formData.maxTurns,
        isReadOnly: formData.isReadOnly,
        permission: formData.permission,
      })
      setIsCreating(false)
      setFormData({ name: '', description: '', systemPrompt: '', allowedTools: [], maxTurns: 8, isReadOnly: false, permission: { read: 'allow', edit: 'allow', bash: 'allow', webfetch: 'allow', websearch: 'allow' } })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (agentId: string) => {
    setSaving(true)
    try {
      const systemPromptLines = formData.systemPrompt.split('\n').filter(l => l.trim())
      await store.updateAgent(agentId, {
        name: formData.name,
        description: formData.description,
        systemPrompt: systemPromptLines,
        allowedTools: formData.allowedTools.length > 0 ? formData.allowedTools : '*',
        maxTurns: formData.maxTurns,
        isReadOnly: formData.isReadOnly,
        permission: formData.permission,
      })
      setEditingId(null)
      setFormData({ name: '', description: '', systemPrompt: '', allowedTools: [], maxTurns: 8, isReadOnly: false, permission: { read: 'allow', edit: 'allow', bash: 'allow', webfetch: 'allow', websearch: 'allow' } })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (agentId: string) => {
    if (confirm('Delete this agent?')) {
      await store.deleteAgent(agentId)
    }
  }

  const startEdit = (agent: any) => {
    setEditingId(agent.id)
    setFormData({
      name: agent.name,
      description: agent.description,
      systemPrompt: (agent.systemPrompt || []).join('\n'),
      allowedTools: Array.isArray(agent.allowedTools) ? agent.allowedTools : [],
      maxTurns: agent.maxTurns || 8,
      isReadOnly: agent.isReadOnly || false,
      permission: agent.permission || { read: 'allow', edit: 'allow', bash: 'allow', webfetch: 'allow', websearch: 'allow' },
    })
    setExpandedAgent(agent.id)
  }

  const startCreate = () => {
    setIsCreating(true)
    setFormData({ name: '', description: '', systemPrompt: '', allowedTools: [], maxTurns: 8, isReadOnly: false, permission: { read: 'allow', edit: 'allow', bash: 'allow', webfetch: 'allow', websearch: 'allow' } })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({ name: '', description: '', systemPrompt: '', allowedTools: [], maxTurns: 8, isReadOnly: false, permission: { read: 'allow', edit: 'allow', bash: 'allow', webfetch: 'allow', websearch: 'allow' } })
  }

  const handleGenerate = async () => {
    if (!generateDesc.trim()) return
    setGenerating(true)
    try {
      const generated = await store.generateAgent(generateDesc)
      if (generated) {
        setFormData({
          name: generated.name,
          description: generated.description,
          systemPrompt: (generated.systemPrompt || []).join('\n'),
          allowedTools: Array.isArray(generated.allowedTools) ? generated.allowedTools : [],
          maxTurns: generated.maxTurns || 8,
          isReadOnly: generated.isReadOnly || false,
          permission: { read: 'allow', edit: 'allow', bash: 'allow', webfetch: 'allow', websearch: 'allow' },
        })
        setIsCreating(true)
        setShowGenerateModal(false)
        setGenerateDesc('')
      }
    } finally {
      setGenerating(false)
    }
  }

  const toggleTool = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      allowedTools: prev.allowedTools.includes(toolId)
        ? prev.allowedTools.filter(t => t !== toolId)
        : [...prev.allowedTools, toolId]
    }))
  }

  const renderAgentCard = (agent: any) => {
    const isEditing = editingId === agent.id
    const isExpanded = expandedAgent === agent.id

    return (
      <div key={agent.id} style={{
        backgroundColor: 'var(--surface-2)',
        borderRadius: 10,
        border: '1px solid var(--surface-2)',
        marginBottom: 12,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer'
        }} onClick={() => !isEditing && setExpandedAgent(isExpanded ? null : agent.id)}>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: agent.isBuiltIn ? 'var(--status-bg-green)' : 'var(--status-bg-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={16} style={{ color: agent.isBuiltIn ? 'var(--status-green)' : 'var(--status-blue)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{agent.name}</span>
              {agent.isBuiltIn && (
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: 'var(--status-bg-green)',
                  color: 'var(--status-green)'
                }}>Built-in</span>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{agent.description}</span>
          </div>
          {!agent.isBuiltIn && !isEditing && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(agent) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(agent.id) }}
                style={{ background: 'none', border: 'none', color: 'var(--status-red)', cursor: 'pointer', padding: 4 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {isExpanded && (
          <div style={{
            padding: '0 16px 16px 48px',
            borderTop: '1px solid var(--surface-2)',
            marginTop: 0
          }}>
            <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Max Turns</span>
                <p style={{ fontSize: 13, marginTop: 2 }}>{agent.maxTurns || 8}</p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tools</span>
                <p style={{ fontSize: 13, marginTop: 2 }}>
                  {agent.allowedTools === '*' ? 'All tools' : (agent.allowedTools || []).join(', ') || 'None'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>System Prompt</span>
                <pre style={{
                  fontSize: 12,
                  marginTop: 4,
                  padding: 8,
                  backgroundColor: 'var(--surface-0)',
                  borderRadius: 6,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace'
                }}>
                  {(agent.systemPrompt || []).join('\n') || 'No system prompt'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderForm = () => (
    <div style={{
      backgroundColor: 'var(--surface-2)',
      borderRadius: 10,
      border: '1px solid var(--status-blue)',
      padding: 16,
      marginBottom: 12
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., recipe-executor"
            disabled={saving}
            style={{ height: 38, fontSize: 13, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Description</Label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="What this agent does"
            disabled={saving}
            style={{ height: 38, fontSize: 13, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>System Prompt (one line per instruction)</Label>
          <textarea
            value={formData.systemPrompt}
            onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
            placeholder={"You are a recipe executor agent.\nFocus on wafer processing tasks.\nBe precise and follow recipes exactly."}
            disabled={saving}
            rows={4}
            style={{
              fontSize: 13,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-0)',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Allowed Tools</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, allowedTools: prev.allowedTools.length > 0 ? [] : '*' as any }))}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: formData.allowedTools.length === 0 ? 'var(--status-blue)' : 'var(--border-medium)',
                backgroundColor: formData.allowedTools.length === 0 ? 'var(--status-bg-blue)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              All Tools
            </button>
            {TOOL_OPTIONS.map(tool => (
              <button
                key={tool.id}
                type="button"
                onClick={() => toggleTool(tool.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: formData.allowedTools.includes(tool.id) ? 'var(--status-blue)' : 'var(--border-medium)',
                  backgroundColor: formData.allowedTools.includes(tool.id) ? 'var(--status-bg-blue)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Max Turns</Label>
            <Input
              type="number"
              value={formData.maxTurns}
              onChange={(e) => setFormData(prev => ({ ...prev, maxTurns: parseInt(e.target.value) || 8 }))}
              disabled={saving}
              style={{ height: 38, fontSize: 13, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Read Only</Label>
            <div style={{ height: 38, display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isReadOnly}
                  onChange={(e) => setFormData(prev => ({ ...prev, isReadOnly: e.target.checked }))}
                  disabled={saving}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13 }}>Deny file edits and bash</span>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Permissions</Label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            padding: 12,
            backgroundColor: 'var(--surface-0)',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)'
          }}>
            {PERMISSION_OPTIONS.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{label}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {(['allow', 'ask', 'deny'] as PermissionValue[]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        permission: { ...prev.permission, [key]: val }
                      }))}
                      disabled={saving}
                      style={{
                        flex: 1,
                        padding: '4px 0',
                        fontSize: 10,
                        fontWeight: 500,
                        border: '1px solid',
                        borderColor: formData.permission[key as keyof typeof formData.permission] === val
                          ? val === 'allow' ? 'var(--status-green)' : val === 'ask' ? 'rgba(234,179,8,0.5)' : 'var(--status-red)'
                          : 'var(--border-medium)',
                        backgroundColor: formData.permission[key as keyof typeof formData.permission] === val
                          ? val === 'allow' ? 'var(--status-bg-green)' : val === 'ask' ? 'rgba(234,179,8,0.15)' : 'var(--status-bg-red)'
                          : 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        borderRadius: 4,
                        textTransform: 'uppercase'
                      }}
                    >
                      {val[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button
            onClick={isCreating ? handleCreate : () => handleUpdate(editingId!)}
            disabled={!formData.name.trim() || saving}
            style={{
              height: 36,
              backgroundColor: formData.name.trim() && !saving ? 'var(--status-blue)' : 'var(--surface-2)',
              border: 'none'
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            {saving ? 'Saving...' : (isCreating ? 'Create' : 'Save')}
          </Button>
          <Button
            onClick={cancelEdit}
            disabled={saving}
            style={{ height: 36, backgroundColor: 'var(--surface-2)', border: 'none' }}
          >
            <X size={14} />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      backgroundColor: 'var(--surface-0)',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: 24
      }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{
              fontSize: 20,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 4
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--surface-2)'
              }}>
                <Bot size={18} />
              </div>
              Agents
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configure agents for task execution</p>
          </div>
          {!isCreating && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={() => setShowGenerateModal(true)}
                disabled={generating}
                style={{ height: 36, backgroundColor: 'var(--status-purple)', border: 'none' }}
              >
                <Wand2 size={14} />
                AI Generate
              </Button>
              <Button onClick={startCreate} style={{ height: 36, backgroundColor: 'var(--status-blue)', border: 'none' }}>
                <Plus size={14} />
                New Agent
              </Button>
            </div>
          )}
        </div>

        {showGenerateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <div style={{
              backgroundColor: 'var(--surface-2)',
              borderRadius: 12,
              border: '1px solid var(--border-medium)',
              padding: 24,
              width: '100%',
              maxWidth: 400
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>AI Generate Agent</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Describe what kind of agent you want to create. The AI will generate an appropriate configuration.
              </p>
              <textarea
                value={generateDesc}
                onChange={(e) => setGenerateDesc(e.target.value)}
                placeholder="e.g., An agent that helps with wafer recipe creation and optimization"
                rows={4}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 13,
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--surface-0)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button
                  onClick={handleGenerate}
                  disabled={!generateDesc.trim() || generating}
                  style={{ height: 36, backgroundColor: 'var(--status-purple)', border: 'none', flex: 1 }}
                >
                  {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={14} />}
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
                <Button
                  onClick={() => { setShowGenerateModal(false); setGenerateDesc('') }}
                  disabled={generating}
                  style={{ height: 36, backgroundColor: 'var(--surface-2)', border: 'none' }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {isCreating && renderForm()}

        {store.agents.filter(a => a.isBuiltIn).map(renderAgentCard)}

        {store.agents.filter(a => !a.isBuiltIn).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 8 }}>Custom Agents</h3>
            {store.agents.filter(a => !a.isBuiltIn).map(renderAgentCard)}
          </div>
        )}

        {store.agents.length === 0 && !store.backendConnected && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <p>Connect to backend to view agents</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
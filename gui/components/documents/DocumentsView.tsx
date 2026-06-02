'use client'

import * as React from 'react'
import { Plus, Trash2, Search, FileText, Clock, X, ChevronRight, Edit3, Save } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StoredDocument } from '@/types'

const typeConfig: Record<string, { label: string; color: string }> = {
  prd: { label: 'PRD', color: '#3b82f6' },
  tech_design: { label: 'Tech Design', color: '#7b68c0' },
  adr: { label: 'ADR', color: 'var(--amber)' },
  spec: { label: 'Spec', color: '#5cb85c' },
  guide: { label: 'Guide', color: 'var(--copper)' },
  report: { label: 'Report', color: 'var(--warm-red)' },
}

export function DocumentsView() {
  const { documents, loadDocuments, createDocument, updateDocument, deleteDocument } = useAppStore()
  const [search, setSearch] = React.useState('')
  const [selectedDoc, setSelectedDoc] = React.useState<StoredDocument | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editContent, setEditContent] = React.useState('')
  const [editTitle, setEditTitle] = React.useState('')
  const [showCreate, setShowCreate] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('')
  const [newType, setNewType] = React.useState<string>('spec')
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    loadDocuments().finally(() => setIsLoading(false))
  }, [])

  React.useEffect(() => {
    if (selectedDoc) {
      const updated = documents.find(d => d.id === selectedDoc.id)
      if (updated) setSelectedDoc(updated)
    }
  }, [documents])

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.type.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    await createDocument({ title: newTitle.trim(), type: newType })
    setNewTitle('')
    setShowCreate(false)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteDocument(id)
    if (selectedDoc?.id === id) setSelectedDoc(null)
  }

  const handleStartEdit = () => {
    if (!selectedDoc) return
    setEditTitle(selectedDoc.title)
    setEditContent(selectedDoc.content)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!selectedDoc) return
    await updateDocument(selectedDoc.id, { title: editTitle, content: editContent })
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: 'var(--surface-0)', color: 'var(--text-muted)', gap: 8, fontFamily: 'IBM Plex Sans, sans-serif' }}>
        <FileText size={16} />
        Loading documents...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: 'var(--surface-0)', color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {/* Document List */}
      <div style={{ width: 300, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface-1)' }}>
        {/* Search + Create */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, height: 32, fontSize: 12, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}
            />
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} style={{ width: '100%', height: 30, fontSize: 12, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000', fontWeight: 600 }}>
            <Plus size={14} style={{ marginRight: 6 }} /> New Document
          </Button>

          {showCreate && (
            <div style={{ marginTop: 8, padding: 8, backgroundColor: 'var(--surface-0)', borderRadius: 0, border: '1px solid var(--border-subtle)' }}>
              <Input
                placeholder="Document title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                style={{ width: '100%', height: 26, fontSize: 11, backgroundColor: 'var(--surface-0)', border: '1px solid var(--border-subtle)', borderRadius: 0, marginBottom: 6, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}
              />
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 6 }}>
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setNewType(key)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 9,
                      borderRadius: 0,
                      backgroundColor: newType === key ? 'var(--surface-2)' : 'var(--surface-0)',
                      border: `1px solid ${newType === key ? cfg.color : 'var(--border-subtle)'}`,
                      color: newType === key ? cfg.color : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: 'IBM Plex Mono, monospace',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
              <Button onClick={handleCreate} style={{ width: '100%', height: 24, fontSize: 11, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000', fontWeight: 600 }}>
                Create
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No documents</div>
          ) : (
            filtered.map(doc => {
              const cfg = typeConfig[doc.type] || { label: doc.type, color: 'var(--text-muted)' }
              const isSelected = selectedDoc?.id === doc.id
              return (
                <div
                  key={doc.id}
                  onClick={() => { setSelectedDoc(doc); setIsEditing(false) }}
                  style={{
                    padding: '8px 10px',
                    marginBottom: 2,
                    borderRadius: 0,
                    backgroundColor: isSelected ? 'var(--surface-2)' : 'transparent',
                    cursor: 'pointer',
                    border: isSelected ? `1px solid ${cfg.color}` : '1px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-medium)' }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: cfg.color, backgroundColor: 'var(--surface-0)', padding: '1px 4px', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', border: '1px solid var(--border-subtle)' }}>
                      {cfg.label}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.title}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, doc.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.3 }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                    >
                      <Trash2 size={10} color="var(--text-muted)" />
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4, fontFamily: 'IBM Plex Mono, monospace' }}>
                    {formatDistanceToNow(doc.updatedAt, { addSuffix: true })}
                    {doc.content && <span> · {doc.content.length} chars</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Detail / Editor Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedDoc ? (
          <>
            {/* Header */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(() => {
                  const cfg = typeConfig[selectedDoc.type] || { label: selectedDoc.type, color: 'var(--text-muted)' }
                  return (
                    <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, backgroundColor: 'var(--surface-0)', padding: '2px 6px', borderRadius: 0, fontFamily: 'IBM Plex Mono, monospace', border: '1px solid var(--border-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {cfg.label}
                    </span>
                  )
                })()}
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ flex: 1, height: 28, fontSize: 14, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 0, color: 'var(--text-primary)' }}
                  />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedDoc.title}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {isEditing ? (
                  <Button onClick={handleSave} style={{ height: 28, fontSize: 11, borderRadius: 0, backgroundColor: 'var(--amber)', color: '#000', fontWeight: 600 }}>
                    <Save size={12} style={{ marginRight: 4 }} /> Save
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={handleStartEdit} style={{ height: 28, fontSize: 11, borderRadius: 0, border: '1px solid var(--border-subtle)' }}>
                    <Edit3 size={12} style={{ marginRight: 4 }} /> Edit
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setSelectedDoc(null)} style={{ width: 28, height: 28, borderRadius: 0 }}>
                  <X size={14} />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: 14, overflow: 'auto' }}>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'var(--surface-0)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 0,
                    padding: 12,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    fontFamily: 'IBM Plex Mono, monospace',
                    resize: 'none',
                  }}
                  placeholder="Write your document content here..."
                />
              ) : (
                <div style={{
                  backgroundColor: 'var(--surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 0,
                  padding: 12,
                  minHeight: 200,
                }}>
                  {selectedDoc.content ? (
                    <pre style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'IBM Plex Mono, monospace', margin: 0 }}>
                      {selectedDoc.content}
                    </pre>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>No content yet. Click Edit to start writing.</div>
                  )}
                </div>
              )}
            </div>

            {/* Related Tasks */}
            {selectedDoc.relatedTaskIds && selectedDoc.relatedTaskIds.length > 0 && (() => {
              const relatedTasks = useAppStore.getState().tasks.filter(t => selectedDoc.relatedTaskIds?.includes(t.id))
              if (relatedTasks.length === 0) return null
              return (
                <div style={{ padding: '0 14px 12px' }}>
                  <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'block', fontFamily: 'IBM Plex Mono, monospace' }}>
                    Related Tasks
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {relatedTasks.map(t => {
                      const statusColor = { todo: '#3b82f6', in_progress: 'var(--amber)', verify: '#7b68c0', done: '#5cb85c', failed: 'var(--warm-red)' }[t.status] || 'var(--text-muted)'
                      return (
                        <div key={t.id} style={{
                          padding: '6px 8px',
                          backgroundColor: 'var(--surface-0)',
                          borderRadius: 0,
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                          onClick={() => useAppStore.getState().setViewMode('kanban')}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: statusColor, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)' }}>{t.title}</span>
                          <span style={{ fontSize: 9, color: statusColor, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>{t.status}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Footer */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-faint)', display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace' }}>
              <span>Created {formatDistanceToNow(selectedDoc.createdAt, { addSuffix: true })}</span>
              <span>Updated {formatDistanceToNow(selectedDoc.updatedAt, { addSuffix: true })}</span>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Select a document to view
          </div>
        )}
      </div>
    </div>
  )
}

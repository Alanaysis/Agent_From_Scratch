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
  tech_design: { label: 'Tech Design', color: '#8b5cf6' },
  adr: { label: 'ADR', color: '#f59e0b' },
  spec: { label: 'Spec', color: '#22c55e' },
  guide: { label: 'Guide', color: '#06b6d4' },
  report: { label: 'Report', color: '#ef4444' },
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#0a0a0a', color: '#666', gap: 8 }}>
        <FileText size={16} />
        Loading documents...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#0a0a0a', color: '#fff' }}>
      {/* Document List */}
      <div style={{ width: 300, borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', backgroundColor: '#111' }}>
        {/* Search + Create */}
        <div style={{ padding: 12, borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, height: 34, fontSize: 12, backgroundColor: '#0a0a0a', border: '1px solid #222' }}
            />
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} style={{ width: '100%', height: 32, fontSize: 12 }}>
            <Plus size={14} style={{ marginRight: 6 }} /> New Document
          </Button>

          {showCreate && (
            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#0d0d0d', borderRadius: 6, border: '1px solid #1a1a1a' }}>
              <Input
                placeholder="Document title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                style={{ width: '100%', height: 28, fontSize: 11, backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 6 }}
              />
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setNewType(key)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 9,
                      borderRadius: 3,
                      backgroundColor: newType === key ? cfg.color + '20' : '#0a0a0a',
                      border: `1px solid ${newType === key ? cfg.color + '66' : '#1a1a1a'}`,
                      color: newType === key ? cfg.color : '#666',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
              <Button onClick={handleCreate} style={{ width: '100%', height: 26, fontSize: 11 }}>
                Create
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 12 }}>No documents</div>
          ) : (
            filtered.map(doc => {
              const cfg = typeConfig[doc.type] || { label: doc.type, color: '#666' }
              const isSelected = selectedDoc?.id === doc.id
              return (
                <div
                  key={doc.id}
                  onClick={() => { setSelectedDoc(doc); setIsEditing(false) }}
                  style={{
                    padding: '8px 10px',
                    marginBottom: 4,
                    borderRadius: 6,
                    backgroundColor: isSelected ? '#1e3a5f' : 'transparent',
                    cursor: 'pointer',
                    border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#1a1a1a' }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: cfg.color, backgroundColor: cfg.color + '15', padding: '1px 4px', borderRadius: 3 }}>
                      {cfg.label}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.title}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, doc.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.3 }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
                    >
                      <Trash2 size={10} color="#888" />
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
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
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(() => {
                  const cfg = typeConfig[selectedDoc.type] || { label: selectedDoc.type, color: '#666' }
                  return (
                    <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, backgroundColor: cfg.color + '15', padding: '2px 6px', borderRadius: 3 }}>
                      {cfg.label}
                    </span>
                  )
                })()}
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ flex: 1, height: 28, fontSize: 14, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #333', borderRadius: 4 }}
                  />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedDoc.title}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {isEditing ? (
                  <Button onClick={handleSave} style={{ height: 28, fontSize: 11 }}>
                    <Save size={12} style={{ marginRight: 4 }} /> Save
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={handleStartEdit} style={{ height: 28, fontSize: 11 }}>
                    <Edit3 size={12} style={{ marginRight: 4 }} /> Edit
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setSelectedDoc(null)} style={{ width: 28, height: 28 }}>
                  <X size={14} />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#0d0d0d',
                    border: '1px solid #1a1a1a',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 13,
                    color: '#ccc',
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                    resize: 'none',
                  }}
                  placeholder="Write your document content here..."
                />
              ) : (
                <div style={{
                  backgroundColor: '#0d0d0d',
                  border: '1px solid #1a1a1a',
                  borderRadius: 8,
                  padding: 12,
                  minHeight: 200,
                }}>
                  {selectedDoc.content ? (
                    <pre style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                      {selectedDoc.content}
                    </pre>
                  ) : (
                    <div style={{ fontSize: 12, color: '#444', fontStyle: 'italic' }}>No content yet. Click Edit to start writing.</div>
                  )}
                </div>
              )}
            </div>

            {/* Related Tasks */}
            {selectedDoc.relatedTaskIds && selectedDoc.relatedTaskIds.length > 0 && (() => {
              const relatedTasks = useAppStore.getState().tasks.filter(t => selectedDoc.relatedTaskIds?.includes(t.id))
              if (relatedTasks.length === 0) return null
              return (
                <div style={{ padding: '0 16px 12px' }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
                    Related Tasks
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {relatedTasks.map(t => {
                      const statusColor = { todo: '#3b82f6', in_progress: '#f59e0b', verify: '#a855f7', done: '#22c55e', failed: '#ef4444' }[t.status] || '#666'
                      return (
                        <div key={t.id} style={{
                          padding: '6px 8px',
                          backgroundColor: '#0d0d0d',
                          borderRadius: 6,
                          border: `1px solid ${statusColor}22`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                          onClick={() => useAppStore.getState().setViewMode('kanban')}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 11, color: '#ccc' }}>{t.title}</span>
                          <span style={{ fontSize: 9, color: statusColor }}>{t.status}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Footer */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', fontSize: 10, color: '#444', display: 'flex', justifyContent: 'space-between' }}>
              <span>Created {formatDistanceToNow(selectedDoc.createdAt, { addSuffix: true })}</span>
              <span>Updated {formatDistanceToNow(selectedDoc.updatedAt, { addSuffix: true })}</span>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13 }}>
            Select a document to view
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Send, Bot, Loader2, ArrowLeft, Square, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Message, MessageBlock, ToolCallEvent } from '@/types'

function ToolCallCard({ block, activeCall }: { block: MessageBlock & { type: 'tool_use' }; activeCall?: ToolCallEvent }) {
  const [expanded, setExpanded] = React.useState(false)
  const status = activeCall?.status ?? block.status ?? 'completed'
  const durationMs = activeCall?.durationMs ?? block.durationMs

  const statusConfig = {
    pending: { color: '#666', icon: Clock, label: 'Pending' },
    running: { color: '#3b82f6', icon: Loader2, label: 'Running' },
    completed: { color: '#22c55e', icon: CheckCircle2, label: 'Done' },
    failed: { color: '#ef4444', icon: XCircle, label: 'Failed' },
    denied: { color: '#f97316', icon: XCircle, label: 'Denied' },
  } as const

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon
  const inputPreview = typeof block.input === 'string'
    ? block.input
    : JSON.stringify(block.input, null, 2)

  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid #222',
      backgroundColor: '#0d0d0d',
      overflow: 'hidden',
      fontSize: 12,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#ccc',
          textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Wrench size={13} color={cfg.color} />
        <span style={{ fontWeight: 500, color: '#fff', flex: 1 }}>{block.toolName}</span>
        {status === 'running' && (
          <Loader2 size={12} color={cfg.color} style={{ animation: 'spin 1s linear infinite' }} />
        )}
        {status !== 'running' && <StatusIcon size={12} color={cfg.color} />}
        <span style={{ color: cfg.color, fontSize: 11 }}>{cfg.label}</span>
        {durationMs != null && (
          <span style={{ color: '#666', fontSize: 11 }}>{durationMs}ms</span>
        )}
      </button>
      {expanded && (
        <div style={{ padding: '0 10px 8px', borderTop: '1px solid #1a1a1a' }}>
          <div style={{ marginTop: 6 }}>
            <div style={{ color: '#666', marginBottom: 3, fontSize: 11 }}>Input</div>
            <pre style={{
              margin: 0,
              padding: 8,
              backgroundColor: '#111',
              borderRadius: 6,
              color: '#aaa',
              fontSize: 11,
              maxHeight: 160,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>{inputPreview}</pre>
          </div>
          {activeCall?.result && (
            <div style={{ marginTop: 6 }}>
              <div style={{ color: '#666', marginBottom: 3, fontSize: 11 }}>Result</div>
              <pre style={{
                margin: 0,
                padding: 8,
                backgroundColor: '#111',
                borderRadius: 6,
                color: '#aaa',
                fontSize: 11,
                maxHeight: 200,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>{activeCall.result}</pre>
            </div>
          )}
          {activeCall?.error && (
            <div style={{ marginTop: 6 }}>
              <div style={{ color: '#ef4444', marginBottom: 3, fontSize: 11 }}>Error</div>
              <pre style={{
                margin: 0,
                padding: 8,
                backgroundColor: '#1a0d0d',
                borderRadius: 6,
                color: '#ef4444',
                fontSize: 11,
                maxHeight: 200,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>{activeCall.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MessageBlocks({ msg, activeToolCalls }: { msg: Message; activeToolCalls: Map<string, ToolCallEvent> }) {
  if (!msg.blocks || msg.blocks.length === 0) {
    return <>{msg.content}</>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {msg.blocks.map((block, i) => {
        if (block.type === 'text') {
          if (!block.text) return null
          return <span key={i}>{block.text}</span>
        }
        if (block.type === 'tool_use') {
          const activeCall = activeToolCalls.get(block.toolUseId)
          return <ToolCallCard key={block.toolUseId} block={block} activeCall={activeCall} />
        }
        if (block.type === 'tool_result') {
          return (
            <div key={block.toolUseId} style={{
              borderRadius: 8,
              padding: '6px 10px',
              backgroundColor: block.isError ? '#1a0d0d' : '#0d1a0d',
              border: `1px solid ${block.isError ? '#331111' : '#112211'}`,
              fontSize: 12,
              color: block.isError ? '#ef4444' : '#aaa',
              maxHeight: 200,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {block.content}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

function DataInputForm({ schema, onSubmit, onCancel }: {
  schema: Array<{ name: string; label: string; type: string; options?: string[]; required?: boolean; default?: unknown }>
  onSubmit: (data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = React.useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const field of schema) {
      initial[field.name] = field.default ?? ''
    }
    return initial
  })

  return (
    <div>
      {schema.map((field) => (
        <div key={field.name} style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>
            {field.label}
            {field.required && <span style={{ color: '#ef4444' }}> *</span>}
          </label>
          {field.type === 'select' && field.options ? (
            <select
              value={String(formData[field.name] || '')}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              style={{ width: '100%', height: 32, fontSize: 12, backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '0 8px' }}
            >
              <option value="">Select...</option>
              {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : field.type === 'boolean' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!formData[field.name]}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              {field.label}
            </label>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={String(formData[field.name] || '')}
              onChange={(e) => setFormData({ ...formData, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
              placeholder={field.label}
              style={{ width: '100%', height: 32, fontSize: 12, backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '0 8px', boxSizing: 'border-box' }}
            />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel} style={{ color: '#888' }}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} style={{ backgroundColor: '#8b5cf6' }}>Submit</Button>
      </div>
    </div>
  )
}

export function ChatView() {
  const store = useAppStore()
  const [input, setInput] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const [, setTick] = React.useState(0)

  React.useEffect(() => {
    useAppStore.getState().initBackendConnection()
  }, [])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [store.messages.length, store.streamingText])

  React.useEffect(() => {
    if (store.backendConnected) {
      inputRef.current?.focus()
    }
  }, [store.backendConnected, store.messages.length])

  const handleSend = async () => {
    if (!input.trim() || !store.backendConnected) return
    const content = input.trim()
    setInput('')
    try {
      await store.sendChatMessage(content, store.currentSession?.id ?? undefined)
    } catch (e) {
      console.error('[ChatView] send error:', e)
    }
    setTick(t => t + 1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a', color: '#fff' }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#111'
      }}>
        {store.currentSession && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => store.setCurrentSession(null)}
            style={{ width: 28, height: 28 }}
          >
            <ArrowLeft size={14} color="#fff" />
          </Button>
        )}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #333'
        }}>
          <Bot size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {store.currentSession ? store.currentSession.title : 'IRG'}
          </div>
          <div style={{ fontSize: 11, color: store.backendConnected ? '#22c55e' : '#f97316', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
            {store.backendConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#666' }}>
          {store.messages.length} messages
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {store.messages.length === 0 && !store.streamingText && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#666'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #222'
            }}>
              <Bot size={24} color="#666" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#888' }}>IRG</div>
            <div style={{ fontSize: 13 }}>Ready to assist</div>
          </div>
        )}

        {store.messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex',
            gap: 10,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start'
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: msg.role === 'user' ? 'none' : '1px solid #333'
            }}>
              {msg.role === 'user' ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>U</span>
              ) : (
                <Bot size={14} color="#fff" />
              )}
            </div>
            <div style={{
              maxWidth: '65%',
              borderRadius: 12,
              padding: '8px 12px',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#111',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#fff',
              border: msg.role === 'user' ? 'none' : '1px solid #1a1a1a'
            }}>
              {msg.role === 'user' ? msg.content : <MessageBlocks msg={msg} activeToolCalls={store.activeToolCalls} />}
            </div>
          </div>
        ))}

        {store.streamingText && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid #333'
            }}>
              <Bot size={14} color="#fff" />
            </div>
            <div style={{
              maxWidth: '65%',
              borderRadius: 12,
              padding: '8px 12px',
              backgroundColor: '#111',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#fff',
              border: '1px solid #1a1a1a'
            }}>
              {store.streamingText}
              <span style={{ display: 'inline-block', width: 6, height: 14, backgroundColor: '#3b82f6', marginLeft: 4, borderRadius: 2, animation: 'blink 1s step-end infinite' }} />
            </div>
          </div>
        )}

        {store.isLoading && store.activeToolCalls.size > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid #333'
            }}>
              <Bot size={14} color="#fff" />
            </div>
            <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from(store.activeToolCalls.values()).map((tc) => (
                <div key={tc.toolUseId} style={{
                  borderRadius: 8,
                  padding: '6px 10px',
                  backgroundColor: '#0d0d0d',
                  border: '1px solid #222',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#ccc',
                }}>
                  <Loader2 size={12} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                  <Wrench size={12} color="#3b82f6" />
                  <span style={{ fontWeight: 500, color: '#fff' }}>{tc.toolName}</span>
                  <span style={{ color: '#666' }}>running...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {store.isLoading && !store.streamingText && store.activeToolCalls.size === 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid #333'
            }}>
              <Bot size={14} color="#fff" />
            </div>
            <div style={{
              borderRadius: 12,
              padding: '8px 12px',
              backgroundColor: '#111',
              border: '1px solid #1a1a1a',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#888',
              fontSize: 13
            }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{
        padding: 12,
        borderTop: '1px solid #1a1a1a',
        backgroundColor: '#111'
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={store.backendConnected ? 'Type a message...' : 'Not connected'}
            disabled={!store.backendConnected}
            autoFocus
            style={{
              flex: 1,
              resize: 'none',
              borderRadius: 10,
              border: '1px solid #222',
              padding: '10px 12px',
              fontSize: 13,
              backgroundColor: '#0a0a0a',
              color: '#fff',
              outline: 'none',
              lineHeight: 1.4,
              maxHeight: 120,
              overflowY: 'auto'
            }}
            rows={1}
          />
          {store.isLoading ? (
            <Button
              onClick={() => store.cancelChat()}
              style={{
                height: 38,
                width: 38,
                borderRadius: 10,
                backgroundColor: '#ef4444',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Square size={14} />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!store.backendConnected || !input.trim()}
              style={{
                height: 38,
                width: 38,
                borderRadius: 10,
                backgroundColor: store.backendConnected && input.trim() ? '#3b82f6' : '#1a1a1a',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Permission Request Modal */}
      {store.permissionRequest && (() => {
        const req = store.permissionRequest
        const reqType = req.requestType || 'permission'

        const handleResolve = (response: any) => {
          req.resolve(response)
          store.setPermissionRequest(null)
        }

        // Determine title and icon based on request type
        const titleMap: Record<string, string> = {
          permission: 'Permission Required',
          approval: 'Confirmation Required',
          error_choice: 'Error — Choose Action',
          data_input: 'Input Required',
        }
        const colorMap: Record<string, string> = {
          permission: '#3b82f6',
          approval: '#f59e0b',
          error_choice: '#ef4444',
          data_input: '#8b5cf6',
        }

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 12,
              padding: 24,
              maxWidth: 420,
              width: '90%',
              border: `1px solid ${colorMap[reqType] || '#333'}44`,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: colorMap[reqType] || '#fff' }}>
                {titleMap[reqType] || 'Permission Required'}
              </h3>

              {reqType === 'permission' && (
                <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Tool: <span style={{ color: '#3b82f6', fontWeight: 500 }}>{req.toolName}</span>
                </p>
              )}

              {req.message && (
                <p style={{ fontSize: 13, color: '#ccc', marginBottom: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {req.message}
                </p>
              )}

              {/* Approval mode: Confirm / Cancel */}
              {reqType === 'approval' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={() => handleResolve({ approved: false })} style={{ color: '#888' }}>
                    Cancel
                  </Button>
                  <Button onClick={() => handleResolve({ approved: true })} style={{ backgroundColor: '#f59e0b' }}>
                    Confirm
                  </Button>
                </div>
              )}

              {/* Error choice mode: option buttons */}
              {reqType === 'error_choice' && req.options && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {req.options.map((opt) => {
                    const optColors: Record<string, string> = { retry: '#f59e0b', skip: '#3b82f6', abort: '#ef4444' }
                    return (
                      <Button
                        key={opt}
                        onClick={() => handleResolve({ approved: true, choice: opt })}
                        style={{ backgroundColor: optColors[opt] || '#666', textTransform: 'capitalize' }}
                      >
                        {opt}
                      </Button>
                    )
                  })}
                </div>
              )}

              {/* Data input mode: form fields */}
              {reqType === 'data_input' && req.schema && (
                <DataInputForm schema={req.schema} onSubmit={(data) => handleResolve({ approved: true, data })} onCancel={() => handleResolve({ approved: false })} />
              )}

              {/* Default permission mode: Allow / Deny */}
              {reqType === 'permission' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={() => handleResolve({ approved: false })} style={{ color: '#888' }}>
                    Deny
                  </Button>
                  <Button onClick={() => handleResolve({ approved: true })} style={{ backgroundColor: '#3b82f6' }}>
                    Allow
                  </Button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
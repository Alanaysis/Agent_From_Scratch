'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Send, Bot, Loader2, ArrowLeft, Square, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Wrench, Cpu, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Message, MessageBlock, ToolCallEvent } from '@/types'

const S = {
  bg: 'var(--surface-0)',
  surface: 'var(--surface-1)',
  elevated: 'var(--surface-2)',
  hover: 'var(--surface-3)',
  border: 'var(--border-subtle)',
  borderMed: 'var(--border-medium)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  textFaint: 'var(--text-faint)',
  amber: 'var(--amber)',
  copper: 'var(--copper)',
  green: '#5cb85c',
  red: 'var(--warm-red)',
  purple: '#7b68c0',
}

const mono = 'IBM Plex Mono, monospace'
const sans = 'IBM Plex Sans, sans-serif'

function ToolCallCard({ block, activeCall }: { block: MessageBlock & { type: 'tool_use' }; activeCall?: ToolCallEvent }) {
  const [expanded, setExpanded] = React.useState(false)
  const status = activeCall?.status ?? block.status ?? 'completed'
  const durationMs = activeCall?.durationMs ?? block.durationMs

  const statusConfig = {
    pending: { color: S.textMuted, icon: Clock, label: 'PENDING' },
    running: { color: S.amber, icon: Loader2, label: 'RUNNING' },
    completed: { color: S.green, icon: CheckCircle2, label: 'DONE' },
    failed: { color: S.red, icon: XCircle, label: 'FAILED' },
    denied: { color: S.copper, icon: XCircle, label: 'DENIED' },
  } as const

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon
  const inputPreview = typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2)

  return (
    <div style={{
      border: `1px solid ${S.borderMed}`,
      backgroundColor: S.surface,
      overflow: 'hidden',
      fontSize: 12,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '6px 10px', background: 'none', border: 'none',
          cursor: 'pointer', color: S.textSec, textAlign: 'left', fontFamily: sans,
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={11} color={cfg.color} />
        <span style={{ fontWeight: 500, color: S.text, flex: 1, fontFamily: mono, fontSize: 11 }}>{block.toolName}</span>
        {status === 'running' && <Loader2 size={10} color={cfg.color} style={{ animation: 'spin 1s linear infinite' }} />}
        {status !== 'running' && <StatusIcon size={10} color={cfg.color} />}
        <span style={{ color: cfg.color, fontSize: 9, fontFamily: mono, letterSpacing: '0.05em' }}>{cfg.label}</span>
        {durationMs != null && <span style={{ color: S.textFaint, fontSize: 10, fontFamily: mono }}>{durationMs}ms</span>}
      </button>
      {expanded && (
        <div style={{ padding: '0 10px 8px', borderTop: `1px solid ${S.border}` }}>
          <div style={{ marginTop: 6 }}>
            <div style={{ color: S.textFaint, marginBottom: 3, fontSize: 10, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input</div>
            <pre style={{ margin: 0, padding: 8, backgroundColor: S.bg, color: S.textSec, fontSize: 11, fontFamily: mono, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{inputPreview}</pre>
          </div>
          {activeCall?.result && (
            <div style={{ marginTop: 6 }}>
              <div style={{ color: S.textFaint, marginBottom: 3, fontSize: 10, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Result</div>
              <pre style={{ margin: 0, padding: 8, backgroundColor: S.bg, color: S.textSec, fontSize: 11, fontFamily: mono, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{activeCall.result}</pre>
            </div>
          )}
          {activeCall?.error && (
            <div style={{ marginTop: 6 }}>
              <div style={{ color: S.red, marginBottom: 3, fontSize: 10, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error</div>
              <pre style={{ margin: 0, padding: 8, backgroundColor: 'rgba(192,80,80,0.06)', color: S.red, fontSize: 11, fontFamily: mono, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{activeCall.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MessageBlocks({ msg, activeToolCalls }: { msg: Message; activeToolCalls: Map<string, ToolCallEvent> }) {
  if (!msg.blocks || msg.blocks.length === 0) return <>{msg.content}</>
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
              padding: '6px 10px',
              backgroundColor: block.isError ? 'rgba(192,80,80,0.06)' : 'rgba(92,184,92,0.04)',
              border: `1px solid ${block.isError ? 'rgba(192,80,80,0.15)' : 'rgba(92,184,92,0.1)'}`,
              fontSize: 11, fontFamily: mono, color: block.isError ? S.red : S.textSec,
              maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
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
    for (const field of schema) initial[field.name] = field.default ?? ''
    return initial
  })

  return (
    <div>
      {schema.map((field) => (
        <div key={field.name} style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: S.textMuted, display: 'block', marginBottom: 4, fontFamily: mono }}>
            {field.label}{field.required && <span style={{ color: S.red }}> *</span>}
          </label>
          {field.type === 'select' && field.options ? (
            <select
              value={String(formData[field.name] || '')}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              style={{ width: '100%', height: 32, fontSize: 12, fontFamily: sans, backgroundColor: S.bg, border: `1px solid ${S.borderMed}`, color: S.text, padding: '0 8px' }}
            >
              <option value="">Select...</option>
              {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : field.type === 'boolean' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: S.textSec, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!formData[field.name]} onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })} style={{ width: 16, height: 16 }} />
              {field.label}
            </label>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={String(formData[field.name] || '')}
              onChange={(e) => setFormData({ ...formData, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
              placeholder={field.label}
              style={{ width: '100%', height: 32, fontSize: 12, fontFamily: sans, backgroundColor: S.bg, border: `1px solid ${S.borderMed}`, color: S.text, padding: '0 8px', boxSizing: 'border-box' }}
            />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="ghost" onClick={onCancel} style={{ color: S.textMuted }}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} style={{ backgroundColor: S.amber, color: '#0c0c0c' }}>Submit</Button>
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

  React.useEffect(() => { useAppStore.getState().initBackendConnection() }, [])
  React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [store.messages.length, store.streamingText])
  React.useEffect(() => { if (store.backendConnected) inputRef.current?.focus() }, [store.backendConnected, store.messages.length])

  const handleSend = async () => {
    if (!input.trim() || !store.backendConnected) return
    const content = input.trim()
    setInput('')
    try { await store.sendChatMessage(content, store.currentSession?.id ?? undefined) } catch (e) { console.error('[ChatView] send error:', e) }
    setTick(t => t + 1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: S.bg, color: S.text, fontFamily: sans }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 10, backgroundColor: S.surface }}>
        {store.currentSession && (
          <Button variant="ghost" size="icon" onClick={() => store.setCurrentSession(null)} style={{ width: 26, height: 26 }}>
            <ArrowLeft size={14} color={S.textSec} />
          </Button>
        )}
        <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.amber }}>
          <Cpu size={18} strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{store.currentSession ? store.currentSession.title : 'IRG'}</div>
          <div style={{ fontSize: 10, color: store.backendConnected ? S.green : S.copper, display: 'flex', alignItems: 'center', gap: 4, fontFamily: mono }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'currentColor' }} />
            {store.backendConnected ? 'CONNECTED' : 'CONNECTING'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: S.textFaint, fontFamily: mono }}>{store.messages.length} MSG</span>
          {store.currentSession && (
            <button
              onClick={async () => {
                if (confirm('Delete this session?')) {
                  await store.deleteSession(store.currentSession!.id)
                }
              }}
              style={{
                background: 'none', border: `1px solid ${S.borderMed}`, cursor: 'pointer',
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: S.textFaint, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = S.red; e.currentTarget.style.borderColor = 'rgba(192,80,80,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = S.textFaint; e.currentTarget.style.borderColor = S.borderMed as string }}
              title="Delete session"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {store.messages.length === 0 && !store.streamingText && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: S.textMuted }}>
            <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.textFaint }}>
              <Cpu size={32} strokeWidth={1} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: S.textSec, fontFamily: mono }}>IRG</div>
            <div style={{ fontSize: 12, color: S.textFaint }}>Ready to assist</div>
          </div>
        )}

        {store.messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              backgroundColor: msg.role === 'user' ? 'rgba(212,165,116,0.12)' : S.surface,
              border: `1px solid ${msg.role === 'user' ? 'rgba(212,165,116,0.25)' : S.borderMed}`,
              color: msg.role === 'user' ? S.amber : S.textSec,
            }}>
              {msg.role === 'user' ? <span style={{ fontSize: 10, fontWeight: 600, fontFamily: mono }}>U</span> : <Bot size={12} />}
            </div>
            <div style={{
              maxWidth: '65%', padding: '8px 12px', fontSize: 13, lineHeight: 1.5,
              backgroundColor: msg.role === 'user' ? 'rgba(212,165,116,0.08)' : S.surface,
              border: `1px solid ${msg.role === 'user' ? 'rgba(212,165,116,0.15)' : S.border}`,
              color: S.text,
            }}>
              {msg.role === 'user' ? msg.content : <MessageBlocks msg={msg} activeToolCalls={store.activeToolCalls} />}
            </div>
          </div>
        ))}

        {store.streamingText && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: S.surface, border: `1px solid ${S.borderMed}`, color: S.textSec }}>
              <Bot size={12} />
            </div>
            <div style={{ maxWidth: '65%', padding: '8px 12px', backgroundColor: S.surface, border: `1px solid ${S.border}`, fontSize: 13, lineHeight: 1.5, color: S.text }}>
              {store.streamingText}
              <span style={{ display: 'inline-block', width: 6, height: 13, backgroundColor: S.amber, marginLeft: 3, animation: 'blink 1s step-end infinite' }} />
            </div>
          </div>
        )}

        {store.isLoading && store.activeToolCalls.size > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: S.surface, border: `1px solid ${S.borderMed}`, color: S.textSec }}>
              <Bot size={12} />
            </div>
            <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Array.from(store.activeToolCalls.values()).map((tc) => (
                <div key={tc.toolUseId} style={{
                  padding: '5px 10px', backgroundColor: S.surface, border: `1px solid ${S.borderMed}`,
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: S.textSec, fontFamily: mono,
                }}>
                  <Loader2 size={10} color={S.amber} style={{ animation: 'spin 1s linear infinite' }} />
                  <Wrench size={10} color={S.amber} />
                  <span style={{ fontWeight: 500, color: S.text }}>{tc.toolName}</span>
                  <span style={{ color: S.textFaint }}>running...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {store.isLoading && !store.streamingText && store.activeToolCalls.size === 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: S.surface, border: `1px solid ${S.borderMed}`, color: S.textSec }}>
              <Bot size={12} />
            </div>
            <div style={{ padding: '8px 12px', backgroundColor: S.surface, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 8, color: S.textMuted, fontSize: 12, fontFamily: mono }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: S.amber }} />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 10, borderTop: `1px solid ${S.border}`, backgroundColor: S.surface }}>
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
              flex: 1, resize: 'none', border: `1px solid ${S.borderMed}`,
              padding: '8px 10px', fontSize: 13, fontFamily: sans, backgroundColor: S.bg, color: S.text,
              outline: 'none', lineHeight: 1.4, maxHeight: 120, overflowY: 'auto',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(212,165,116,0.3)'}
            onBlur={(e) => e.currentTarget.style.borderColor = S.borderMed as string}
            rows={1}
          />
          {store.isLoading ? (
            <Button onClick={() => store.cancelChat()} style={{ height: 36, width: 36, backgroundColor: S.red, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Square size={12} />
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={!store.backendConnected || !input.trim()} style={{
              height: 36, width: 36, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: store.backendConnected && input.trim() ? S.amber : S.elevated,
              color: store.backendConnected && input.trim() ? '#0c0c0c' : S.textFaint,
            }}>
              <Send size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Permission Modal */}
      {store.permissionRequest && (() => {
        const req = store.permissionRequest
        const reqType = req.requestType || 'permission'
        const handleResolve = (response: any) => { req.resolve(response); store.setPermissionRequest(null) }
        const titleMap: Record<string, string> = { permission: 'Permission Required', approval: 'Confirmation', error_choice: 'Error — Choose Action', data_input: 'Input Required' }
        const colorMap: Record<string, string> = { permission: S.amber, approval: S.amber, error_choice: S.red, data_input: S.purple }

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: S.surface, padding: 24, maxWidth: 420, width: '90%', border: `1px solid ${colorMap[reqType] || S.borderStrong}`, animation: 'slide-in-right 0.15s ease-out' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: colorMap[reqType] || S.text, fontFamily: mono, letterSpacing: '0.02em' }}>
                {titleMap[reqType] || 'Permission Required'}
              </h3>
              {reqType === 'permission' && <p style={{ fontSize: 11, color: S.textFaint, marginBottom: 8, fontFamily: mono }}>Tool: <span style={{ color: S.amber }}>{req.toolName}</span></p>}
              {req.message && <p style={{ fontSize: 13, color: S.textSec, marginBottom: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{req.message}</p>}
              {reqType === 'approval' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={() => handleResolve({ approved: false })} style={{ color: S.textMuted }}>Cancel</Button>
                  <Button onClick={() => handleResolve({ approved: true })} style={{ backgroundColor: S.amber, color: '#0c0c0c' }}>Confirm</Button>
                </div>
              )}
              {reqType === 'error_choice' && req.options && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {req.options.map((opt) => {
                    const optColors: Record<string, string> = { retry: S.amber, skip: S.textSec, abort: S.red }
                    return <Button key={opt} onClick={() => handleResolve({ approved: true, choice: opt })} style={{ backgroundColor: optColors[opt] || S.textFaint, color: '#0c0c0c', textTransform: 'capitalize', fontFamily: mono, fontSize: 11 }}>{opt}</Button>
                  })}
                </div>
              )}
              {reqType === 'data_input' && req.schema && <DataInputForm schema={req.schema} onSubmit={(data) => handleResolve({ approved: true, data })} onCancel={() => handleResolve({ approved: false })} />}
              {reqType === 'permission' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={() => handleResolve({ approved: false })} style={{ color: S.textMuted }}>Deny</Button>
                  <Button onClick={() => handleResolve({ approved: true })} style={{ backgroundColor: S.amber, color: '#0c0c0c' }}>Allow</Button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

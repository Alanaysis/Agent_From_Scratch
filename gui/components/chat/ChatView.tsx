'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Send, Bot, Loader2, ArrowLeft, Square, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Wrench, Cpu, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Message, MessageBlock, ToolCallEvent } from '@/types'

// Simple markdown renderer (no external dependency)
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [text]

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Code block (```)
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre key={`code-${elements.length}`} style={{
          backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
          padding: '8px 10px', margin: '4px 0', overflow: 'auto',
          fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.5,
          borderRadius: 2,
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Heading (#)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1]!.length
      const Tag = `h${level}` as keyof JSX.IntrinsicElements
      const sizes: Record<number, number> = { 1: 18, 2: 16, 3: 14, 4: 13, 5: 12, 6: 11 }
      elements.push(
        <Tag key={`h-${elements.length}`} style={{
          fontSize: sizes[level] || 12, fontWeight: 600,
          color: 'var(--text-primary)', margin: '8px 0 4px',
        }}>{headingMatch[2]}</Tag>
      )
      i++
      continue
    }

    // Unordered list (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        listItems.push(lines[i]!.replace(/^\s*[-*]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '4px 0', paddingLeft: 20 }}>
          {listItems.map((item, j) => (
            <li key={j} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 2 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list (1. 2. etc)
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        listItems.push(lines[i]!.replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${elements.length}`} style={{ margin: '4px 0', paddingLeft: 20 }}>
          {listItems.map((item, j) => (
            <li key={j} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 2 }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${elements.length}`} style={{ height: 4 }} />)
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${elements.length}`} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '2px 0' }}>
        {renderInline(line)}
      </p>
    )
    i++
  }

  return elements
}

// Render inline markdown (bold, italic, code, links)
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      parts.push(
        <code key={key++} style={{
          backgroundColor: 'var(--surface-2)', padding: '1px 4px',
          fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
          border: '1px solid var(--border-subtle)', borderRadius: 2,
        }}>{codeMatch[1]}</code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Bold (**text**)
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      parts.push(<strong key={key++} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic (*text*)
    const italicMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--amber)', textDecoration: 'underline' }}
        >{linkMatch[1]}</a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // Regular text (until next special char)
    const nextSpecial = remaining.search(/[`*\[]/)
    if (nextSpecial === -1) {
      parts.push(remaining)
      break
    } else if (nextSpecial === 0) {
      // Special char that didn't match any pattern, skip it
      parts.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      parts.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

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
  green: 'var(--status-green)',
  red: 'var(--warm-red)',
  purple: 'var(--status-purple)',
}

const mono = 'IBM Plex Mono, monospace'
const sans = 'IBM Plex Sans, sans-serif'

function ToolCallCard({ block, activeCall }: { block: MessageBlock & { type: 'tool_use' }; activeCall?: ToolCallEvent }) {
  const [expanded, setExpanded] = React.useState(false)
  const status = activeCall?.status ?? block.status ?? 'pending'
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
  if (!msg.blocks || msg.blocks.length === 0) {
    // No blocks — render content as markdown
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{renderMarkdown(msg.content || '')}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {msg.blocks.map((block, i) => {
        const key = block.type === 'tool_use' || block.type === 'tool_result' ? `${block.type}-${block.toolUseId}` : `${block.type}-${i}`
        if (block.type === 'text') {
          if (!block.text) return null
          return <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{renderMarkdown(block.text)}</div>
        }
        if (block.type === 'image') {
          return <img key={key} src={`data:${block.mimeType};base64,${block.data}`} alt="uploaded" style={{ maxWidth: 300, maxHeight: 200, borderRadius: 6, border: '1px solid var(--border)' }} />
        }
        if (block.type === 'tool_use') {
          const activeCall = activeToolCalls.get(block.toolUseId)
          return <ToolCallCard key={key} block={block} activeCall={activeCall} />
        }
        if (block.type === 'tool_result') {
          return (
            <div key={key} style={{
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

// Agent definitions for autocomplete
const AGENTS = [
  { name: 'general-purpose', desc: 'General purpose agent' },
  { name: 'explore', desc: 'Code exploration agent' },
  { name: 'plan', desc: 'Planning agent' },
  { name: 'reflect', desc: 'Reflection agent' },
  { name: 'pm', desc: 'Project manager agent' },
  { name: 'grpc-worker', desc: 'gRPC execution agent' },
]

export function ChatView() {
  const store = useAppStore()
  const [input, setInput] = React.useState('')
  const [pendingImages, setPendingImages] = React.useState<Array<{ data: string; mimeType: string; preview: string }>>([])
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const [, setTick] = React.useState(0)

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = React.useState(false)
  const [autocompleteType, setAutocompleteType] = React.useState<'agent' | 'skill' | null>(null)
  const [autocompleteQuery, setAutocompleteQuery] = React.useState('')
  const [autocompleteIndex, setAutocompleteIndex] = React.useState(0)
  const [skills, setSkills] = React.useState<Array<{ name: string; desc: string }>>([])

  // Load skills from backend on mount
  React.useEffect(() => {
    store.sendToBackend('skills:list', {}).then((result: any) => {
      if (result?.skills) {
        setSkills(result.skills.map((s: any) => ({
          name: s.name || 'unknown',
          desc: s.frontmatter?.description || s.content?.slice(0, 80) || '',
        })))
      }
    }).catch(() => {})
  }, [])

  // Get filtered autocomplete items
  const autocompleteItems = React.useMemo(() => {
    if (!autocompleteType) return []
    const items = autocompleteType === 'agent' ? AGENTS : skills
    if (!autocompleteQuery) return items
    return items.filter(item =>
      item.name.toLowerCase().includes(autocompleteQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(autocompleteQuery.toLowerCase())
    )
  }, [autocompleteType, autocompleteQuery, skills])

  React.useEffect(() => { useAppStore.getState().initBackendConnection() }, [])
  React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [store.messages.length, store.streamingText])
  React.useEffect(() => { if (store.backendConnected) inputRef.current?.focus() }, [store.backendConnected, store.messages.length])

  // Handle paste — detect images in clipboard
  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return

    e.preventDefault()
    for (const item of imageItems) {
      const blob = item.getAsFile()
      if (!blob) continue
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1] || ''
        const mimeType = blob.type || 'image/png'
        setPendingImages(prev => [...prev, { data: base64, mimeType, preview: dataUrl }])
      }
      reader.readAsDataURL(blob)
    }
  }, [])

  const removePendingImage = React.useCallback((index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Handle input change with autocomplete detection
  const handleInputChange = React.useCallback((value: string) => {
    setInput(value)

    // Check for @ or / at the start of input
    const agentMatch = value.match(/^@([\w-]*)$/)
    const skillMatch = value.match(/^\/([\w-]*)$/)

    if (agentMatch) {
      setAutocompleteType('agent')
      setAutocompleteQuery(agentMatch[1] || '')
      setAutocompleteIndex(0)
      setShowAutocomplete(true)
    } else if (skillMatch) {
      setAutocompleteType('skill')
      setAutocompleteQuery(skillMatch[1] || '')
      setAutocompleteIndex(0)
      setShowAutocomplete(true)
    } else {
      setShowAutocomplete(false)
      setAutocompleteType(null)
    }
  }, [])

  // Select an autocomplete item
  const selectAutocompleteItem = React.useCallback((item: { name: string; desc: string }) => {
    const prefix = autocompleteType === 'agent' ? '@' : '/'
    setInput(prefix + item.name + ' ')
    setShowAutocomplete(false)
    setAutocompleteType(null)
    inputRef.current?.focus()
  }, [autocompleteType])

  const handleSend = async () => {
    if ((!input.trim() && pendingImages.length === 0) || !store.backendConnected) return
    const text = input.trim()
    const images = pendingImages.map(img => ({ data: img.data, mimeType: img.mimeType }))
    setInput('')
    setPendingImages([])
    try {
      if (images.length > 0) {
        await store.sendChatMessage({ text, images }, store.currentSession?.id ?? undefined)
      } else {
        await store.sendChatMessage(text, store.currentSession?.id ?? undefined)
      }
    } catch (e) { console.error('[ChatView] send error:', e) }
    setTick(t => t + 1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle autocomplete navigation
    if (showAutocomplete && autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIndex(prev => Math.min(prev + 1, autocompleteItems.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectAutocompleteItem(autocompleteItems[autocompleteIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowAutocomplete(false)
        return
      }
    }

    // Normal send
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: S.bg, color: S.text, fontFamily: sans }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 10, backgroundColor: S.surface }}>
        {/* Back button — only when navigated from another page */}
        {store.previousViewMode && (
          <Button
            variant="ghost" size="icon"
            onClick={() => store.goBack()}
            title={`Back to ${store.previousViewMode}`}
            style={{ width: 26, height: 26 }}
          >
            <ArrowLeft size={14} color={S.textSec} />
          </Button>
        )}
        {/* New chat button */}
        <Button
          variant="ghost" size="icon"
          onClick={() => store.newChat()}
          title="New chat"
          style={{ width: 26, height: 26 }}
        >
          <Plus size={14} color={S.textSec} />
        </Button>
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: S.textFaint, fontFamily: mono }}>{store.messages.length} MSG</span>
          {store.currentSession && (
            <button
              data-testid="delete-session"
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
      <div data-testid="chat-messages" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {store.messages.length === 0 && !store.streamingText && (
          <div data-testid="empty-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: S.textMuted }}>
            <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.textFaint }}>
              <Cpu size={32} strokeWidth={1} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: S.textSec, fontFamily: mono }}>IRG</div>
            <div style={{ fontSize: 12, color: S.textFaint }}>Ready to assist</div>
          </div>
        )}

        {store.messages.map((msg) => (
          <div key={msg.id} data-testid={`message-${msg.role}`} style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
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
              {msg.role === 'user' ? (
                <div>
                  {msg.blocks && msg.blocks.some(b => b.type === 'image') && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: msg.content ? 6 : 0 }}>
                      {msg.blocks.filter(b => b.type === 'image').map((b, i) => (
                        <img
                          key={i}
                          src={`data:${b.mimeType};base64,${b.data}`}
                          alt={`Image ${i + 1}`}
                          style={{ maxWidth: 200, maxHeight: 200, borderRadius: 4, border: `1px solid ${S.borderMed}` }}
                        />
                      ))}
                    </div>
                  )}
                  {msg.content && <span>{msg.content}</span>}
                </div>
              ) : <MessageBlocks msg={msg} activeToolCalls={store.activeToolCalls} />}
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
          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '6px 10px', flexWrap: 'wrap' }}>
              {pendingImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={img.preview} alt={`Pasted ${i + 1}`} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: `1px solid ${S.borderMed}` }} />
                  <button
                    onClick={() => removePendingImage(i)}
                    style={{
                      position: 'absolute', top: -4, right: -4, width: 16, height: 16,
                      borderRadius: '50%', backgroundColor: S.red, border: 'none',
                      color: '#fff', fontSize: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Autocomplete dropdown */}
            {showAutocomplete && autocompleteItems.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                marginBottom: 4, maxHeight: 200, overflowY: 'auto',
                backgroundColor: S.surface, border: `1px solid ${S.borderMed}`,
                boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                zIndex: 100,
              }}>
                <div style={{
                  padding: '4px 8px', fontSize: 9, color: S.textFaint,
                  fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.1em',
                  borderBottom: `1px solid ${S.border}`,
                }}>
                  {autocompleteType === 'agent' ? 'Agents' : 'Skills'} — ↑↓ navigate, Enter select, Esc dismiss
                </div>
                {autocompleteItems.map((item, i) => (
                  <div
                    key={item.name}
                    onClick={() => selectAutocompleteItem(item)}
                    style={{
                      padding: '6px 10px', cursor: 'pointer',
                      backgroundColor: i === autocompleteIndex ? S.elevated : 'transparent',
                      borderLeft: i === autocompleteIndex ? `2px solid ${S.amber}` : '2px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={() => setAutocompleteIndex(i)}
                  >
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: i === autocompleteIndex ? S.amber : S.text,
                      fontFamily: mono,
                    }}>
                      {autocompleteType === 'agent' ? '@' : '/'}{item.name}
                    </span>
                    <span style={{ fontSize: 11, color: S.textMuted }}>{item.desc}</span>
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={inputRef}
              data-testid="chat-input"
              value={input}
              onChange={(e) => {
                handleInputChange(e.target.value)
                // Auto-resize textarea
                const el = e.target
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={store.backendConnected ? 'Type @agent or /skill... (paste images with Ctrl+V)' : 'Not connected'}
              disabled={!store.backendConnected}
              autoFocus
              style={{
                width: '100%', resize: 'none', border: `1px solid ${S.borderMed}`,
                padding: '8px 10px', fontSize: 13, fontFamily: sans, backgroundColor: S.bg, color: S.text,
                outline: 'none', lineHeight: 1.4, maxHeight: 160, overflowY: 'auto',
                minHeight: 36,
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(212,165,116,0.3)'}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = S.borderMed as string
                // Delay hiding autocomplete to allow click
                setTimeout(() => setShowAutocomplete(false), 200)
              }}
              rows={1}
            />
          </div>
          {store.isLoading ? (
            <Button data-testid="chat-stop" onClick={() => store.cancelChat()} style={{ height: 36, width: 36, backgroundColor: S.red, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Square size={12} />
            </Button>
          ) : (
            <Button data-testid="chat-send" onClick={handleSend} disabled={!store.backendConnected || !input.trim()} style={{
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
          <div data-testid="permission-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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
                  <Button variant="ghost" data-testid="permission-deny" onClick={() => handleResolve({ approved: false })} style={{ color: S.textMuted }}>Deny</Button>
                  <Button data-testid="permission-allow" onClick={() => handleResolve({ approved: true })} style={{ backgroundColor: S.amber, color: '#0c0c0c' }}>Allow</Button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Send, Bot, Loader2 } from 'lucide-react'

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
    store.setLoading(true)
    store.addMessage({ role: 'user', content })
    try {
      await store.sendChatMessage(content, store.currentSession?.id ?? undefined)
    } finally {
      store.setLoading(false)
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#000', color: '#fff' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>IRG</div>
          <div style={{ fontSize: 12, color: store.backendConnected ? '#22c55e' : '#f97316' }}>
            {store.backendConnected ? '● Connected' : '○ Connecting...'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>
          {store.messages.length} messages
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {store.messages.length === 0 && !store.streamingText && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <Bot size={32} color="#888" />
            <div style={{ fontSize: 18, fontWeight: 600 }}>IRG</div>
            <div style={{ color: '#888' }}>Ready to assist</div>
          </div>
        )}

        {store.messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex',
            gap: 12,
            marginBottom: 12,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#333',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600
            }}>
              {msg.role === 'user' ? 'U' : <Bot size={16} color="#fff" />}
            </div>
            <div style={{
              maxWidth: '70%', borderRadius: 8, padding: '8px 12px',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#222',
              fontSize: 14
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {store.streamingText && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={16} color="#fff" />
            </div>
            <div style={{ maxWidth: '70%', borderRadius: 8, padding: '8px 12px', backgroundColor: '#222', fontSize: 14 }}>
              {store.streamingText}
            </div>
          </div>
        )}

        {store.isLoading && !store.streamingText && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={16} color="#fff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 14 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #333' }}>
        <div style={{ display: 'flex', gap: 8 }}>
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
              borderRadius: 8,
              border: '1px solid #333',
              padding: '8px 12px',
              fontSize: 14,
              backgroundColor: '#111',
              color: '#fff',
              outline: 'none'
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!store.backendConnected || !input.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: store.backendConnected && input.trim() ? '#3b82f6' : '#222',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: store.backendConnected && input.trim() ? 'pointer' : 'not-allowed',
              opacity: store.backendConnected && input.trim() ? 1 : 0.5
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
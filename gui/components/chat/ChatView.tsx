'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Send, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a', color: '#fff' }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#111'
      }}>
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
          <div style={{ fontWeight: 600, fontSize: 14 }}>IRG</div>
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
              {msg.content}
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

        {store.isLoading && !store.streamingText && (
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
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
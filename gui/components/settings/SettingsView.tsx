'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Bot, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

const providers = ['openai', 'anthropic'] as const

export function SettingsView() {
  const store = useAppStore()
  const [provider, setProvider] = React.useState('openai')
  const [apiKey, setApiKey] = React.useState('')
  const [model, setModel] = React.useState('')
  const [baseUrl, setBaseUrl] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (store.backendConnected && !store.llmConfig) {
      store.loadConfig()
    }
  }, [store.backendConnected, store.llmConfig, store.loadConfig])

  React.useEffect(() => {
    if (store.llmConfig) {
      setProvider(store.llmConfig.provider)
      setApiKey(store.llmConfig.apiKey)
      setModel(store.llmConfig.model)
      setBaseUrl(store.llmConfig.baseUrl)
    }
  }, [store.llmConfig])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await store.setLlmConfig({
        provider: provider as 'openai' | 'anthropic',
        apiKey,
        model,
        baseUrl,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Failed to save config:', e)
    } finally {
      setSaving(false)
    }
  }

  console.log('[SettingsView] Render:', { backendConnected: store.backendConnected, llmConfig: !!store.llmConfig })

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, backgroundColor: '#000', color: '#fff' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={24} />
          Settings
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#111', borderRadius: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Connection Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {store.backendConnected ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                <span style={{ fontSize: 14, color: '#22c55e' }}>Connected</span>
              </>
            ) : (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span style={{ fontSize: 14, color: '#ef4444' }}>Disconnected</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={{ height: 40, padding: '0 12px', borderRadius: 6, border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: 14 }}
            >
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{ height: 40, padding: '0 12px', borderRadius: 6, border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: 14 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4, claude-3-opus, etc."
              style={{ height: 40, padding: '0 12px', borderRadius: 6, border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: 14 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 500 }}>Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              style={{ height: 40, padding: '0 12px', borderRadius: 6, border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: 14 }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!store.backendConnected || saving}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 6,
              backgroundColor: store.backendConnected && !saving ? '#3b82f6' : '#222',
              color: '#fff',
              fontWeight: 500,
              cursor: store.backendConnected && !saving ? 'pointer' : 'not-allowed',
              opacity: store.backendConnected ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: 'none'
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 size={16} />
                Saved!
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>

        <div style={{ paddingTop: 32, fontSize: 14, color: '#666' }}>
          <p>IRG v0.1.0</p>
          <p>A lightweight, modular agentic framework</p>
        </div>
      </div>
      
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
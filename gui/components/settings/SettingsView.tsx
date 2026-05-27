'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { Bot, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AgentsView } from './AgentsView'

const providers = ['openai', 'anthropic'] as const
type Tab = 'llm' | 'agents'

export function SettingsView() {
  const store = useAppStore()
  const [activeTab, setActiveTab] = React.useState<Tab>('llm')
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
  }, [store.backendConnected, store.llmConfig])

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

  const renderLLMTab = () => (
    <div style={{
      maxWidth: 520,
      margin: '0 auto',
      padding: 24
    }}>
      <div style={{ marginBottom: 24 }}>
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
            backgroundColor: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #1a1a1a'
          }}>
            <Bot size={18} />
          </div>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: '#666' }}>Configure your LLM provider</p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        backgroundColor: '#111',
        borderRadius: 10,
        border: '1px solid #1a1a1a',
        marginBottom: 20
      }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Connection Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: store.backendConnected ? '#22c55e' : '#ef4444'
          }} />
          <span style={{
            fontSize: 12,
            color: store.backendConnected ? '#22c55e' : '#ef4444',
            fontWeight: 500
          }}>
            {store.backendConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backgroundColor: '#111',
        borderRadius: 12,
        border: '1px solid #1a1a1a',
        padding: 20
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>Provider</Label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #222',
              backgroundColor: '#0a0a0a',
              color: '#fff',
              fontSize: 13
            }}
          >
            {providers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{
              height: 38,
              fontSize: 13,
              backgroundColor: '#0a0a0a',
              border: '1px solid #222'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>Model</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4, claude-3-opus, etc."
            style={{
              height: 38,
              fontSize: 13,
              backgroundColor: '#0a0a0a',
              border: '1px solid #222'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            style={{
              height: 38,
              fontSize: 13,
              backgroundColor: '#0a0a0a',
              border: '1px solid #222'
            }}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={!store.backendConnected || saving}
          style={{
            height: 38,
            marginTop: 4,
            backgroundColor: store.backendConnected && !saving ? '#3b82f6' : '#1a1a1a',
            border: 'none'
          }}
        >
          {saving ? (
            <>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 size={14} />
              Saved!
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </div>

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #1a1a1a' }}>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>IRG v0.1.0</p>
        <p style={{ fontSize: 11, color: '#444' }}>A lightweight, modular agentic framework</p>
      </div>
    </div>
  )

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      backgroundColor: '#0a0a0a',
      color: '#fff'
    }}>
      <div style={{
        borderBottom: '1px solid #1a1a1a',
        padding: '0 24px',
        display: 'flex',
        gap: 24
      }}>
        <button
          onClick={() => setActiveTab('llm')}
          style={{
            padding: '12px 0',
            background: 'none',
            border: 'none',
            color: activeTab === 'llm' ? '#fff' : '#666',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            borderBottom: activeTab === 'llm' ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: -1
          }}
        >
          LLM Configuration
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          style={{
            padding: '12px 0',
            background: 'none',
            border: 'none',
            color: activeTab === 'agents' ? '#fff' : '#666',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            borderBottom: activeTab === 'agents' ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: -1
          }}
        >
          Agents
        </button>
      </div>

      {activeTab === 'llm' && renderLLMTab()}
      {activeTab === 'agents' && <AgentsView />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
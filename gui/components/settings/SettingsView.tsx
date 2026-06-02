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
      padding: 24,
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 18,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 4,
          color: 'var(--text-primary)',
          fontFamily: 'IBM Plex Mono, monospace',
          letterSpacing: '0.02em',
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 2,
            backgroundColor: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-medium)',
          }}>
            <Bot size={18} style={{ color: 'var(--amber)' }} />
          </div>
          Settings
        </h1>
        <p style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}>Configure your LLM provider</p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        backgroundColor: 'var(--surface-1)',
        borderRadius: 2,
        border: '1px solid var(--border-subtle)',
        marginBottom: 20,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          fontFamily: 'IBM Plex Mono, monospace',
        }}>Connection Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: store.backendConnected ? '#5cb85c' : 'var(--warm-red)',
          }} />
          <span style={{
            fontSize: 12,
            color: store.backendConnected ? '#5cb85c' : 'var(--warm-red)',
            fontWeight: 500,
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            {store.backendConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backgroundColor: 'var(--surface-1)',
        borderRadius: 2,
        border: '1px solid var(--border-subtle)',
        padding: 20,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>Provider</Label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 0,
              border: '1px solid var(--border-medium)',
              backgroundColor: 'var(--surface-0)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'IBM Plex Sans, sans-serif',
              outline: 'none',
            }}
          >
            {providers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{
              height: 36,
              fontSize: 13,
              backgroundColor: 'var(--surface-0)',
              border: '1px solid var(--border-medium)',
              borderRadius: 0,
              color: 'var(--text-primary)',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>Model</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4, claude-3-opus, etc."
            style={{
              height: 36,
              fontSize: 13,
              backgroundColor: 'var(--surface-0)',
              border: '1px solid var(--border-medium)',
              borderRadius: 0,
              color: 'var(--text-primary)',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            style={{
              height: 36,
              fontSize: 13,
              backgroundColor: 'var(--surface-0)',
              border: '1px solid var(--border-medium)',
              borderRadius: 0,
              color: 'var(--text-primary)',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={!store.backendConnected || saving}
          style={{
            height: 36,
            marginTop: 4,
            backgroundColor: store.backendConnected && !saving ? 'var(--amber)' : 'var(--surface-2)',
            border: '1px solid ' + (store.backendConnected && !saving ? 'var(--amber)' : 'var(--border-subtle)'),
            borderRadius: 0,
            color: store.backendConnected && !saving ? '#000' : 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: store.backendConnected && !saving ? 'pointer' : 'default',
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

      <div style={{
        marginTop: 32,
        paddingTop: 20,
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <p style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          marginBottom: 4,
          fontFamily: 'IBM Plex Mono, monospace',
        }}>IRG v0.1.0</p>
        <p style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}>A lightweight, modular agentic framework</p>
      </div>
    </div>
  )

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      backgroundColor: 'var(--surface-0)',
      color: 'var(--text-primary)',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 24px',
        display: 'flex',
        gap: 24,
      }}>
        <button
          onClick={() => setActiveTab('llm')}
          style={{
            padding: '12px 0',
            background: 'none',
            border: 'none',
            color: activeTab === 'llm' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            borderBottom: activeTab === 'llm' ? '2px solid var(--amber)' : '2px solid transparent',
            marginBottom: -1,
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.02em',
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
            color: activeTab === 'agents' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            borderBottom: activeTab === 'agents' ? '2px solid var(--amber)' : '2px solid transparent',
            marginBottom: -1,
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.02em',
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

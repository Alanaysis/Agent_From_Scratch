'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { pixelAvatarToDataUrl, getAgentColor } from '@/lib/pixelAvatar'
import { Bot, Loader2, Wifi, WifiOff } from 'lucide-react'
import type { AgentPresence } from '@/types'

const statusConfig = {
  idle: { color: 'var(--text-muted)', label: 'Idle', animate: false },
  thinking: { color: 'var(--amber)', label: 'Thinking', animate: true },
  running: { color: '#3b82f6', label: 'Working', animate: true },
  waiting: { color: '#7b68c0', label: 'Waiting', animate: false },
  error: { color: 'var(--warm-red)', label: 'Error', animate: false },
} as const

function AgentCard({ presence }: { presence: AgentPresence }) {
  const cfg = statusConfig[presence.status]
  const avatarUrl = pixelAvatarToDataUrl(presence.agentName, 40)
  const agentColor = getAgentColor(presence.agentName)
  const timeSince = Date.now() - presence.lastSeen
  const isStale = timeSince > 5 * 60 * 1000 // 5 minutes

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 0,
      backgroundColor: 'var(--surface-0)',
      border: `1px solid ${isStale ? 'var(--border-subtle)' : agentColor + '33'}`,
      opacity: isStale ? 0.5 : 1,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={avatarUrl}
          alt={presence.agentName}
          style={{
            width: 32,
            height: 32,
            borderRadius: 0,
            display: 'block',
          }}
        />
        {/* Status dot */}
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 8,
          height: 8,
          borderRadius: 0,
          backgroundColor: cfg.color,
          border: '2px solid var(--surface-0)',
          animation: cfg.animate ? 'pulse 2s ease-in-out infinite' : 'none',
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 2,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}>
            {presence.agentName}
          </span>
          {cfg.animate && (
            <Loader2
              size={10}
              color={cfg.color}
              style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
            />
          )}
        </div>

        <div style={{
          fontSize: 10,
          color: cfg.color,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'IBM Plex Mono, monospace',
        }}>
          <span>{cfg.label}</span>
          {presence.currentTask && (
            <>
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              <span style={{
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {presence.currentTask}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function PresencePanel() {
  const agentPresences = useAppStore((s) => s.agentPresences)
  const backendConnected = useAppStore((s) => s.backendConnected)

  const activeAgents = agentPresences.filter(p => {
    const timeSince = Date.now() - p.lastSeen
    return timeSince < 10 * 60 * 1000 // active within 10 minutes
  })

  const staleAgents = agentPresences.filter(p => {
    const timeSince = Date.now() - p.lastSeen
    return timeSince >= 10 * 60 * 1000
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: 4,
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      {/* Connection status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        fontSize: 10,
        color: backendConnected ? '#5cb85c' : 'var(--warm-red)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {backendConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
        <span>{backendConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {agentPresences.length === 0 ? (
        <div style={{
          padding: '16px 8px',
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: 11,
        }}>
          <Bot size={20} color="var(--text-faint)" style={{ margin: '0 auto 6px', opacity: 0.4 }} />
          <div>No agents active</div>
        </div>
      ) : (
        <>
          {activeAgents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activeAgents.map((p) => (
                <AgentCard key={p.agentId} presence={p} />
              ))}
            </div>
          )}

          {staleAgents.length > 0 && (
            <>
              <div style={{
                fontSize: 9,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '6px 8px 2px',
                fontFamily: 'IBM Plex Mono, monospace',
              }}>
                Recently Active
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.5 }}>
                {staleAgents.map((p) => (
                  <AgentCard key={p.agentId} presence={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

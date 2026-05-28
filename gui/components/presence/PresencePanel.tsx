'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { pixelAvatarToDataUrl, getAgentColor } from '@/lib/pixelAvatar'
import { Bot, Loader2, Wifi, WifiOff } from 'lucide-react'
import type { AgentPresence } from '@/types'

const statusConfig = {
  idle: { color: '#666', label: 'Idle', animate: false },
  thinking: { color: '#f59e0b', label: 'Thinking', animate: true },
  running: { color: '#3b82f6', label: 'Working', animate: true },
  waiting: { color: '#a855f7', label: 'Waiting', animate: false },
  error: { color: '#ef4444', label: 'Error', animate: false },
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
      borderRadius: 8,
      backgroundColor: '#0d0d0d',
      border: `1px solid ${isStale ? '#1a1a1a' : agentColor + '33'}`,
      opacity: isStale ? 0.5 : 1,
      transition: 'all 0.2s',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={avatarUrl}
          alt={presence.agentName}
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            display: 'block',
          }}
        />
        {/* Status dot */}
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: cfg.color,
          border: '2px solid #0d0d0d',
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
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
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
        }}>
          <span>{cfg.label}</span>
          {presence.currentTask && (
            <>
              <span style={{ color: '#444' }}>·</span>
              <span style={{
                color: '#888',
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
      gap: 6,
      padding: 4,
    }}>
      {/* Connection status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        fontSize: 10,
        color: backendConnected ? '#22c55e' : '#ef4444',
      }}>
        {backendConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
        <span>{backendConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {agentPresences.length === 0 ? (
        <div style={{
          padding: '16px 8px',
          textAlign: 'center',
          color: '#444',
          fontSize: 11,
        }}>
          <Bot size={20} color="#333" style={{ margin: '0 auto 6px' }} />
          <div>No agents active</div>
        </div>
      ) : (
        <>
          {activeAgents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeAgents.map((p) => (
                <AgentCard key={p.agentId} presence={p} />
              ))}
            </div>
          )}

          {staleAgents.length > 0 && (
            <>
              <div style={{
                fontSize: 9,
                color: '#444',
                textTransform: 'uppercase',
                letterSpacing: 1,
                padding: '4px 8px 0',
              }}>
                Recently Active
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.6 }}>
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

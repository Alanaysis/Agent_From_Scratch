'use client'

import { useAppStore } from '@/lib/store'
import { PresencePanel } from '@/components/presence/PresencePanel'
import type { ViewMode } from '@/types'

const navItems: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'kanban', label: 'Tasks', icon: '📋' },
  { id: 'sessions', label: 'Sessions', icon: '📁' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export function Sidebar() {
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)

  return (
    <aside style={{
      width: 220,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #222',
      backgroundColor: '#111'
    }}>
      {/* Logo */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: -0.5,
          }}>
            IR
          </div>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>IRG</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          const isActive = viewMode === item.id
          return (
            <button
              key={item.id}
              onClick={() => setViewMode(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                backgroundColor: isActive ? '#3b82f6' : 'transparent',
                color: isActive ? '#fff' : '#888',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#1a1a1a'
                  e.currentTarget.style.color = '#ccc'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#888'
                }
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Agent Presence */}
      <div style={{
        borderTop: '1px solid #222',
        maxHeight: 260,
        overflow: 'auto',
      }}>
        <div style={{
          fontSize: 9,
          color: '#444',
          textTransform: 'uppercase',
          letterSpacing: 1,
          padding: '10px 12px 4px',
          fontWeight: 600,
        }}>
          Agents
        </div>
        <PresencePanel />
      </div>
    </aside>
  )
}

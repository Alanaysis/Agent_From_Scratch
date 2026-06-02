'use client'

import { useAppStore } from '@/lib/store'
import { PresencePanel } from '@/components/presence/PresencePanel'
import { MessageSquare, KanbanSquare, FileText, FileStack, FolderOpen, Settings, Cpu } from 'lucide-react'
import type { ViewMode } from '@/types'

const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'chat', label: 'Chat', icon: <MessageSquare size={16} /> },
  { id: 'kanban', label: 'Tasks', icon: <KanbanSquare size={16} /> },
  { id: 'proposals', label: 'Proposals', icon: <FileText size={16} /> },
  { id: 'documents', label: 'Documents', icon: <FileStack size={16} /> },
  { id: 'sessions', label: 'Sessions', icon: <FolderOpen size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
]

export function Sidebar() {
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)

  return (
    <aside style={{
      width: 200,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--surface-1)',
      position: 'relative',
      zIndex: 2,
    }}>
      {/* Logo */}
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--amber)',
        }}>
          <Cpu size={20} strokeWidth={1.5} />
        </div>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--text-primary)',
          letterSpacing: '0.05em',
        }}>
          IRG
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--amber)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'IBM Plex Sans, sans-serif',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.backgroundColor = 'var(--surface-2)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 4,
                  bottom: 4,
                  width: 2,
                  backgroundColor: 'var(--amber)',
                  borderRadius: '0 1px 1px 0',
                }} />
              )}
              <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.7 }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Agent Presence */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        maxHeight: 260,
        overflow: 'auto',
      }}>
        <div style={{
          fontSize: 9,
          fontFamily: 'IBM Plex Mono, monospace',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '10px 16px 4px',
          fontWeight: 600,
        }}>
          Agents
        </div>
        <PresencePanel />
      </div>
    </aside>
  )
}

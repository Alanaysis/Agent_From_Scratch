'use client'

import * as React from 'react'
import { useAppStore } from '@/lib/store'
import { PresencePanel } from '@/components/presence/PresencePanel'
import { MessageSquare, KanbanSquare, FileText, FileStack, FolderOpen, Settings, Cpu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { ViewMode } from '@/types'

const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'chat', label: 'Chat', icon: <MessageSquare size={16} /> },
  { id: 'kanban', label: 'Tasks', icon: <KanbanSquare size={16} /> },
  { id: 'proposals', label: 'Proposals', icon: <FileText size={16} /> },
  { id: 'documents', label: 'Docs', icon: <FileStack size={16} /> },
  { id: 'sessions', label: 'Sessions', icon: <FolderOpen size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
]

export function Sidebar() {
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const [collapsed, setCollapsed] = React.useState(false)

  // Auto-collapse when window is narrow
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setCollapsed(true)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const sidebarWidth = collapsed ? 44 : 160

  return (
    <aside style={{
      width: sidebarWidth,
      minWidth: sidebarWidth,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--surface-1)',
      position: 'relative',
      zIndex: 1,
      transition: 'width 0.2s ease, min-width 0.2s ease',
    }}>
      {/* Logo + Collapse Toggle */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '8px 0 4px' : '8px 12px 4px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {/* Logo row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: collapsed ? 0 : 10,
          width: '100%',
          marginBottom: 4,
        }}>
          <div style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--amber)',
          }}>
            <Cpu size={collapsed ? 18 : 20} strokeWidth={1.5} />
          </div>
          {!collapsed && (
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--text-primary)',
              letterSpacing: '0.05em',
            }}>
              IRG
            </span>
          )}
        </div>
        {/* Collapse button below */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4,
            display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 4,
            justifyContent: 'center',
            transition: 'color 0.15s',
            fontSize: 9, fontFamily: 'IBM Plex Mono, monospace',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {navItems.map((item) => {
          const isActive = viewMode === item.id
          return (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              data-active={isActive ? 'true' : undefined}
              onClick={() => setViewMode(item.id)}
              className="sidebar-nav-item"
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '8px 0' : '8px 16px',
                backgroundColor: isActive ? 'var(--surface-2)' : 'transparent',
                color: isActive ? 'var(--amber)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'IBM Plex Sans, sans-serif',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'color 0.15s, background-color 0.15s',
                position: 'relative',
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
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Agent Presence */}
      {!collapsed && (
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
      )}
    </aside>
  )
}

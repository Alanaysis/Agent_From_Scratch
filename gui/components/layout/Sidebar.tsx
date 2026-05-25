'use client'

import { useAppStore } from '@/lib/store'
import type { ViewMode } from '@/types'

const navItems: { id: ViewMode; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'kanban', label: 'Tasks' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'settings', label: 'Settings' },
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
          <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            IR
          </div>
          <span style={{ fontWeight: 600, color: '#fff' }}>IRG</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 8 }}>
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
                gap: 12,
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 4,
                backgroundColor: isActive ? '#3b82f6' : 'transparent',
                color: isActive ? '#fff' : '#888',
                fontSize: 14,
                fontWeight: isActive ? 500 : 400,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span style={{ fontSize: 16 }}>{item.label === 'Chat' ? '💬' : item.label === 'Tasks' ? '📋' : item.label === 'Sessions' ? '📁' : '⚙️'}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
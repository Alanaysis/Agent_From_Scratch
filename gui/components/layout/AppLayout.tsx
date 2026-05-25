'use client'

import { useAppStore } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { ChatView, SettingsView } from './Views'

export function AppLayout() {
  const viewMode = useAppStore((s) => s.viewMode)

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#000' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'settings' ? <SettingsView /> : <ChatView />}
      </main>
    </div>
  )
}
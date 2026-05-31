'use client'

import { useAppStore } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { ChatView, SettingsView, ProposalView, DocumentsView } from './Views'
import { KanbanView } from '@/components/kanban/KanbanView'
import { SessionsView } from '@/components/sessions/SessionsView'

export function AppLayout() {
  const viewMode = useAppStore((s) => s.viewMode)

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#000' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {viewMode === 'settings' && <SettingsView />}
        {viewMode === 'chat' && <ChatView />}
        {viewMode === 'kanban' && <KanbanView />}
        {viewMode === 'sessions' && <SessionsView />}
        {viewMode === 'proposals' && <ProposalView />}
        {viewMode === 'documents' && <DocumentsView />}
      </main>
    </div>
  )
}
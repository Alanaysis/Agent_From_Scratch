'use client'

import { useAppStore } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { ChatView, SettingsView, ProposalView, ProposalEditor, DocumentsView } from './Views'
import { ApprovalModal } from '@/components/workflow/ApprovalModal'
import { KanbanView } from '@/components/kanban/KanbanView'
import { SessionsView } from '@/components/sessions/SessionsView'

export function AppLayout() {
  const viewMode = useAppStore((s) => s.viewMode)

  return (
    <div className="noise-bg" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--surface-0)' }}>
      <Sidebar />
      <ApprovalModal />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {viewMode === 'settings' && <SettingsView />}
        {viewMode === 'chat' && <ChatView />}
        {viewMode === 'kanban' && <KanbanView />}
        {viewMode === 'sessions' && <SessionsView />}
        {viewMode === 'proposals' && <ProposalView />}
        {viewMode === 'proposal-editor' && <ProposalEditor />}
        {viewMode === 'documents' && <DocumentsView />}
      </main>
    </div>
  )
}

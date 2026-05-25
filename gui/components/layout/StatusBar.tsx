'use client'

import { Wifi, WifiOff, Bot, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'

export function StatusBar() {
  const { backendConnected, agentPresences, messages, currentSession } = useAppStore()

  const lastMessageTime = messages.length > 0 
    ? formatDistanceToNow(messages[messages.length - 1].timestamp, { addSuffix: true })
    : null

  return (
    <footer className="flex h-8 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {backendConnected ? (
            <Wifi className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-500" />
          )}
          <span>{backendConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          <span>{agentPresences.length} active agent{agentPresences.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {currentSession && (
          <span>{currentSession.messageCount} messages</span>
        )}
        {lastMessageTime && (
          <span>Last: {lastMessageTime}</span>
        )}
      </div>
    </footer>
  )
}
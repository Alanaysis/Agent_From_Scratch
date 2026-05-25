'use client'

import * as React from 'react'
import { ScrollArea } from '@/components/ui'
import { Search, Trash2, MessageSquare, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'

const statusColors: Record<Session['status'], string> = {
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
  failed: 'bg-red-500',
}

const filterTabs = ['All', 'Active', 'Issues'] as const
type FilterTab = (typeof filterTabs)[number]

export function SessionsView() {
  const { sessions, currentSession, setCurrentSession, deleteSession, loadSessions } = useAppStore()
  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<FilterTab>('All')

  React.useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase())
    if (filter === 'All') return matchesSearch
    if (filter === 'Active') return matchesSearch && s.status === 'active'
    if (filter === 'Issues') return matchesSearch && (s.status === 'failed' || s.status === 'paused')
    return matchesSearch
  })

  return (
    <div className="flex h-full">
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {filterTabs.map((tab) => (
              <Button
                key={tab}
                variant={filter === tab ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(tab)}
                className="flex-1 text-xs"
              >
                {tab}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setCurrentSession(session)}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted',
                  currentSession?.id === session.id && 'bg-muted'
                )}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {session.title.slice(0, 2).toUpperCase()}
                    </div>
                  </Avatar>
                  <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background', statusColors[session.status])} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{session.title}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>{session.messageCount}</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(session.updatedAt, { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="flex-1 p-6">
        {currentSession ? (
          <div className="max-w-lg mx-auto bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {currentSession.title.slice(0, 2).toUpperCase()}
                </div>
              </Avatar>
              <div>
                <h3 className="font-semibold">{currentSession.title}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className={cn('w-2 h-2 rounded-full', statusColors[currentSession.status])} />
                  <span>{currentSession.status}</span>
                </div>
              </div>
            </div>
            {currentSession.lastPrompt && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Last prompt:</span>
                <p className="text-sm mt-1">{currentSession.lastPrompt}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Provider:</span>
                <p>{currentSession.provider || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Model:</span>
                <p>{currentSession.model || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Messages:</span>
                <p>{currentSession.messageCount}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Updated:</span>
                <p>{formatDistanceToNow(currentSession.updatedAt, { addSuffix: true })}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a session to view details
          </div>
        )}
      </div>
    </div>
  )
}
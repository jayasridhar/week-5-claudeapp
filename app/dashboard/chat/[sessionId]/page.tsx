'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import MessageBubble from '@/components/MessageBubble'
import ChatComposer from '@/components/ChatComposer'
import { useDashboard } from '@/lib/DashboardContext'
import type { MessageRow } from '@/lib/db'

export default function ChatPage() {
  const router = useRouter()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { sessions, setSessions, isProcessing } = useDashboard()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) { router.replace('/login'); return }

    setMessages([])
    setLoading(true)

    fetch(`/api/messages?sessionId=${sessionId}`)
      .then(r => r.json())
      .then((data: MessageRow[]) => setMessages(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing])

  function handleMessageSent(userMsg: MessageRow, assistantMsg: MessageRow) {
    setMessages(prev => [...prev, userMsg, assistantMsg])
  }

  function handleSessionTitleUpdate(title: string) {
    setSessions(sessions.map(s => s.id === sessionId ? { ...s, title } : s))
  }

  const isFirstMessage = messages.filter(m => m.role === 'user').length === 0

  const session = sessions.find(s => s.id === sessionId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 h-12 border-b border-an-border flex items-center px-6">
        <h2 className="text-body text-an-fg-subtle truncate">
          {session?.title ?? 'Loading…'}
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-6 py-6 flex flex-col gap-6">
          {loading && (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-an-bg-surface rounded animate-pulse" />
              ))}
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 rounded-full bg-an-accent-subtle flex items-center justify-center mb-4">
                <span className="w-2 h-2 rounded-full bg-an-accent" />
              </div>
              <p className="text-title text-an-fg-base mb-2">Ready to analyse</p>
              <p className="text-body text-an-fg-subtle max-w-xs">
                Attach a PDF or DOCX contract below, then ask your first question.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} sessionId={sessionId} />
          ))}

          {isProcessing && (
            <div className="flex items-center gap-3 max-w-[680px]">
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-an-accent" />
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <ChatComposer
        sessionId={sessionId}
        onMessageSent={handleMessageSent}
        onSessionTitleUpdate={handleSessionTitleUpdate}
        isFirstMessage={isFirstMessage}
      />
    </div>
  )
}

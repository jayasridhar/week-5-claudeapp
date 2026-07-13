'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUp } from 'lucide-react'
import FileUpload from './FileUpload'
import { useDashboard, INITIAL_STEPS } from '@/lib/DashboardContext'
import type { MessageRow } from '@/lib/db'

type Props = {
  sessionId: string
  onMessageSent: (userMsg: MessageRow, assistantMsg: MessageRow) => void
  onSessionTitleUpdate: (title: string) => void
  isFirstMessage: boolean
}

export default function ChatComposer({ sessionId, onMessageSent, onSessionTitleUpdate, isFirstMessage }: Props) {
  const { filePreview, setFilePreview, setExecutionSteps, isProcessing, setIsProcessing, azureConnected, setAzureConnected } = useDashboard()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [text])

  function updateSteps(activeId: string, doneIds: string[], errorId?: string) {
    setExecutionSteps(INITIAL_STEPS.map(s => ({
      ...s,
      status: errorId === s.id ? 'error' :
              doneIds.includes(s.id) ? 'done' :
              s.id === activeId ? 'active' : 'idle',
    })))
  }

  async function handleSend() {
    const message = text.trim()
    if (!message || isProcessing) return
    setError('')
    setText('')
    setIsProcessing(true)
    updateSteps('send', ['parse'])

    try {
      // Save user message
      const userMsgRes = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role: 'user', content: message }),
      })
      const userMsg: MessageRow = await userMsgRes.json()

      // Auto-title on first message
      if (isFirstMessage) {
        const title = message.slice(0, 55) + (message.length > 55 ? '…' : '')
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        onSessionTitleUpdate(title)
      }

      updateSteps('wait', ['parse', 'send'])

      // Call Azure AI
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contractText: filePreview?.extractedText ?? '',
          userMessage: message,
        }),
      })

      updateSteps('process', ['parse', 'send', 'wait'])

      const chatData = await chatRes.json()

      if (!chatRes.ok) {
        setError(chatData.error ?? 'AI request failed.')
        updateSteps('', ['parse', 'send', 'wait'], 'process')
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'error' }),
        })
        return
      }

      // Save assistant message
      const assistantMsgRes = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role: 'assistant', content: chatData.content }),
      })
      const assistantMsg: MessageRow = await assistantMsgRes.json()

      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      setExecutionSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'done' })))
      onMessageSent(userMsg, assistantMsg)
    } catch {
      setError('Something went wrong. Please try again.')
      updateSteps('', ['parse', 'send'], 'wait')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="px-6 pb-6 flex-shrink-0">
      <div
        className="max-w-[680px] mx-auto rounded-xl border border-an-border p-3"
        style={{ background: 'var(--an-bg-surface)' }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder="Ask a question about your document…"
          rows={1}
          disabled={isProcessing}
          className="w-full bg-transparent border-none text-body text-an-fg-base placeholder:text-an-fg-muted resize-none focus:outline-none disabled:opacity-50 min-h-[24px] max-h-[200px] overflow-y-auto"
        />
        <div className="flex items-center justify-between mt-2">
          <FileUpload
            filename={filePreview?.filename ?? null}
            onFileLoaded={(text, filename, blobUrl, fileType) =>
              setFilePreview({ extractedText: text, filename, blobUrl, fileType })
            }
            onClear={() => setFilePreview(null)}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || isProcessing}
            className="w-8 h-8 rounded-full bg-an-accent hover:bg-an-accent-hover disabled:opacity-40 flex items-center justify-center transition-colors duration-150 flex-shrink-0"
          >
            <ArrowUp size={15} strokeWidth={2} className="text-white" />
          </button>
        </div>
      </div>
      {error && (
        (
          <p className="text-caption text-an-error text-center mt-2">{error}</p>
        )
      )}
    </div>
  )
}

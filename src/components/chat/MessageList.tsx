import { useEffect, useRef } from 'react'
import { Message } from '../../types'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'

interface MessageListProps {
  messages: Message[]
  sending: boolean
}

export default function MessageList({ messages, sending }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-6) var(--space-7)',
      }}
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {sending && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}

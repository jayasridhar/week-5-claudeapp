import { Message } from '../../types'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 'var(--space-3)',
      }}
    >
      <div
        style={{
          maxWidth: '72%',
          padding: 'var(--space-3) var(--space-5)',
          borderRadius: isUser
            ? 'var(--radius-xl) var(--radius-xl) var(--radius-xs) var(--radius-xl)'
            : 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs)',
          backgroundColor: isUser ? 'var(--brand-primary)' : 'var(--surface-card)',
          color: isUser ? 'var(--text-on-primary)' : 'var(--text-body)',
          boxShadow: 'var(--shadow-sm)',
          border: isUser ? 'none' : '1px solid var(--border-default)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          lineHeight: 'var(--leading-relaxed)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}

import FeedbackForm from './FeedbackForm'
import type { MessageRow } from '@/lib/db'

type Props = {
  message: MessageRow
  sessionId: string
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, sessionId }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%]">
          <div
            className="px-4 py-3 text-body text-an-fg-base"
            style={{
              background: 'var(--an-accent-subtle)',
              border: '1px solid rgba(217,119,87,0.20)',
              borderRadius: '12px 12px 4px 12px',
            }}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <p className="text-caption text-an-fg-muted text-right mt-1">{formatTime(message.created_at)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 max-w-[680px]">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-an-accent" />
        <div className="flex-1 min-w-0">
          <p className="text-body text-an-fg-base whitespace-pre-wrap break-words">{message.content}</p>
          <p className="text-caption text-an-fg-muted mt-1">{formatTime(message.created_at)}</p>
          <FeedbackForm sessionId={sessionId} messageId={message.id} />
        </div>
      </div>
    </div>
  )
}

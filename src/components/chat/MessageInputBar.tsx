import { useState, KeyboardEvent } from 'react'
import Button from '../ui/Button'

interface MessageInputBarProps {
  onSend: (content: string) => void
  onAttachContract: () => void
  disabled?: boolean
  contractUploaded?: boolean
}

export default function MessageInputBar({
  onSend,
  onAttachContract,
  disabled = false,
  contractUploaded = false,
}: MessageInputBarProps) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        flexShrink: 0,
        padding: 'var(--space-4) var(--space-6)',
        borderTop: '1px solid var(--border-default)',
        backgroundColor: 'var(--surface-card)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-3)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--surface-raised)',
          boxShadow: 'var(--shadow-inset)',
        }}
      >
        <button
          onClick={onAttachContract}
          title={contractUploaded ? 'Contract attached' : 'Attach contract'}
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            border: '1px solid',
            borderColor: contractUploaded ? 'var(--safe-border)' : 'var(--border-default)',
            backgroundColor: contractUploaded ? 'var(--safe-bg)' : 'var(--surface-sunken)',
            color: contractUploaded ? 'var(--safe-fg)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            transition: 'var(--transition-control)',
          }}
        >
          📎
        </button>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the contract…"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            color: 'var(--text-body)',
            lineHeight: 'var(--leading-relaxed)',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />

        <Button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          size="sm"
          style={{ flexShrink: 0 }}
        >
          Send
        </Button>
      </div>
      <p className="lg-small" style={{ marginTop: 'var(--space-2)', color: 'var(--text-muted)' }}>
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}

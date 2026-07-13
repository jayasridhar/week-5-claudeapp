'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

type Props = {
  sessionId: string
  messageId: string
}

export default function FeedbackForm({ sessionId, messageId }: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!rating) return
    setSubmitting(true)
    try {
      const userId = localStorage.getItem('userId') ?? ''
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId, rating, comment: comment || undefined }),
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <p className="text-caption text-an-fg-muted mt-2">Thanks for your feedback.</p>
    )
  }

  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-0.5 transition-colors duration-100"
          >
            <Star
              size={14}
              strokeWidth={1.5}
              className={n <= (hover || rating) ? 'text-an-accent fill-an-accent' : 'text-an-fg-muted'}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment…"
            className="h-7 px-2 bg-an-bg-surface border border-an-border rounded text-body-sm text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors duration-100 w-40"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-7 px-3 bg-an-accent hover:bg-an-accent-hover disabled:opacity-50 text-white text-caption rounded transition-colors duration-150"
          >
            {submitting ? '…' : 'Submit'}
          </button>
        </>
      )}
    </div>
  )
}

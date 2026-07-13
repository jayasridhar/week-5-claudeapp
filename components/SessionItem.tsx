'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Pin, PinOff, Pencil, Trash2 } from 'lucide-react'
import type { SessionRow } from '@/lib/db'

type Props = {
  session: SessionRow
  isActive: boolean
  onClick: () => void
  onRename: (id: string, title: string) => void
  onPin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const STATUS_DOT: Record<SessionRow['status'], string> = {
  idle:       'bg-an-fg-muted',
  processing: 'bg-an-warning',
  completed:  'bg-an-success',
  error:      'bg-an-error',
}

export default function SessionItem({ session, isActive, onClick, onRename, onPin, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(session.title)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) renameRef.current?.focus()
  }, [renaming])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function commitRename() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== session.title) {
      onRename(session.id, trimmed)
    } else {
      setRenameValue(session.title)
    }
    setRenaming(false)
  }

  return (
    <>
      <div
        onClick={onClick}
        className={`group relative flex items-center gap-2 h-9 px-3 rounded cursor-pointer transition-colors duration-100 ${
          isActive
            ? 'bg-an-bg-elevated text-an-fg-base'
            : 'text-an-fg-subtle hover:bg-an-bg-surface hover:text-an-fg-base'
        }`}
      >
        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_DOT[session.status]}`} />

        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenameValue(session.title); setRenaming(false) }
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 bg-an-bg-surface border border-an-border-strong rounded px-1.5 text-body-sm text-an-fg-base focus:outline-none"
          />
        ) : (
          <span className="flex-1 min-w-0 text-body-sm truncate">{session.title}</span>
        )}

        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <span className="text-caption text-an-fg-muted hidden group-hover:hidden">{relativeTime(session.updated_at)}</span>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-an-bg-elevated transition-opacity duration-100"
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute left-full top-0 ml-1 z-50 w-40 bg-an-bg-elevated border border-an-border rounded shadow-lg py-1 an-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setRenaming(true); setMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-body-sm text-an-fg-base hover:bg-an-bg-surface transition-colors duration-100"
            >
              <Pencil size={13} strokeWidth={1.5} /> Rename
            </button>
            <button
              onClick={() => { onPin(session.id, !session.pinned); setMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-body-sm text-an-fg-base hover:bg-an-bg-surface transition-colors duration-100"
            >
              {session.pinned ? <><PinOff size={13} strokeWidth={1.5} /> Unpin</> : <><Pin size={13} strokeWidth={1.5} /> Pin</>}
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(true); setMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-body-sm text-an-error hover:bg-an-bg-surface transition-colors duration-100"
            >
              <Trash2 size={13} strokeWidth={1.5} /> Delete
            </button>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-an-bg-elevated border border-an-border rounded-lg p-5 w-80 an-fade-in">
            <h3 className="text-title text-an-fg-base mb-2">Delete session?</h3>
            <p className="text-body text-an-fg-subtle mb-5">
              This will permanently delete &ldquo;{session.title}&rdquo; and all its messages.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-9 border border-an-border rounded text-body text-an-fg-base hover:bg-an-bg-surface transition-colors duration-100"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(session.id); setShowDeleteConfirm(false) }}
                className="flex-1 h-9 bg-an-error text-white text-body rounded hover:opacity-90 transition-opacity duration-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

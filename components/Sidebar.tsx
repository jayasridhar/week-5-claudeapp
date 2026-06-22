'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, LogOut, BarChart2 } from 'lucide-react'
import SessionItem from './SessionItem'
import { useDashboard } from '@/lib/DashboardContext'
import type { SessionRow } from '@/lib/db'

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { sessions, setSessions, azureConnected } = useDashboard()
  const [search, setSearch] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    setUserEmail(localStorage.getItem('userEmail') ?? '')
  }, [])

  const activeSessionId = pathname.startsWith('/dashboard/chat/')
    ? pathname.split('/').pop() ?? null
    : null

  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  const pinned = filtered.filter(s => s.pinned)
  const unpinned = filtered.filter(s => !s.pinned)

  async function handleNewChat() {
    const userId = localStorage.getItem('userId')
    if (!userId) return
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) return
    const session: SessionRow = await res.json()
    setSessions([session, ...sessions])
    router.push(`/dashboard/chat/${session.id}`)
  }

  async function handleRename(id: string, title: string) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setSessions(sessions.map(s => s.id === id ? { ...s, title } : s))
  }

  async function handlePin(id: string, pinned: boolean) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    })
    setSessions(sessions.map(s => s.id === id ? { ...s, pinned } : s))
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(sessions.filter(s => s.id !== id))
    if (activeSessionId === id) router.push('/dashboard')
  }

  function handleLogout() {
    localStorage.removeItem('userId')
    localStorage.removeItem('userEmail')
    router.replace('/login')
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-an-bg-subtle border-r border-an-border flex flex-col h-full">
      {/* Logo + new chat */}
      <div className="p-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="font-display text-[16px] font-semibold text-an-fg-base">DocAssist</span>
        </div>
        <button
          onClick={handleNewChat}
          className="w-full h-9 flex items-center justify-center gap-2 bg-an-accent hover:bg-an-accent-hover text-white text-label rounded transition-colors duration-150"
        >
          <Plus size={14} strokeWidth={2} />
          New chat
        </button>
      </div>

      {/* Financial agent nav */}
      <div className="px-3 pb-2 flex-shrink-0">
        <Link
          href="/dashboard/financial"
          className={`flex items-center gap-2 h-9 px-3 rounded text-body-sm transition-colors duration-100 ${
            pathname === '/dashboard/financial'
              ? 'bg-an-bg-elevated text-an-fg-base'
              : 'text-an-fg-subtle hover:bg-an-bg-surface hover:text-an-fg-base'
          }`}
        >
          <BarChart2 size={14} strokeWidth={1.5} />
          Financial Analysis
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-an-fg-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-7 pr-3 bg-an-bg-surface border border-an-border rounded text-body-sm text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors duration-100"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {pinned.length > 0 && (
          <>
            <p className="text-caption text-an-fg-muted px-2 py-1.5 uppercase tracking-wide">Pinned</p>
            {pinned.map(s => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onClick={() => router.push(`/dashboard/chat/${s.id}`)}
                onRename={handleRename}
                onPin={handlePin}
                onDelete={handleDelete}
              />
            ))}
            {unpinned.length > 0 && <div className="h-px bg-an-border my-2" />}
          </>
        )}
        {unpinned.map(s => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={s.id === activeSessionId}
            onClick={() => router.push(`/dashboard/chat/${s.id}`)}
            onRename={handleRename}
            onPin={handlePin}
            onDelete={handleDelete}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-body-sm text-an-fg-muted text-center py-6">
            {search ? 'No sessions match your search.' : 'No sessions yet.'}
          </p>
        )}
      </div>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-an-border p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-an-accent-subtle flex items-center justify-center flex-shrink-0">
          <span className="text-caption font-medium text-an-accent">
            {userEmail.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="flex-1 min-w-0 text-body-sm text-an-fg-subtle truncate">{userEmail}</span>
        <button
          onClick={handleLogout}
          title="Log out"
          className="p-1 rounded text-an-fg-muted hover:text-an-fg-base hover:bg-an-bg-surface transition-colors duration-100"
        >
          <LogOut size={14} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  )
}

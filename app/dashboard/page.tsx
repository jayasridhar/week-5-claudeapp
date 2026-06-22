'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import KPICard from '@/components/KPICard'
import type { DashboardStats } from '@/lib/db'
import { useDashboard } from '@/lib/DashboardContext'

export default function DashboardPage() {
  const router = useRouter()
  const { sessions } = useDashboard()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) { router.replace('/login'); return }

    fetch(`/api/dashboard/stats?userId=${userId}`)
      .then(r => r.json())
      .then((data: DashboardStats) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  const kpis = stats ? [
    { label: 'Total sessions',          value: stats.totalSessions },
    { label: 'Sessions today',          value: stats.todaySessions },
    { label: 'Total AI queries',        value: stats.totalUserMessages },
    { label: 'AI queries this week',    value: stats.weekUserMessages },
    { label: 'Active sessions (7d)',    value: stats.activeSessions },
    { label: 'Pinned chats',            value: stats.pinnedCount },
    { label: 'Avg. feedback rating',    value: stats.avgRating !== null ? `${stats.avgRating} / 5` : null },
    { label: 'Failed processing jobs',  value: stats.failedJobs },
  ] : []

  const recentSessions = sessions.slice(0, 5)

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-display text-an-fg-base mb-1">Dashboard</h1>
            <p className="text-body text-an-fg-subtle">Your document analysis overview</p>
          </div>
          <Link
            href="#"
            onClick={async (e) => {
              e.preventDefault()
              const userId = localStorage.getItem('userId')
              if (!userId) return
              const res = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
              })
              if (res.ok) {
                const session = await res.json()
                router.push(`/dashboard/chat/${session.id}`)
              }
            }}
            className="h-9 px-4 bg-an-accent hover:bg-an-accent-hover text-white text-label rounded transition-colors duration-150 flex items-center"
          >
            New chat
          </Link>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <KPICard key={i} label="" value={null} loading />)
            : kpis.map(k => <KPICard key={k.label} label={k.label} value={k.value} />)
          }
        </div>

        {/* Recent sessions */}
        <h2 className="text-title text-an-fg-base mb-4">Recent sessions</h2>
        {recentSessions.length === 0 ? (
          <div className="bg-an-bg-surface border border-an-border rounded-lg p-8 text-center">
            <p className="text-body text-an-fg-subtle mb-4">No sessions yet. Upload a contract and start chatting.</p>
            <Link
              href="#"
              onClick={async (e) => {
                e.preventDefault()
                const userId = localStorage.getItem('userId')
                if (!userId) return
                const res = await fetch('/api/sessions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId }),
                })
                if (res.ok) {
                  const session = await res.json()
                  router.push(`/dashboard/chat/${session.id}`)
                }
              }}
              className="inline-block h-9 px-4 bg-an-accent hover:bg-an-accent-hover text-white text-label rounded transition-colors duration-150 leading-9"
            >
              Start your first chat
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSessions.map(s => (
              <div
                key={s.id}
                className="bg-an-bg-surface border border-an-border rounded-lg px-4 py-3 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body text-an-fg-base truncate">{s.title}</p>
                  <p className="text-caption text-an-fg-muted mt-0.5">
                    {new Date(s.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-label px-2 py-0.5 rounded-full ${
                  s.status === 'completed' ? 'bg-an-accent-subtle text-an-accent' :
                  s.status === 'error'     ? 'text-an-error' :
                  'text-an-fg-muted'
                }`}>
                  {s.status}
                </span>
                <Link
                  href={`/dashboard/chat/${s.id}`}
                  className="h-8 px-3 border border-an-border rounded text-body-sm text-an-fg-base hover:bg-an-bg-elevated transition-colors duration-100 flex items-center"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed.')
        return
      }
      localStorage.setItem('userId', data.userId)
      localStorage.setItem('userEmail', data.userEmail)
      router.replace('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-theme="light" className="min-h-screen bg-an-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <span className="font-display text-[22px] font-semibold text-an-fg-base">Birchmont Capital Fusion</span>
          <h1 className="text-title text-an-fg-base mt-4 mb-1">Welcome back</h1>
          <p className="text-body text-an-fg-subtle">Log in to your account</p>
        </div>

        <div className="bg-an-bg-subtle border border-an-border rounded-lg p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label text-an-fg-subtle" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-9 px-3 bg-an-bg-surface border border-an-border rounded text-body text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors duration-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label text-an-fg-subtle" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                className="h-9 px-3 bg-an-bg-surface border border-an-border rounded text-body text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-border-strong transition-colors duration-100"
              />
            </div>

            {error && (
              <p className="text-body-sm text-an-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-9 bg-an-accent hover:bg-an-accent-hover disabled:opacity-50 text-white text-label rounded transition-colors duration-150 mt-1"
            >
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="text-center text-body text-an-fg-subtle mt-5">
          No account yet?{' '}
          <Link href="/signup" className="text-an-accent hover:underline">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  )
}

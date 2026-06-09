# Task 09: Auth Pages

## Status

complete

## Wave

3

## Description

Build the authentication UI: a combined login/sign-up page at `/auth`, the `AuthForm` component with email/password fields, and a `ProtectedRoute` wrapper that redirects unauthenticated users to `/auth`. Wire `AuthProvider` into `App.tsx` so the auth context is available throughout the app. After this task, the full authentication flow works end-to-end.

## Dependencies

**Depends on:** task-04-supabase-client-auth, task-05-app-routing-shell, task-08-ui-primitives
**Blocks:** task-12-dashboard-integration

**Context from dependencies:**
- task-04 created `AuthProvider` (exported from `src/store/AuthContext.tsx`) and `useAuthContext` hook. `AuthProvider` must wrap the app at the `App.tsx` level. It exposes `{ user, session, loading, signIn, signUp, signOut }`.
- task-05 set up React Router in `src/App.tsx` with a placeholder `/auth` route (`<div className="min-h-screen bg-canvas" />`). This task replaces that placeholder with `<AuthPage />` and adds `ProtectedRoute` to the `/` route.
- task-08 built `Button` (`src/components/ui/Button.tsx`) and `Input` (`src/components/ui/Input.tsx`) following the LegalGraph design system. Import and use them in `AuthForm`.

## Files to Create

- `src/pages/AuthPage.tsx` — full auth page (centers AuthForm on ivory background)
- `src/components/auth/AuthForm.tsx` — login/signup form with tab switching
- `src/components/auth/ProtectedRoute.tsx` — redirects to `/auth` if not logged in

## Files to Modify

- `src/App.tsx` — wrap root with `AuthProvider`, replace `/auth` placeholder, add `ProtectedRoute` to `/`

## Technical Details

### Implementation Steps

1. Create `src/components/auth/ProtectedRoute.tsx`:
```tsx
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../../store/AuthContext'
import { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContext()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface-canvas)' }}
      >
        <span className="lg-small" style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
```

2. Create `src/components/auth/AuthForm.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../store/AuthContext'
import Button from '../ui/Button'
import Input from '../ui/Input'

type Mode = 'login' | 'signup'

export default function AuthForm() {
  const { signIn, signUp } = useAuthContext()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 400,
        backgroundColor: 'var(--surface-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        padding: 'var(--space-9) var(--space-8)',
      }}
    >
      {/* Wordmark */}
      <div style={{ marginBottom: 'var(--space-7)', textAlign: 'center' }}>
        <span
          className="lg-eyebrow"
          style={{ display: 'block', marginBottom: 'var(--space-2)' }}
        >
          LegalGraph
        </span>
        <h1 className="lg-h2" style={{ margin: 0 }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
      </div>

      {/* Mode tabs */}
      <div
        style={{
          display: 'flex',
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null) }}
            style={{
              flex: 1,
              padding: 'var(--space-3)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: mode === m ? 'var(--brand-primary)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: mode === m ? '2px solid var(--brand-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'var(--transition-control)',
            }}
          >
            {m === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          hint={mode === 'signup' ? 'At least 6 characters' : undefined}
        />

        {error && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--danger-fg)', margin: 0 }}>
            {error}
          </p>
        )}

        <Button type="submit" block loading={loading} style={{ marginTop: 'var(--space-2)' }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
    </div>
  )
}
```

3. Create `src/pages/AuthPage.tsx`:
```tsx
import AuthForm from '../components/auth/AuthForm'

export default function AuthPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--surface-sunken)' }}
    >
      <AuthForm />
    </div>
  )
}
```

4. Update `src/App.tsx` — wrap with `AuthProvider` and integrate `ProtectedRoute`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './store/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

## Acceptance Criteria

- [ ] Visiting `/auth` renders the login form on a sand-colored background
- [ ] Switching tabs between "Sign in" and "Sign up" swaps the form mode without page reload
- [ ] Submitting the form with invalid credentials shows the Supabase error message
- [ ] Successful sign-in navigates to `/` (the dashboard)
- [ ] Refreshing the dashboard page does NOT flash `/auth` — `ProtectedRoute` shows a loading state while session is checked
- [ ] Unauthenticated visits to `/` redirect to `/auth`
- [ ] `npx tsc --noEmit` passes

## Notes

- On sign-up with Supabase, if email confirmation is enabled in the Supabase project settings, the user won't be immediately signed in. The error state should handle the case where `signUp` returns no error but `user` is still null (email confirmation pending). For simplicity, show a message like "Check your email to confirm your account."
- The AuthForm deliberately does not have a "Forgot password" link — that's a non-goal.

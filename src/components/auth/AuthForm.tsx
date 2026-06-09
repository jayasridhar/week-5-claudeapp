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
  const [confirmEmail, setConfirmEmail] = useState(false)

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

    if (mode === 'signup') {
      setConfirmEmail(true)
      return
    }

    navigate('/', { replace: true })
  }

  if (confirmEmail) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: 'var(--surface-card)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--space-9) var(--space-8)',
          textAlign: 'center',
        }}
      >
        <span className="lg-eyebrow" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          LegalGraph
        </span>
        <h1 className="lg-h2" style={{ margin: '0 0 var(--space-5)' }}>Check your email</h1>
        <p className="lg-body" style={{ color: 'var(--text-muted)' }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
        </p>
        <button
          onClick={() => { setConfirmEmail(false); setMode('login') }}
          style={{
            marginTop: 'var(--space-6)',
            background: 'none',
            border: 'none',
            color: 'var(--brand-primary)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
        >
          Back to sign in
        </button>
      </div>
    )
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
      <div style={{ marginBottom: 'var(--space-7)', textAlign: 'center' }}>
        <span className="lg-eyebrow" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          LegalGraph
        </span>
        <h1 className="lg-h2" style={{ margin: 0 }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
      </div>

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

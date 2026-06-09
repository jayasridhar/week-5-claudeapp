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

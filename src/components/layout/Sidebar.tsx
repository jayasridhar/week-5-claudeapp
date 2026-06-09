import { useAuthContext } from '../../store/AuthContext'
import { useSessionContext } from '../../store/SessionContext'

export default function Sidebar() {
  const { user, signOut } = useAuthContext()
  const { sessions, activeSession, loading, createSession, selectSession } = useSessionContext()

  return (
    <div className="flex flex-col h-full" style={{ color: 'var(--text-inverse)' }}>
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--blue-800)' }}
      >
        <span
          className="font-display font-semibold"
          style={{ fontSize: 'var(--text-md)', color: 'var(--text-inverse)' }}
        >
          LegalGraph
        </span>
      </div>

      <div className="px-3 py-3 flex-shrink-0">
        <button
          onClick={createSession}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--blue-700)',
            backgroundColor: 'transparent',
            color: 'var(--text-inverse)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'var(--transition-control)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--blue-800)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span style={{ fontSize: 18 }}>+</span>
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {loading && (
          <p className="px-3 py-2 lg-small" style={{ color: 'var(--blue-300)' }}>Loading…</p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="px-3 py-2 lg-small" style={{ color: 'var(--blue-300)' }}>No chats yet.</p>
        )}
        {sessions.map((session) => {
          const isActive = activeSession?.id === session.id
          return (
            <button
              key={session.id}
              onClick={() => selectSession(session.id)}
              title={session.title}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'block',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: isActive ? 'var(--blue-800)' : 'transparent',
                color: isActive ? 'var(--text-inverse)' : 'var(--blue-300)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'var(--transition-control)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--blue-800)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {session.title}
            </button>
          )
        })}
      </div>

      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid var(--blue-800)' }}
      >
        <span className="lg-small truncate" style={{ color: 'var(--blue-300)', maxWidth: 150 }}>
          {user?.email}
        </span>
        <button
          onClick={signOut}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--blue-300)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            transition: 'var(--transition-control)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-inverse)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--blue-300)')}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

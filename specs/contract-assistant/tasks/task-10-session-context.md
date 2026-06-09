# Task 10: Session Context + API Client + Sidebar Session List

## Status

complete

## Wave

3

## Description

Build the session management layer: a typed API client that wraps Edge Function calls, a `SessionContext` that maintains the session list and the active session, a `useSessions` hook, and the sidebar session list UI. After this task, users can create new sessions and switch between existing ones, with session data persisted to Supabase via the Edge Function.

## Dependencies

**Depends on:** task-04-supabase-client-auth, task-05-app-routing-shell
**Blocks:** task-12-dashboard-integration, task-13-azure-ai-integration

**Context from dependencies:**
- task-04 created `src/lib/supabaseClient.ts` (exports `supabase`), `src/types/index.ts` (exports `ChatSession`, `Message`, `SendMessagePayload`, `SendMessageResponse`, `UpdateSessionPayload`), and `src/store/AuthContext.tsx` (exports `useAuthContext`).
- task-05 created `src/components/layout/Sidebar.tsx` — a structural skeleton with two placeholder divs: `id="sidebar-session-list"` and `id="sidebar-user-menu"`. This task **replaces the entire content** of `Sidebar.tsx` with the real session list implementation. Do not try to inject into the placeholder divs by ID — rewrite the file.

## Files to Create

- `src/lib/apiClient.ts` — typed wrappers for all Edge Function calls
- `src/store/SessionContext.tsx` — React context for session list and active session
- `src/hooks/useSessions.ts` — convenience hook reading from SessionContext

## Files to Modify

- `src/components/layout/Sidebar.tsx` — replace skeleton with real session list + new chat button + user menu

## Technical Details

### Implementation Steps

1. Create `src/lib/apiClient.ts`:
```ts
import { supabase } from './supabaseClient'
import type {
  ChatSession,
  Message,
  CreateSessionResponse,
  SendMessagePayload,
  SendMessageResponse,
  UpdateSessionPayload,
} from '../types'

async function invoke<T>(fn: string, options?: Parameters<typeof supabase.functions.invoke>[1]): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(fn, options)
  if (error) throw new Error(error.message)
  return data as T
}

export const api = {
  sessions: {
    create: () =>
      invoke<CreateSessionResponse>('chat', { method: 'POST', body: {} }),

    list: () =>
      invoke<{ sessions: ChatSession[] }>('chat', { method: 'GET' }),

    update: (id: string, payload: UpdateSessionPayload) =>
      invoke<{ session: ChatSession }>('chat', {
        method: 'PATCH',
        body: payload,
        headers: { 'x-session-id': id },
      }),

    getMessages: (id: string) =>
      invoke<{ messages: Message[] }>('chat', {
        method: 'GET',
        headers: { 'x-session-id': id },
      }),

    sendMessage: (payload: SendMessagePayload) =>
      invoke<SendMessageResponse>('chat', { method: 'POST', body: payload }),
  },
}
```

**Note:** Supabase's `functions.invoke` uses the function name as a path. Since all routes are under the single `chat` function, the Hono router in the Edge Function receives the full URL and routes internally. The exact invocation path depends on how Supabase routes requests — if `supabase.functions.invoke('chat', ...)` doesn't include sub-paths, use `supabase.functions.invoke('chat/sessions', ...)` for session routes and `supabase.functions.invoke('chat/sessions/{id}/messages', ...)` for message routes. Adjust the paths to match what the deployed Edge Function actually receives.

A cleaner approach: use `supabase.functions.invoke` with explicit path segments matching the Hono routes:
```ts
// In practice, use fetch with the full Edge Function URL for path-based routing:
const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function callEdge<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${EDGE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  sessions: {
    create: () => callEdge<{ session: ChatSession }>('/chat/sessions', 'POST'),
    list: () => callEdge<{ sessions: ChatSession[] }>('/chat/sessions', 'GET'),
    update: (id: string, payload: UpdateSessionPayload) =>
      callEdge<{ session: ChatSession }>(`/chat/sessions/${id}`, 'PATCH', payload),
    getMessages: (sessionId: string) =>
      callEdge<{ messages: Message[] }>(`/chat/sessions/${sessionId}/messages`, 'GET'),
    sendMessage: (sessionId: string, content: string) =>
      callEdge<SendMessageResponse>(`/chat/sessions/${sessionId}/messages`, 'POST', { content }),
  },
}
```

2. Create `src/store/SessionContext.tsx`:
```tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { ChatSession } from '../types'
import { api } from '../lib/apiClient'
import { useAuthContext } from './AuthContext'

interface SessionContextValue {
  sessions: ChatSession[]
  activeSession: ChatSession | null
  loading: boolean
  createSession: () => Promise<ChatSession>
  selectSession: (id: string) => void
  updateSession: (id: string, patch: Partial<Pick<ChatSession, 'title' | 'contract_text'>>) => Promise<void>
  refreshSessions: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshSessions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { sessions } = await api.sessions.list()
      setSessions(sessions)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  const createSession = async (): Promise<ChatSession> => {
    const { session } = await api.sessions.create()
    setSessions((prev) => [session, ...prev])
    setActiveSessionId(session.id)
    return session
  }

  const selectSession = (id: string) => setActiveSessionId(id)

  const updateSession = async (
    id: string,
    patch: Partial<Pick<ChatSession, 'title' | 'contract_text'>>
  ) => {
    const { session } = await api.sessions.update(id, patch)
    setSessions((prev) => prev.map((s) => (s.id === id ? session : s)))
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  return (
    <SessionContext.Provider
      value={{ sessions, activeSession, loading, createSession, selectSession, updateSession, refreshSessions }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSessionContext() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSessionContext must be used within SessionProvider')
  return ctx
}
```

3. Create `src/hooks/useSessions.ts`:
```ts
export { useSessionContext as useSessions } from '../store/SessionContext'
```

4. Rewrite `src/components/layout/Sidebar.tsx` (replace the entire file):
```tsx
import { useAuthContext } from '../../store/AuthContext'
import { useSessionContext } from '../../store/SessionContext'

export default function Sidebar() {
  const { user, signOut } = useAuthContext()
  const { sessions, activeSession, loading, createSession, selectSession } = useSessionContext()

  return (
    <div className="flex flex-col h-full" style={{ color: 'var(--text-inverse)' }}>
      {/* Logo area */}
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

      {/* New chat button */}
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

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {loading && (
          <p className="px-3 py-2 lg-small" style={{ color: 'var(--blue-300)' }}>
            Loading…
          </p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="px-3 py-2 lg-small" style={{ color: 'var(--blue-300)' }}>
            No chats yet.
          </p>
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

      {/* User menu */}
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
```

## Acceptance Criteria

- [ ] Clicking "New chat" creates a session via the Edge Function and it appears at the top of the list
- [ ] The active session is highlighted in the sidebar with `var(--blue-800)` background
- [ ] Session list loads from Supabase on mount and shows the user's sessions
- [ ] `updateSession` patches the session in Supabase and updates local state
- [ ] Sign out button calls `signOut` and redirects to `/auth`
- [ ] `npx tsc --noEmit` passes

## Notes

- `SessionProvider` must be added to the app's provider tree in task-12 (dashboard integration), not in this task. This task only defines the context and the hook.
- The `api` client uses direct `fetch` calls (not `supabase.functions.invoke`) because Hono routing in the Edge Function relies on URL path segments — `supabase.functions.invoke` always sends to the function root path.

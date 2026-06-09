import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { ChatSession, UpdateSessionPayload } from '../types'
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
    const payload: UpdateSessionPayload = {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.contract_text != null ? { contract_text: patch.contract_text } : {}),
    }
    const { session } = await api.sessions.update(id, payload)
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

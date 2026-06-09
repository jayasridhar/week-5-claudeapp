# Task 04: Supabase Client + Types + AuthContext

## Status

complete

## Wave

2

## Description

Set up the Supabase JavaScript client singleton, define all shared TypeScript types that match the database schema, and create the AuthContext that makes the authenticated user available throughout the React component tree. This task is the data foundation for every subsequent task that reads from or writes to Supabase. It does not include any UI — just the client, types, and context.

## Dependencies

**Depends on:** task-01-typescript-tailwind, task-03-supabase-schema
**Blocks:** task-09-auth-pages, task-10-session-context, task-11-chat-components

**Context from dependencies:**
- task-01 converted the project to TypeScript and installed `@supabase/supabase-js` (already in `node_modules`). All files in this task are `.ts` or `.tsx`.
- task-03 defined two tables: `chat_sessions` (id, user_id, title, contract_text, azure_thread_id, created_at, updated_at) and `messages` (id, session_id, role, content, created_at). The TypeScript types here must match those columns exactly.

## Files to Create

- `src/lib/supabaseClient.ts` — Supabase JS client singleton
- `src/types/index.ts` — shared TypeScript interfaces for all database entities
- `src/store/AuthContext.tsx` — React context providing user, session, signIn, signUp, signOut
- `src/hooks/useAuth.ts` — convenience hook that reads from AuthContext

## Technical Details

### Implementation Steps

1. Create `src/lib/supabaseClient.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

2. Create `src/types/index.ts`:
```ts
export interface ChatSession {
  id: string
  user_id: string
  title: string
  contract_text: string | null
  azure_thread_id: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// Payload shapes for Edge Function calls
export interface CreateSessionResponse {
  session: ChatSession
}

export interface SendMessagePayload {
  session_id: string
  content: string
}

export interface SendMessageResponse {
  user_message: Message
  assistant_message: Message
}

export interface UpdateSessionPayload {
  title?: string
  contract_text?: string
}
```

3. Create `src/store/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
```

4. Create `src/hooks/useAuth.ts`:
```ts
export { useAuthContext as useAuth } from '../store/AuthContext'
```

### Environment Variables

The Supabase client reads these from `.env`:
- `VITE_SUPABASE_URL` — Supabase project URL (e.g. `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — anon/public API key from Supabase dashboard

Both must be set before the dev server starts. If they are missing, `createClient` will throw at runtime.

## Acceptance Criteria

- [ ] `src/lib/supabaseClient.ts` exports a `supabase` client instance
- [ ] `src/types/index.ts` exports `ChatSession`, `Message`, `SendMessagePayload`, `SendMessageResponse`, `UpdateSessionPayload`
- [ ] `src/store/AuthContext.tsx` exports `AuthProvider` and `useAuthContext`
- [ ] `AuthProvider` correctly detects an existing session on page load (via `getSession`)
- [ ] `AuthProvider` subscribes to `onAuthStateChange` and cleans up the subscription on unmount
- [ ] `npx tsc --noEmit` passes with no errors for these files

## Notes

- `useAuthContext` throws if used outside `AuthProvider` — this is intentional, it catches wiring mistakes early.
- Do NOT wrap `App.tsx` with `AuthProvider` in this task — that wiring happens in task-09 (auth pages) which integrates everything into the router.
- The `loading` state should be used by ProtectedRoute (task-09) to avoid a flash of the login page on refresh when the user is already authenticated.

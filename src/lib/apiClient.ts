import { supabase } from './supabaseClient'
import type {
  ChatSession,
  Message,
  SendMessageResponse,
  UpdateSessionPayload,
} from '../types'

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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  sessions: {
    create: () =>
      callEdge<{ session: ChatSession }>('/chat/sessions', 'POST', {}),
    list: () =>
      callEdge<{ sessions: ChatSession[] }>('/chat/sessions', 'GET'),
    update: (id: string, payload: UpdateSessionPayload) =>
      callEdge<{ session: ChatSession }>(`/chat/sessions/${id}`, 'PATCH', payload),
    getMessages: (sessionId: string) =>
      callEdge<{ messages: Message[] }>(`/chat/sessions/${sessionId}/messages`, 'GET'),
    sendMessage: (sessionId: string, content: string) =>
      callEdge<SendMessageResponse>(`/chat/sessions/${sessionId}/messages`, 'POST', { content }),
  },
}

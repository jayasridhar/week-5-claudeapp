# Task 06: Edge Function Scaffold

## Status

complete

## Wave

2

## Description

Create the Supabase Edge Function that serves as the backend API for the entire app. It uses Hono for routing and exposes five endpoints for session and message management. In this task, the Azure AI calls are **stubbed** (returning a hardcoded placeholder response) — the real Azure integration is wired in task-13. The goal here is a working API that can be called from the frontend and persists sessions and messages to Supabase, ready for the AI layer to be dropped in.

## Dependencies

**Depends on:** task-03-supabase-schema
**Blocks:** task-13-azure-ai-integration

**Context from dependencies:**
- task-03 created `chat_sessions` and `messages` tables with RLS. The Edge Function uses the **service role key** (not the anon key) to bypass RLS and write assistant messages server-side. The schema columns are: `chat_sessions(id, user_id, title, contract_text, azure_thread_id, created_at, updated_at)` and `messages(id, session_id, role, content, created_at)`.

## Files to Create

- `supabase/functions/chat/index.ts` — Hono router with all five API endpoints
- `supabase/functions/_shared/cors.ts` — CORS headers helper
- `supabase/functions/_shared/azureClient.ts` — Azure AI client stub (real implementation in task-13)

## Technical Details

### Runtime

Supabase Edge Functions run in a **Deno** environment. Import maps or `npm:` specifiers are used — not `node_modules`.

### Implementation Steps

1. Create `supabase/functions/_shared/cors.ts`:
```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}
```

2. Create `supabase/functions/_shared/azureClient.ts` (stub — replaced in task-13):
```ts
export interface AzureThreadMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function createAzureThread(): Promise<string> {
  // Stub — real implementation in task-13
  return `stub-thread-${Date.now()}`
}

export async function sendToAzureAgent(
  _threadId: string,
  _userMessage: string,
  _contractText: string | null
): Promise<string> {
  // Stub — real implementation in task-13
  return 'I have received your message. Azure AI integration will be wired in task-13.'
}
```

3. Create `supabase/functions/chat/index.ts`:
```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Hono } from 'npm:hono'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createAzureThread, sendToAzureAgent } from '../_shared/azureClient.ts'

const app = new Hono()

// Helper: build a Supabase service-role client for this request
function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Helper: extract authenticated user from JWT in Authorization header
async function getUser(authHeader: string | null) {
  if (!authHeader) return null
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  return user
}

// CORS preflight
app.options('*', (c) => c.text('ok', 200, corsHeaders))

// POST /sessions — create a new chat session
app.post('/sessions', async (c) => {
  const user = await getUser(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const db = getServiceClient()
  const { data, error } = await db
    .from('chat_sessions')
    .insert({ user_id: user.id, title: 'New chat' })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ session: data }, 201, corsHeaders)
})

// GET /sessions — list user's sessions ordered by updated_at desc
app.get('/sessions', async (c) => {
  const user = await getUser(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const db = getServiceClient()
  const { data, error } = await db
    .from('chat_sessions')
    .select('id, title, contract_text, azure_thread_id, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ sessions: data }, 200, corsHeaders)
})

// PATCH /sessions/:id — update title or contract_text
app.patch('/sessions/:id', async (c) => {
  const user = await getUser(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const sessionId = c.req.param('id')
  const body = await c.req.json()
  const allowed: Record<string, unknown> = {}
  if (body.title !== undefined) allowed.title = body.title
  if (body.contract_text !== undefined) allowed.contract_text = body.contract_text

  const db = getServiceClient()
  const { data, error } = await db
    .from('chat_sessions')
    .update(allowed)
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ session: data }, 200, corsHeaders)
})

// GET /sessions/:id/messages — load message history
app.get('/sessions/:id/messages', async (c) => {
  const user = await getUser(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const sessionId = c.req.param('id')
  const db = getServiceClient()

  // Verify ownership via sessions table
  const { data: session } = await db
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (!session) return c.json({ error: 'Not found' }, 404)

  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ messages: data }, 200, corsHeaders)
})

// POST /sessions/:id/messages — send a message, get AI response
app.post('/sessions/:id/messages', async (c) => {
  const user = await getUser(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const sessionId = c.req.param('id')
  const { content } = await c.req.json()
  if (!content?.trim()) return c.json({ error: 'content is required' }, 400)

  const db = getServiceClient()

  // Load session (need contract_text and azure_thread_id)
  const { data: session, error: sessionErr } = await db
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (sessionErr || !session) return c.json({ error: 'Session not found' }, 404)

  // Create Azure thread on first message if not yet created
  let threadId = session.azure_thread_id
  if (!threadId) {
    threadId = await createAzureThread()
    await db.from('chat_sessions').update({ azure_thread_id: threadId }).eq('id', sessionId)
  }

  // Insert user message
  const { data: userMsg, error: userMsgErr } = await db
    .from('messages')
    .insert({ session_id: sessionId, role: 'user', content })
    .select()
    .single()
  if (userMsgErr) return c.json({ error: userMsgErr.message }, 500)

  // Call AI (stub in this task — real in task-13)
  // contract_text is passed only when it's the first message (thread was just created)
  const isFirstMessage = !session.azure_thread_id
  const aiResponse = await sendToAzureAgent(
    threadId,
    content,
    isFirstMessage ? session.contract_text : null
  )

  // Insert assistant message
  const { data: assistantMsg, error: assistantMsgErr } = await db
    .from('messages')
    .insert({ session_id: sessionId, role: 'assistant', content: aiResponse })
    .select()
    .single()
  if (assistantMsgErr) return c.json({ error: assistantMsgErr.message }, 500)

  // Touch updated_at on the session
  await db.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId)

  return c.json({ user_message: userMsg, assistant_message: assistantMsg }, 201, corsHeaders)
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // Strip the /chat prefix (Supabase routes /functions/v1/chat/*)
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/chat/, '') || '/'
  const newReq = new Request(new URL(path + url.search, req.url).toString(), req)
  return app.fetch(newReq)
})
```

### API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Create new session |
| `GET` | `/sessions` | List user's sessions |
| `PATCH` | `/sessions/:id` | Update title or contract_text |
| `GET` | `/sessions/:id/messages` | Load message history |
| `POST` | `/sessions/:id/messages` | Send message + get AI response |

### Environment Variables (set in Supabase dashboard or via CLI)

- `SUPABASE_URL` — auto-injected by Supabase runtime
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected by Supabase runtime
- `SUPABASE_ANON_KEY` — auto-injected by Supabase runtime
- `AZURE_AI_ENDPOINT` — set manually (used by task-13 azureClient.ts)
- `AZURE_AI_API_KEY` — set manually (used by task-13 azureClient.ts)
- `AZURE_AI_AGENT_ID` — set manually (used by task-13 azureClient.ts)

## Acceptance Criteria

- [ ] `supabase/functions/chat/index.ts` exists and uses Hono routing
- [ ] All five endpoints are implemented
- [ ] `POST /sessions` creates a row in `chat_sessions` and returns it
- [ ] `GET /sessions` returns only sessions belonging to the authenticated user
- [ ] `POST /sessions/:id/messages` creates both a user message and an assistant message (stub response)
- [ ] All endpoints return 401 for unauthenticated requests
- [ ] Function can be deployed with `supabase functions deploy chat` without errors

## Notes

- The service role client bypasses RLS intentionally — it writes both user and assistant messages without needing the user's JWT for each insert.
- The `isFirstMessage` logic checks whether `session.azure_thread_id` was null BEFORE we created it, not after — that's why we capture the original value first.
- Hono on Deno uses `npm:hono` specifier. If this causes issues, try `https://deno.land/x/hono@v3.12.0/mod.ts` instead.

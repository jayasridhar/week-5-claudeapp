import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Hono } from 'npm:hono'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createAzureThread, sendToAzureAgent } from '../_shared/azureClient.ts'

const app = new Hono()

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

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

app.options('*', (c) => c.text('ok', 200, corsHeaders))

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

app.get('/sessions/:id/messages', async (c) => {
  const user = await getUser(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const sessionId = c.req.param('id')
  const db = getServiceClient()
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

app.post('/sessions/:id/messages', async (c) => {
  const user = await getUser(c.req.header('Authorization'))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const sessionId = c.req.param('id')
  const { content } = await c.req.json()
  if (!content?.trim()) return c.json({ error: 'content is required' }, 400)
  const db = getServiceClient()
  const { data: session, error: sessionErr } = await db
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (sessionErr || !session) return c.json({ error: 'Session not found' }, 404)

  let threadId = session.azure_thread_id
  const isFirstMessage = !threadId
  if (!threadId) {
    threadId = await createAzureThread()
    await db.from('chat_sessions').update({ azure_thread_id: threadId }).eq('id', sessionId)
  }

  const { data: userMsg, error: userMsgErr } = await db
    .from('messages')
    .insert({ session_id: sessionId, role: 'user', content })
    .select()
    .single()
  if (userMsgErr) return c.json({ error: userMsgErr.message }, 500)

  const aiResponse = await sendToAzureAgent(
    threadId,
    content,
    isFirstMessage ? session.contract_text : null
  )

  const { data: assistantMsg, error: assistantMsgErr } = await db
    .from('messages')
    .insert({ session_id: sessionId, role: 'assistant', content: aiResponse })
    .select()
    .single()
  if (assistantMsgErr) return c.json({ error: assistantMsgErr.message }, 500)

  await db.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId)

  return c.json({ user_message: userMsg, assistant_message: assistantMsg }, 201, corsHeaders)
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/chat/, '') || '/'
  const newReq = new Request(new URL(path + url.search, req.url).toString(), req)
  return app.fetch(newReq)
})

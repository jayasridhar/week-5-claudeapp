import { supabase } from './supabase'
import { supabaseServer } from './supabase-server'

const db = typeof window === 'undefined' ? supabaseServer : supabase

export type UserRow = {
  id: string
  email: string
  password_hash: string
  created_at: string
}

export type SessionRow = {
  id: string
  user_id: string
  title: string
  status: 'idle' | 'processing' | 'completed' | 'error'
  pinned: boolean
  created_at: string
  updated_at: string
}

export type MessageRow = {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type FeedbackRow = {
  id: string
  user_id: string
  session_id: string
  rating: number
  comment: string | null
  created_at: string
}

export type AnalysisRow = {
  id: string
  user_id: string
  type: 'financial' | 'credit'
  file_name: string | null
  content: string
  created_at: string
}

export async function saveAnalysis(
  userId: string,
  type: 'financial' | 'credit',
  content: string,
  fileName?: string
): Promise<AnalysisRow> {
  const { data, error } = await supabaseServer
    .from('analyses')
    .insert({ user_id: userId, type, content, file_name: fileName ?? null })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getAnalyses(
  userId: string,
  type: 'financial' | 'credit',
  limit = 20
): Promise<AnalysisRow[]> {
  const { data, error } = await supabaseServer
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await supabaseServer.from('analyses').delete().eq('id', id)
  if (error) throw error
}

export async function clearAnalyses(userId: string, type: 'financial' | 'credit'): Promise<void> {
  const { error } = await supabaseServer.from('analyses').delete().eq('user_id', userId).eq('type', type)
  if (error) throw error
}

export type DashboardStats = {
  totalSessions: number
  todaySessions: number
  totalUserMessages: number
  weekUserMessages: number
  activeSessions: number
  pinnedCount: number
  avgRating: number | null
  failedJobs: number
}

export async function getUser(email: string): Promise<UserRow | null> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createUser(email: string, passwordHash: string): Promise<string> {
  const { data, error } = await db
    .from('users')
    .insert({ email, password_hash: passwordHash })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function createSession(userId: string, title = 'New session'): Promise<SessionRow> {
  const { data, error } = await db
    .from('sessions')
    .insert({ user_id: userId, title })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getSessions(userId: string): Promise<SessionRow[]> {
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateSession(
  id: string,
  fields: Partial<Pick<SessionRow, 'title' | 'status' | 'pinned'>>
): Promise<void> {
  const { error } = await db.from('sessions').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await db.from('sessions').delete().eq('id', id)
  if (error) throw error
}

export async function createMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<MessageRow> {
  const { data, error } = await db
    .from('messages')
    .insert({ session_id: sessionId, role, content })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getMessages(
  sessionId: string,
  limit = 100,
  before?: string
): Promise<MessageRow[]> {
  let query = db
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createFeedback(
  userId: string,
  sessionId: string,
  rating: number,
  comment?: string
): Promise<string> {
  const { data, error } = await db
    .from('feedback')
    .insert({ user_id: userId, session_id: sessionId, rating, comment: comment ?? null })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalSessions },
    { count: todaySessions },
    { count: activeSessions },
    { count: pinnedCount },
    { count: failedJobs },
  ] = await Promise.all([
    db.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', todayIso),
    db.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('updated_at', weekAgo),
    db.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('pinned', true),
    db.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'error'),
  ])

  const { data: sessionIds } = await db
    .from('sessions')
    .select('id')
    .eq('user_id', userId)

  const ids = (sessionIds ?? []).map((s: { id: string }) => s.id)

  let totalUserMessages = 0
  let weekUserMessages = 0
  let avgRating: number | null = null

  if (ids.length > 0) {
    const [{ count: totalMsgs }, { count: weekMsgs }, { data: feedbackData }] = await Promise.all([
      db.from('messages').select('*', { count: 'exact', head: true }).in('session_id', ids).eq('role', 'user'),
      db.from('messages').select('*', { count: 'exact', head: true }).in('session_id', ids).eq('role', 'user').gte('created_at', weekAgo),
      db.from('feedback').select('rating').in('session_id', ids),
    ])
    totalUserMessages = totalMsgs ?? 0
    weekUserMessages = weekMsgs ?? 0
    if (feedbackData && feedbackData.length > 0) {
      const sum = feedbackData.reduce((acc: number, f: { rating: number }) => acc + f.rating, 0)
      avgRating = Math.round((sum / feedbackData.length) * 10) / 10
    }
  }

  return {
    totalSessions: totalSessions ?? 0,
    todaySessions: todaySessions ?? 0,
    totalUserMessages,
    weekUserMessages,
    activeSessions: activeSessions ?? 0,
    pinnedCount: pinnedCount ?? 0,
    avgRating,
    failedJobs: failedJobs ?? 0,
  }
}

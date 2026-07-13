import { NextRequest, NextResponse } from 'next/server'
import { getMessages, createMessage } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    const messages = await getMessages(sessionId)
    return NextResponse.json(messages)
  } catch {
    return NextResponse.json({ error: 'Failed to load messages.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, role, content } = await req.json()
    if (!sessionId || !role || !content) {
      return NextResponse.json({ error: 'sessionId, role, and content are required.' }, { status: 400 })
    }
    const message = await createMessage(sessionId, role, content)
    return NextResponse.json(message, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to save message.' }, { status: 500 })
  }
}

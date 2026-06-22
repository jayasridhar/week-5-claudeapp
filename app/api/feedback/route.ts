import { NextRequest, NextResponse } from 'next/server'
import { createFeedback } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId, rating, comment } = await req.json()
    if (!userId || !sessionId || !rating) {
      return NextResponse.json({ error: 'userId, sessionId, and rating are required.' }, { status: 400 })
    }
    const id = await createFeedback(userId, sessionId, rating, comment)
    return NextResponse.json({ id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to save feedback.' }, { status: 500 })
  }
}

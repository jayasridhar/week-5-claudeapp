import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, deleteSession } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(params.id)
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    return NextResponse.json(session)
  } catch {
    return NextResponse.json({ error: 'Failed to load session.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fields = await req.json()
    await updateSession(params.id, fields)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update session.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteSession(params.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete session.' }, { status: 500 })
  }
}

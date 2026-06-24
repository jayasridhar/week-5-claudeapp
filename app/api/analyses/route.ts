import { NextRequest, NextResponse } from 'next/server'
import { saveAnalysis, getAnalyses, deleteAnalysis, clearAnalyses } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const type = searchParams.get('type') as 'financial' | 'credit' | null
  if (!userId || !type) {
    return NextResponse.json({ error: 'userId and type are required.' }, { status: 400 })
  }
  try {
    const data = await getAnalyses(userId, type)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const userId = searchParams.get('userId')
  const type = searchParams.get('type') as 'financial' | 'credit' | null
  try {
    if (id) {
      await deleteAnalysis(id)
    } else if (userId && type) {
      await clearAnalyses(userId, type)
    } else {
      return NextResponse.json({ error: 'Provide id or userId+type.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { userId, type, content, fileName } = await req.json()
  if (!userId || !type || !content) {
    return NextResponse.json({ error: 'userId, type, and content are required.' }, { status: 400 })
  }
  try {
    const data = await saveAnalysis(userId, type, content, fileName)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

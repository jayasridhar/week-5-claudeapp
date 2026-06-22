import { NextRequest, NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const stats = await getDashboardStats(userId)
    return NextResponse.json(stats)
  } catch {
    return NextResponse.json({ error: 'Failed to load stats.' }, { status: 500 })
  }
}

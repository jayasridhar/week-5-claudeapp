import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('azure_token')?.value
  return NextResponse.json({ connected: !!token })
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUser } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const user = await getUser(normalizedEmail)
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    return NextResponse.json({ userId: user.id, userEmail: user.email })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

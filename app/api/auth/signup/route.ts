import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createUser, getUser } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const existingUser = await getUser(normalizedEmail)
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const userId = await createUser(normalizedEmail, passwordHash)

    return NextResponse.json({ userId, userEmail: normalizedEmail }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signup failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

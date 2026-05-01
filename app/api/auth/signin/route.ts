import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'
import { createSession, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const rows = await sql`
      SELECT id, name, email, password_hash, monthly_income, monthly_budget, onboarded
      FROM users WHERE email = ${email.toLowerCase().trim()}
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 401 })
    }

    const user = rows[0]

    if (!user.password_hash) {
      return NextResponse.json({ error: 'This account was created without a password. Please sign up again.' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    const token = await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      monthly_income: Number(user.monthly_income),
      monthly_budget: Number(user.monthly_budget),
      onboarded: Boolean(user.onboarded),
    })

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, onboarded: user.onboarded },
    })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('[auth/signin]', err)
    return NextResponse.json({ error: 'Sign in failed. Please try again.' }, { status: 500 })
  }
}

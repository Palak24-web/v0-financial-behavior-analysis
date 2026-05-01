import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'
import { createSession, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, monthly_income, monthly_budget } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Check existing user
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 12)
    const income = parseFloat(monthly_income) || 0
    const budget = parseFloat(monthly_budget) || 0

    const rows = await sql`
      INSERT INTO users (name, email, password_hash, monthly_income, monthly_budget, onboarded)
      VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${password_hash}, ${income}, ${budget}, ${income > 0 && budget > 0})
      RETURNING id, name, email, monthly_income, monthly_budget, onboarded
    `
    const user = rows[0]

    const token = await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      monthly_income: Number(user.monthly_income),
      monthly_budget: Number(user.monthly_budget),
      onboarded: Boolean(user.onboarded),
    })

    const res = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email } })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('[auth/signup]', err)
    return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 })
  }
}

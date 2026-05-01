import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSession, getUserFromDb, createSession, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { monthly_income, monthly_budget, transactions, user_id: bodyUserId, skip } = body

    // Try session cookie first; fall back to user_id sent in body (handles race condition after signup)
    let session = await getSession()
    if (!session && bodyUserId) {
      const dbUser = await getUserFromDb(Number(bodyUserId))
      if (dbUser) session = dbUser
    }
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // If skip is true, set default values; otherwise validate
    let income: number
    let budget: number
    if (skip) {
      income = 0
      budget = 0
    } else {
      income = parseFloat(monthly_income)
      budget = parseFloat(monthly_budget)
      if (!income || !budget || income <= 0 || budget <= 0) {
        return NextResponse.json({ error: 'Valid income and budget are required' }, { status: 400 })
      }
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Update user financial info
    await sql`
      UPDATE users
      SET monthly_income = ${income}, monthly_budget = ${budget}, onboarded = true
      WHERE id = ${session.id}
    `

    // Insert seed transactions if provided
    if (Array.isArray(transactions) && transactions.length > 0) {
      for (const tx of transactions) {
        const amount = parseFloat(tx.amount)
        if (!amount || !tx.merchant || !tx.category) continue
        const isLateNight = new Date().getHours() >= 22 || new Date().getHours() < 5
        await sql`
          INSERT INTO transactions (user_id, amount, merchant, category, date, note, is_flagged, flag_reason)
          VALUES (
            ${session.id}, ${amount}, ${tx.merchant}, ${tx.category},
            NOW(), ${tx.note ?? null},
            ${isLateNight}, ${isLateNight ? 'late-night' : null}
          )
        `
      }
    }

    // Refresh the session token with updated info
    const newToken = await createSession({
      ...session,
      monthly_income: income,
      monthly_budget: budget,
      onboarded: true,
    })

    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('[auth/onboard]', err)
    return NextResponse.json({ error: 'Onboarding failed' }, { status: 500 })
  }
}

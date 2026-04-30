import { NextRequest, NextResponse } from 'next/server'
import { getTransactions, getTransactionsByPeriod, getCategoryBreakdown, getWeeklySpending, getDailySpending, getFlaggedTransactions } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') ?? 'recent'
    const userId = 1 // Demo user
    const days = parseInt(searchParams.get('days') ?? '30', 10)

    switch (type) {
      case 'recent':
        const limit = parseInt(searchParams.get('limit') ?? '20', 10)
        const transactions = await getTransactions(userId, limit)
        return NextResponse.json({ transactions })

      case 'period':
        const periodTx = await getTransactionsByPeriod(userId, days)
        return NextResponse.json({ transactions: periodTx, days })

      case 'categories':
        const breakdown = await getCategoryBreakdown(userId, days)
        return NextResponse.json({ categories: breakdown, days })

      case 'weekly':
        const weekly = await getWeeklySpending(userId)
        return NextResponse.json({ weekly })

      case 'daily':
        const daily = await getDailySpending(userId, days)
        return NextResponse.json({ daily })

      case 'flagged':
        const flagged = await getFlaggedTransactions(userId)
        return NextResponse.json({ flagged })

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('[transactions api]', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, merchant, category, note } = body

    if (!amount || !merchant || !category) {
      return NextResponse.json({ error: 'amount, merchant, and category are required' }, { status: 400 })
    }

    const { sql } = await import('@/lib/db')
    const rows = await sql`
      INSERT INTO transactions (user_id, amount, merchant, category, date, note)
      VALUES (1, ${amount}, ${merchant}, ${category}, NOW(), ${note ?? null})
      RETURNING *
    `
    return NextResponse.json({ transaction: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[transactions api POST]', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}

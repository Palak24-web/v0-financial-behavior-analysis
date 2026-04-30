import { NextRequest, NextResponse } from 'next/server'
import {
  getTransactions,
  getTransactionsByPeriod,
  getTransactionsByCategory,
  getCategoryBreakdown,
  getWeeklySpending,
  getDailySpending,
  getFlaggedTransactions,
  createTransaction,
  getMonthlyStats,
  getUser,
} from '@/lib/db'
import { z } from 'zod'

const CreateTransactionSchema = z.object({
  user_id: z.number().int().positive(),
  amount: z.number().positive('Amount must be positive'),
  merchant: z.string().min(1, 'Merchant is required').max(200),
  category: z.enum([
    'Rent', 'Groceries', 'Subscriptions', 'Shopping', 'Utilities',
    'Food & Drink', 'Transport', 'Travel', 'Entertainment', 'Health',
    'Investment', 'Misc',
  ]),
  date: z.string().datetime().optional(),
  note: z.string().max(500).nullable().optional(),
  is_flagged: z.boolean().optional(),
  flag_reason: z.enum(['late-night', 'impulse', 'unusual', 'large']).nullable().optional(),
})

// GET /api/transactions
// Query params:
//   user_id (required)  - which user
//   type=recent|period|categories|weekly|daily|flagged|stats (default: recent)
//   days=30             - period in days
//   limit=50            - max rows for recent
//   category=Food       - filter by category
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const userIdParam = searchParams.get('user_id')
    if (!userIdParam) {
      return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 })
    }

    const userId = parseInt(userIdParam, 10)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'user_id must be a valid integer' }, { status: 400 })
    }

    const type = searchParams.get('type') ?? 'recent'
    const days = parseInt(searchParams.get('days') ?? '30', 10)
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const category = searchParams.get('category')

    switch (type) {
      case 'recent': {
        if (category) {
          const transactions = await getTransactionsByCategory(userId, category, limit)
          return NextResponse.json({ transactions, count: transactions.length, category })
        }
        const transactions = await getTransactions(userId, limit)
        return NextResponse.json({ transactions, count: transactions.length })
      }

      case 'period': {
        const transactions = await getTransactionsByPeriod(userId, days)
        return NextResponse.json({ transactions, count: transactions.length, days })
      }

      case 'categories': {
        const categories = await getCategoryBreakdown(userId, days)
        return NextResponse.json({ categories, days })
      }

      case 'weekly': {
        const weekly = await getWeeklySpending(userId)
        return NextResponse.json({ weekly })
      }

      case 'daily': {
        const daily = await getDailySpending(userId, days)
        return NextResponse.json({ daily, days })
      }

      case 'flagged': {
        const flagged = await getFlaggedTransactions(userId, limit)
        return NextResponse.json({ flagged, count: flagged.length })
      }

      case 'stats': {
        const [stats, user] = await Promise.all([
          getMonthlyStats(userId),
          getUser(userId),
        ])
        const budget = Number(user?.monthly_budget ?? 0)
        const totalSpent = Number(stats.total_spent ?? 0)
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
        const dayOfMonth = new Date().getDate()
        const projectedSpend = dayOfMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : 0
        const budgetUsedPct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0

        return NextResponse.json({
          stats: {
            total_spent: totalSpent,
            transaction_count: stats.transaction_count,
            flagged_count: stats.flagged_count,
            flagged_amount: Number(stats.flagged_amount ?? 0),
            budget,
            budget_used_pct: budgetUsedPct,
            projected_spend: Math.round(projectedSpend),
            days_remaining: daysInMonth - dayOfMonth,
            is_over_budget: projectedSpend > budget,
          },
        })
      }

      default:
        return NextResponse.json({ error: `Invalid type "${type}". Valid types: recent, period, categories, weekly, daily, flagged, stats` }, { status: 400 })
    }
  } catch (error) {
    console.error('[GET /api/transactions]', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

// POST /api/transactions - create a new transaction
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateTransactionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Auto-flag late-night transactions if time is between 22:00 and 04:59
    let { is_flagged, flag_reason } = parsed.data
    if (!is_flagged && !flag_reason) {
      const txDate = parsed.data.date ? new Date(parsed.data.date) : new Date()
      const hour = txDate.getHours()
      if (hour >= 22 || hour <= 4) {
        is_flagged = true
        flag_reason = 'late-night'
      }
    }

    const transaction = await createTransaction({ ...parsed.data, is_flagged, flag_reason })
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/transactions]', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}

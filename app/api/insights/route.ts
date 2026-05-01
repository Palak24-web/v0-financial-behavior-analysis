import { NextRequest, NextResponse } from 'next/server'
import {
  getBehaviorInsights,
  createBehaviorInsight,
  getMonthlyStats,
  getUser,
} from '@/lib/db'
import { z } from 'zod'

const CreateInsightSchema = z.object({
  user_id: z.number().int().positive(),
  type: z.enum(['pattern', 'anomaly', 'trend', 'forecast', 'positive']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  action: z.string().max(500).nullable().optional(),
  severity: z.enum(['info', 'warning', 'danger']),
})

// GET /api/insights
// Query params:
//   user_id (required)
//   type=pattern|anomaly|trend|forecast|positive   (optional filter)
//   severity=info|warning|danger                    (optional filter)
//   include=stats                                   (adds budget stats alongside)
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

    const typeFilter = searchParams.get('type')
    const severityFilter = searchParams.get('severity')
    const include = searchParams.get('include')

    let insights = await getBehaviorInsights(userId)

    // Apply optional filters
    if (typeFilter) {
      insights = insights.filter((i) => i.type === typeFilter)
    }
    if (severityFilter) {
      insights = insights.filter((i) => i.severity === severityFilter)
    }

    if (include === 'stats') {
      const [stats, user] = await Promise.all([
        getMonthlyStats(userId),
        getUser(userId),
      ])
      const budget = Number(user?.monthly_budget ?? 0)
      const totalSpent = Number(stats.total_spent ?? 0)
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const dayOfMonth = new Date().getDate()
      const projectedSpend = dayOfMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : 0

      return NextResponse.json({
        insights,
        count: insights.length,
        stats: {
          total_spent: totalSpent,
          transaction_count: stats.transaction_count,
          flagged_count: stats.flagged_count,
          flagged_amount: Number(stats.flagged_amount ?? 0),
          budget,
          budget_used_pct: budget > 0 ? Math.round((totalSpent / budget) * 100) : 0,
          projected_spend: Math.round(projectedSpend),
          days_remaining: daysInMonth - dayOfMonth,
          is_over_budget: projectedSpend > budget,
        },
        user: user
          ? { name: user.name, monthly_income: user.monthly_income, monthly_budget: user.monthly_budget }
          : null,
      })
    }

    return NextResponse.json({ insights, count: insights.length })
  } catch (error) {
    console.error('[GET /api/insights]', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

// POST /api/insights - create a new insight
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateInsightSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const insight = await createBehaviorInsight(parsed.data)
    return NextResponse.json({ insight }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/insights]', error)
    return NextResponse.json({ error: 'Failed to create insight' }, { status: 500 })
  }
}

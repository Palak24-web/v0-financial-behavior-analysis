import { NextResponse } from 'next/server'
import { getBehaviorInsights, getMonthlyStats, getUser } from '@/lib/db'

export async function GET() {
  try {
    const userId = 1
    const [insights, stats, user] = await Promise.all([
      getBehaviorInsights(userId),
      getMonthlyStats(userId),
      getUser(userId),
    ])

    const budget = user?.monthly_budget ?? 3200
    const totalSpent = Number(stats.total_spent ?? 0)
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const dayOfMonth = new Date().getDate()
    const projectedSpend = (totalSpent / dayOfMonth) * daysInMonth
    const budgetUsedPct = Math.round((totalSpent / budget) * 100)

    return NextResponse.json({
      insights,
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
      user: user ? { name: user.name, monthly_income: user.monthly_income, monthly_budget: user.monthly_budget } : null,
    })
  } catch (error) {
    console.error('[insights api]', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

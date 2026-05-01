import { NextRequest, NextResponse } from 'next/server'
import { getUser, updateUser, deleteUser, getMonthlyStats, getBehaviorInsights } from '@/lib/db'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  monthly_income: z.number().positive().optional(),
  monthly_budget: z.number().positive().optional(),
})

type Params = { params: Promise<{ id: string }> }

// GET /api/users/[id] - get a single user with stats
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const userId = parseInt(id, 10)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const includeStats = searchParams.get('include') === 'stats'
    const includeInsights = searchParams.get('include') === 'insights'

    const user = await getUser(userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (includeStats) {
      const stats = await getMonthlyStats(userId)
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const dayOfMonth = new Date().getDate()
      const totalSpent = Number(stats.total_spent ?? 0)
      const projectedSpend = (totalSpent / dayOfMonth) * daysInMonth
      const budgetUsedPct = Math.round((totalSpent / Number(user.monthly_budget)) * 100)

      return NextResponse.json({
        user,
        stats: {
          total_spent: totalSpent,
          transaction_count: stats.transaction_count,
          flagged_count: stats.flagged_count,
          flagged_amount: Number(stats.flagged_amount ?? 0),
          budget: Number(user.monthly_budget),
          budget_used_pct: budgetUsedPct,
          projected_spend: Math.round(projectedSpend),
          days_remaining: daysInMonth - dayOfMonth,
          is_over_budget: projectedSpend > Number(user.monthly_budget),
        },
      })
    }

    if (includeInsights) {
      const insights = await getBehaviorInsights(userId)
      return NextResponse.json({ user, insights })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[GET /api/users/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PATCH /api/users/[id] - update a user
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const userId = parseInt(id, 10)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = UpdateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await getUser(userId)
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const user = await updateUser(userId, parsed.data)
    return NextResponse.json({ user })
  } catch (error) {
    console.error('[PATCH /api/users/[id]]', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE /api/users/[id] - delete a user
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const userId = parseInt(id, 10)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const existing = await getUser(userId)
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await deleteUser(userId)
    return NextResponse.json({ message: `User ${userId} deleted successfully` })
  } catch (error) {
    console.error('[DELETE /api/users/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}

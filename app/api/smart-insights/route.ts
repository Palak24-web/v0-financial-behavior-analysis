import { NextRequest, NextResponse } from 'next/server'
import {
  getTransactionsByPeriod,
  getCategoryBreakdown,
  getMonthlyStats,
  getUser,
  getFlaggedTransactions,
  getWeeklySpending,
  createBehaviorInsight,
} from '@/lib/db'

// ─── Thresholds ───────────────────────────────────────────────────────────────
const FOOD_FREQ_THRESHOLD = 4       // food orders in 7 days to trigger nudge
const LATE_NIGHT_THRESHOLD = 3      // late-night purchases in 7 days
const IMPULSE_THRESHOLD = 2         // impulse-flagged transactions in 7 days
const CATEGORY_BUDGET_PCT = 0.45    // single category > 45% of budget = warning
const WEEKLY_SPIKE_PCT = 40         // week-over-week increase % to warn

export interface SmartInsight {
  id: string
  type: 'food_frequency' | 'late_night' | 'impulse' | 'category_overspend' | 'weekly_spike' | 'budget_pace' | 'positive'
  severity: 'info' | 'warning' | 'danger'
  title: string
  message: string
  action: string
  value?: number
  category?: string
}

// GET /api/smart-insights?user_id=1
// Runs all pattern detectors in parallel against live DB data.
// Returns triggered insights sorted by severity (danger first).
// Optionally saves them to the DB with &save=true.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = parseInt(searchParams.get('user_id') ?? '1', 10)
    const save = searchParams.get('save') === 'true'

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
    }

    // Fetch all data in parallel — one DB round-trip per data source
    const [transactions7d, categories, stats, user, flagged7d, weekly] = await Promise.all([
      getTransactionsByPeriod(userId, 7),
      getCategoryBreakdown(userId, 30),
      getMonthlyStats(userId),
      getUser(userId),
      getFlaggedTransactions(userId, 50),
      getWeeklySpending(userId),
    ])

    const budget = Number(user?.monthly_budget ?? 0)
    const totalSpent = Number(stats.total_spent ?? 0)
    const dayOfMonth = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const projected = dayOfMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : 0

    const triggered: SmartInsight[] = []

    // ── 1. Frequent food spending ──────────────────────────────────────────────
    const foodTx7d = transactions7d.filter(
      (t) => t.category?.toLowerCase().includes('food') || t.category?.toLowerCase().includes('dining')
    )
    if (foodTx7d.length >= FOOD_FREQ_THRESHOLD) {
      const total = foodTx7d.reduce((s, t) => s + Number(t.amount), 0)
      triggered.push({
        id: 'food_frequency',
        type: 'food_frequency',
        severity: foodTx7d.length >= 7 ? 'danger' : 'warning',
        title: 'Frequent Food Spending',
        message: `You've been ordering food ${foodTx7d.length} times this week, spending $${total.toFixed(0)} total. This is becoming a habit.`,
        action: 'Try meal prepping 3 days this week — you could save $30-50 easily.',
        value: foodTx7d.length,
        category: 'Food',
      })
    }

    // ── 2. Late-night purchases ────────────────────────────────────────────────
    const lateNight7d = flagged7d.filter((t) => {
      const date = new Date(t.date)
      const dayAgo = new Date()
      dayAgo.setDate(dayAgo.getDate() - 7)
      return t.flag_reason === 'late-night' && date >= dayAgo
    })
    if (lateNight7d.length >= LATE_NIGHT_THRESHOLD) {
      const total = lateNight7d.reduce((s, t) => s + Number(t.amount), 0)
      triggered.push({
        id: 'late_night',
        type: 'late_night',
        severity: lateNight7d.length >= 5 ? 'danger' : 'warning',
        title: 'Late-Night Spending Pattern',
        message: `You made ${lateNight7d.length} purchases after 10 PM this week totaling $${total.toFixed(0)}. Late-night spending is often impulsive.`,
        action: 'Set a "no spending after 10 PM" rule for the rest of the week.',
        value: lateNight7d.length,
      })
    }

    // ── 3. Impulse buying ─────────────────────────────────────────────────────
    const impulse7d = flagged7d.filter((t) => {
      const date = new Date(t.date)
      const dayAgo = new Date()
      dayAgo.setDate(dayAgo.getDate() - 7)
      return t.flag_reason === 'impulse' && date >= dayAgo
    })
    if (impulse7d.length >= IMPULSE_THRESHOLD) {
      triggered.push({
        id: 'impulse',
        type: 'impulse',
        severity: impulse7d.length >= 4 ? 'danger' : 'warning',
        title: 'Impulse Buying Detected',
        message: `${impulse7d.length} of your recent transactions were flagged as impulse purchases. These unplanned buys add up fast.`,
        action: 'Apply the 48-hour rule before your next unplanned purchase over $20.',
        value: impulse7d.length,
      })
    }

    // ── 4. Category overspend ─────────────────────────────────────────────────
    if (budget > 0 && categories.length > 0) {
      const topCategory = categories[0]
      const catPct = Number(topCategory.total) / budget
      if (catPct >= CATEGORY_BUDGET_PCT) {
        triggered.push({
          id: 'category_overspend',
          type: 'category_overspend',
          severity: catPct >= 0.65 ? 'danger' : 'warning',
          title: `Heavy ${topCategory.category} Spending`,
          message: `${topCategory.category} accounts for ${(catPct * 100).toFixed(0)}% of your monthly budget ($${Number(topCategory.total).toFixed(0)} of $${budget}).`,
          action: `Cap your ${topCategory.category} spending for the rest of the month to stay balanced.`,
          value: Math.round(catPct * 100),
          category: topCategory.category,
        })
      }
    }

    // ── 5. Weekly spending spike ──────────────────────────────────────────────
    if (weekly.length >= 2) {
      const latest = Number(weekly[weekly.length - 1].amount)
      const prev = Number(weekly[weekly.length - 2].amount)
      const spikePct = prev > 0 ? ((latest - prev) / prev) * 100 : 0
      if (spikePct >= WEEKLY_SPIKE_PCT) {
        triggered.push({
          id: 'weekly_spike',
          type: 'weekly_spike',
          severity: spikePct >= 80 ? 'danger' : 'warning',
          title: 'Spending Spike This Week',
          message: `Your spending jumped ${spikePct.toFixed(0)}% compared to last week ($${latest.toFixed(0)} vs $${prev.toFixed(0)}). This is a significant increase.`,
          action: 'Identify the biggest single expense this week and avoid repeating it.',
          value: Math.round(spikePct),
        })
      }
    }

    // ── 6. Budget pace warning ────────────────────────────────────────────────
    if (budget > 0 && dayOfMonth > 3) {
      if (projected > budget * 1.15) {
        triggered.push({
          id: 'budget_pace',
          type: 'budget_pace',
          severity: projected > budget * 1.35 ? 'danger' : 'warning',
          title: 'On Pace to Exceed Budget',
          message: `At your current spending rate, you will spend $${projected.toFixed(0)} this month — $${(projected - budget).toFixed(0)} over your $${budget} budget.`,
          action: `Reduce spending by $${Math.ceil((projected - budget) / (daysInMonth - dayOfMonth))} per day for the remaining ${daysInMonth - dayOfMonth} days.`,
          value: Math.round(projected),
        })
      } else if (projected < budget * 0.8 && totalSpent > 0) {
        // Positive insight
        triggered.push({
          id: 'positive',
          type: 'positive',
          severity: 'info',
          title: 'Well Under Budget',
          message: `You are on pace to finish $${(budget - projected).toFixed(0)} under your $${budget} budget. Great discipline this month!`,
          action: 'Move the surplus to savings or investments at month end.',
          value: Math.round(budget - projected),
        })
      }
    }

    // Sort: danger first, then warning, then info
    const severityOrder = { danger: 0, warning: 1, info: 2 }
    triggered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    // Optionally persist to DB
    let savedCount = 0
    if (save && triggered.length > 0) {
      const typeMap: Record<SmartInsight['type'], 'pattern' | 'anomaly' | 'trend' | 'forecast' | 'positive'> = {
        food_frequency: 'pattern',
        late_night: 'pattern',
        impulse: 'anomaly',
        category_overspend: 'trend',
        weekly_spike: 'trend',
        budget_pace: 'forecast',
        positive: 'positive',
      }
      for (const ins of triggered) {
        try {
          await createBehaviorInsight({
            user_id: userId,
            type: typeMap[ins.type],
            title: ins.title,
            description: ins.message,
            action: ins.action,
            severity: ins.severity,
          })
          savedCount++
        } catch {
          // Skip duplicate or DB error, continue
        }
      }
    }

    return NextResponse.json({
      user_id: userId,
      triggered_count: triggered.length,
      saved_count: savedCount,
      insights: triggered,
      snapshot: {
        food_orders_7d: foodTx7d.length,
        late_night_7d: lateNight7d.length,
        impulse_7d: impulse7d.length,
        total_spent: totalSpent,
        budget,
        projected_month_end: Math.round(projected),
      },
    })
  } catch (error) {
    console.error('[GET /api/smart-insights]', error)
    return NextResponse.json({ error: 'Failed to run smart insight detection' }, { status: 500 })
  }
}

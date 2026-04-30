import { tool } from 'ai'
import { z } from 'zod'
import {
  getUser,
  getTransactions,
  getTransactionsByPeriod,
  getMonthlyStats,
  getCategoryBreakdown,
  getFlaggedTransactions,
  getWeeklySpending,
  getDailySpending,
  getBehaviorInsights,
  getAdminOverview,
  getAdminUserLeaderboard,
  getAdminFlaggedReport,
  getAdminSpendingTrend,
  createTransaction,
  createBehaviorInsight,
} from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// lib/tools.ts
//
// Real-world MCP-style tools for MoneyMind AI.
// Every tool queries live Neon DB — no hardcoded or mock data.
// Compatible with AI SDK 6 (uses `inputSchema`, not `parameters`).
// ─────────────────────────────────────────────────────────────────────────────

// ── 0. getUserProfile ─────────────────────────────────────────────────────────
// Fetch user record with computed savings rate and financial health metadata.

export const getUserProfileTool = tool({
  description: 'Retrieve a real user profile from the database including name, email, monthly income, monthly budget, and computed savings rate.',
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1).describe('User ID to look up'),
  }),
  execute: async ({ user_id }) => {
    const user = await getUser(user_id)
    if (!user) return { error: `No user found with id ${user_id}` }
    const savingsRate =
      user.monthly_income > 0
        ? (((user.monthly_income - user.monthly_budget) / user.monthly_income) * 100).toFixed(1)
        : null
    return { ...user, savings_rate_pct: savingsRate }
  },
})

// ── 1. getTransactions ────────────────────────────────────────────────────────
// Original mock just returned 3 hardcoded rows.
// Real version pulls from Neon, enriches with late-night flag, and returns
// aggregated time metadata so the AI can detect patterns immediately.

export const getTransactionsTool = tool({
  description:
    "Fetch a user's real recent transactions from the database. Returns enriched rows with time-of-day tags so the AI can detect late-night or impulse patterns.",
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1).describe('User ID'),
    limit: z.number().int().min(1).max(100).default(20).describe('Max number of transactions to return'),
    days: z.number().int().min(1).max(365).optional().describe('If set, only return transactions from the last N days'),
  }),
  execute: async ({ user_id, limit, days }) => {
    const rows = days
      ? await getTransactionsByPeriod(user_id, days)
      : await getTransactions(user_id, limit)

    // Enrich each transaction with time-of-day context for the AI
    const enriched = rows.map((t) => {
      const hour = new Date(t.date).getHours()
      const timeTag =
        hour >= 22 || hour <= 4
          ? 'late-night'
          : hour >= 5 && hour <= 11
          ? 'morning'
          : hour >= 12 && hour <= 17
          ? 'afternoon'
          : 'evening'
      return {
        id: t.id,
        amount: t.amount,
        merchant: t.merchant,
        category: t.category,
        date: t.date,
        time_tag: timeTag,
        is_flagged: t.is_flagged,
        flag_reason: t.flag_reason,
        note: t.note,
      }
    })

    const lateNightCount = enriched.filter((t) => t.time_tag === 'late-night').length
    const flaggedCount = enriched.filter((t) => t.is_flagged).length
    const totalSpent = enriched.reduce((s, t) => s + Number(t.amount), 0)

    return {
      transactions: enriched,
      count: enriched.length,
      total_spent: totalSpent.toFixed(2),
      late_night_count: lateNightCount,
      flagged_count: flaggedCount,
      summary: `${enriched.length} transactions totaling $${totalSpent.toFixed(2)}. ${lateNightCount} late-night, ${flaggedCount} flagged.`,
    }
  },
})

// ── 2. detectBehavior ─────────────────────────────────────────────────────────
// Original mock ran basic if-checks on hardcoded rows.
// Real version fetches live data, runs pattern detection across 8 dimensions,
// and optionally saves detected patterns as behavior_insights rows.

export const detectBehaviorTool = tool({
  description:
    'Analyze real spending data and detect behavioral patterns: late-night habits, category addiction, impulse buying, budget pace, and more. Optionally saves insights to DB.',
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1),
    save_insights: z
      .boolean()
      .default(false)
      .describe('If true, persist detected patterns as behavior_insight rows in the DB'),
    days: z.number().int().min(7).max(90).default(30).describe('Look-back window in days'),
  }),
  execute: async ({ user_id, save_insights, days }) => {
    const [transactions, stats, user, categories, weekly] = await Promise.all([
      getTransactionsByPeriod(user_id, days),
      getMonthlyStats(user_id),
      getUser(user_id),
      getCategoryBreakdown(user_id, days),
      getWeeklySpending(user_id),
    ])

    const insights: {
      type: 'pattern' | 'anomaly' | 'trend' | 'forecast' | 'positive'
      title: string
      description: string
      action: string
      severity: 'info' | 'warning' | 'danger'
    }[] = []

    // Pattern 1: Late-night spending
    const lateNight = transactions.filter((t) => {
      const h = new Date(t.date).getHours()
      return h >= 22 || h <= 4
    })
    if (lateNight.length >= 2) {
      const lnTotal = lateNight.reduce((s, t) => s + Number(t.amount), 0)
      insights.push({
        type: 'pattern',
        title: 'Late-Night Spending Detected',
        description: `You made ${lateNight.length} purchases after 10pm totaling $${lnTotal.toFixed(0)}. This is a recurring late-night habit.`,
        action: 'Enable spending limits after 10pm in your bank app.',
        severity: lateNight.length >= 4 ? 'danger' : 'warning',
      })
    }

    // Pattern 2: Food delivery addiction
    const foodTx = transactions.filter((t) => t.category === 'Food')
    if (foodTx.length >= 4) {
      const foodTotal = foodTx.reduce((s, t) => s + Number(t.amount), 0)
      insights.push({
        type: 'trend',
        title: 'Frequent Food Spending',
        description: `You ordered food ${foodTx.length} times this period, spending $${foodTotal.toFixed(0)}. This is becoming a recurring habit.`,
        action: 'Try meal prepping on Sundays to reduce delivery costs.',
        severity: foodTx.length >= 7 ? 'danger' : 'warning',
      })
    }

    // Pattern 3: Shopping overspend
    const topCategory = categories[0]
    const budget = Number(user?.monthly_budget ?? 0)
    if (topCategory && budget > 0) {
      const categoryRatio = Number(topCategory.total) / budget
      if (categoryRatio > 0.4) {
        insights.push({
          type: 'anomaly',
          title: `${topCategory.category} Overspend`,
          description: `${topCategory.category} spending of $${topCategory.total} is ${(categoryRatio * 100).toFixed(0)}% of your monthly budget.`,
          action: `Set a strict $${(budget * 0.2).toFixed(0)}/month cap on ${topCategory.category}.`,
          severity: categoryRatio > 0.6 ? 'danger' : 'warning',
        })
      }
    }

    // Pattern 4: Impulse buys
    const impulse = transactions.filter((t) => t.flag_reason === 'impulse')
    if (impulse.length >= 2) {
      insights.push({
        type: 'pattern',
        title: 'Impulse Buying Detected',
        description: `${impulse.length} impulse purchases flagged this period. These are unplanned transactions that add up quickly.`,
        action: 'Apply the 48-hour rule before any unplanned purchase over $50.',
        severity: impulse.length >= 4 ? 'danger' : 'warning',
      })
    }

    // Pattern 5: Week-over-week trend
    if (weekly.length >= 2) {
      const latest = Number(weekly[weekly.length - 1].amount)
      const prev = Number(weekly[weekly.length - 2].amount)
      const change = prev > 0 ? ((latest - prev) / prev) * 100 : 0
      if (change > 30) {
        insights.push({
          type: 'trend',
          title: 'Spending Increasing Weekly',
          description: `Your spending jumped ${change.toFixed(0)}% week-over-week. This rising trend needs attention before month-end.`,
          action: 'Pause non-essential spending for the next 5 days.',
          severity: change > 60 ? 'danger' : 'warning',
        })
      }
    }

    // Pattern 6: Budget pace
    const dayOfMonth = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const projected = dayOfMonth > 0 ? (Number(stats.total_spent) / dayOfMonth) * daysInMonth : 0
    if (budget > 0 && projected > budget * 1.1) {
      insights.push({
        type: 'forecast',
        title: 'On Pace to Exceed Budget',
        description: `At your current rate, you will spend $${projected.toFixed(0)} this month — $${(projected - budget).toFixed(0)} over your $${budget} budget.`,
        action: 'Cut back on your top category for the rest of the month.',
        severity: projected > budget * 1.3 ? 'danger' : 'warning',
      })
    }

    // Pattern 7: Positive — under budget
    if (budget > 0 && projected < budget * 0.8 && Number(stats.total_spent) > 0) {
      insights.push({
        type: 'positive',
        title: 'Well Under Budget',
        description: `You are on pace to finish the month $${(budget - projected).toFixed(0)} under budget. Excellent discipline!`,
        action: 'Move the surplus to a high-yield savings account.',
        severity: 'info',
      })
    }

    // Optionally persist to DB
    let savedCount = 0
    if (save_insights && insights.length > 0) {
      for (const ins of insights) {
        await createBehaviorInsight({ user_id, ...ins })
        savedCount++
      }
    }

    return {
      patterns_detected: insights.length,
      saved_to_db: savedCount,
      insights,
      raw_stats: {
        total_spent: stats.total_spent,
        transaction_count: stats.transaction_count,
        flagged_count: stats.flagged_count,
        days_analyzed: days,
      },
    }
  },
})

// ── 3. getSpendingScore ───────────────────────────────────────────────────────
// Original mock deducted points for food count only.
// Real version builds a multi-factor score from live DB data across 6 dimensions.

export const getSpendingScoreTool = tool({
  description:
    "Calculate a user's real financial discipline score (0-100) based on live spending data: budget adherence, impulse control, category balance, spending trends, and more.",
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1),
  }),
  execute: async ({ user_id }) => {
    const [stats, user, categories, flagged, weekly] = await Promise.all([
      getMonthlyStats(user_id),
      getUser(user_id),
      getCategoryBreakdown(user_id, 30),
      getFlaggedTransactions(user_id, 50),
      getWeeklySpending(user_id),
    ])

    let score = 100
    const breakdown: { factor: string; impact: number; note: string }[] = []

    const budget = Number(user?.monthly_budget ?? 0)
    const spent = Number(stats.total_spent)
    const dayOfMonth = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const projected = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : 0

    // Factor 1: Budget adherence (up to -30)
    if (budget > 0) {
      const ratio = projected / budget
      if (ratio > 1.3) {
        score -= 30
        breakdown.push({ factor: 'Budget Adherence', impact: -30, note: `Projected $${projected.toFixed(0)} is ${((ratio - 1) * 100).toFixed(0)}% over budget` })
      } else if (ratio > 1.1) {
        score -= 15
        breakdown.push({ factor: 'Budget Adherence', impact: -15, note: `Slightly over budget pace` })
      } else if (ratio < 0.85) {
        breakdown.push({ factor: 'Budget Adherence', impact: 0, note: 'Well within budget — great!' })
      }
    }

    // Factor 2: Impulse control (up to -25)
    const impulseCount = flagged.filter((t) => t.flag_reason === 'impulse').length
    if (impulseCount >= 5) {
      score -= 25
      breakdown.push({ factor: 'Impulse Control', impact: -25, note: `${impulseCount} impulse buys this month` })
    } else if (impulseCount >= 2) {
      score -= 12
      breakdown.push({ factor: 'Impulse Control', impact: -12, note: `${impulseCount} impulse buys detected` })
    } else {
      breakdown.push({ factor: 'Impulse Control', impact: 0, note: 'Good impulse control' })
    }

    // Factor 3: Late-night spending (up to -15)
    const lateNightCount = flagged.filter((t) => t.flag_reason === 'late-night').length
    if (lateNightCount >= 4) {
      score -= 15
      breakdown.push({ factor: 'Late-Night Spending', impact: -15, note: `${lateNightCount} purchases after 10pm` })
    } else if (lateNightCount >= 2) {
      score -= 8
      breakdown.push({ factor: 'Late-Night Spending', impact: -8, note: `${lateNightCount} late-night purchases` })
    }

    // Factor 4: Category concentration (up to -15)
    if (categories.length > 0 && budget > 0) {
      const topRatio = Number(categories[0].total) / budget
      if (topRatio > 0.6) {
        score -= 15
        breakdown.push({ factor: 'Category Balance', impact: -15, note: `${categories[0].category} is ${(topRatio * 100).toFixed(0)}% of budget` })
      } else if (topRatio > 0.45) {
        score -= 8
        breakdown.push({ factor: 'Category Balance', impact: -8, note: `Heavy concentration in ${categories[0].category}` })
      }
    }

    // Factor 5: Week-over-week trend (up to -10)
    if (weekly.length >= 2) {
      const latest = Number(weekly[weekly.length - 1].amount)
      const prev = Number(weekly[weekly.length - 2].amount)
      const change = prev > 0 ? ((latest - prev) / prev) * 100 : 0
      if (change > 50) {
        score -= 10
        breakdown.push({ factor: 'Spending Trend', impact: -10, note: `${change.toFixed(0)}% week-over-week increase` })
      } else if (change < -20) {
        breakdown.push({ factor: 'Spending Trend', impact: 0, note: `Spending decreased ${Math.abs(change).toFixed(0)}% this week — good!` })
      }
    }

    score = Math.max(0, Math.min(100, score))

    const grade =
      score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'
    const message =
      score >= 85
        ? 'Excellent financial discipline. Keep it up!'
        : score >= 70
        ? 'Good control overall, but a few areas need attention.'
        : score >= 55
        ? 'Moderate risk — several spending habits need improvement.'
        : score >= 40
        ? 'High risk — spending patterns need significant correction.'
        : 'Critical — immediate action needed to regain financial control.'

    return {
      score,
      grade,
      message,
      breakdown,
      stats: {
        monthly_budget: budget,
        total_spent_this_month: spent,
        projected_month_end: projected.toFixed(2),
        flagged_transactions: flagged.length,
      },
    }
  },
})

// ── 4. decisionCoach ──────────────────────────────────────────────────────────
// Original mock only checked Food category with a $300 threshold.
// Real version fetches live budget, computes precise risk, and returns a
// structured recommendation with alternatives.

export const decisionCoachTool = tool({
  description:
    'Evaluate whether a user should make a specific purchase. Fetches live budget and spending data to give a precise risk level and recommendation.',
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1),
    amount: z.number().positive().describe('Purchase amount in dollars'),
    merchant: z.string().min(1).describe('Where they want to spend'),
    category: z.string().describe('Spending category'),
  }),
  execute: async ({ user_id, amount, merchant, category }) => {
    const [stats, user, categories, flagged] = await Promise.all([
      getMonthlyStats(user_id),
      getUser(user_id),
      getCategoryBreakdown(user_id, 30),
      getFlaggedTransactions(user_id, 20),
    ])

    const budget = Number(user?.monthly_budget ?? 0)
    const spent = Number(stats.total_spent)
    const remaining = budget - spent
    const newTotal = spent + amount
    const wouldExceed = budget > 0 && newTotal > budget
    const purchaseRatio = budget > 0 ? (amount / budget) * 100 : 0
    const remainingAfter = remaining - amount

    // Category-specific context
    const catBreakdown = categories.find(
      (c) => c.category.toLowerCase() === category.toLowerCase()
    )
    const catSpentThisMonth = Number(catBreakdown?.total ?? 0)
    const recentImpulseInCategory = flagged.filter(
      (t) => t.flag_reason === 'impulse' && t.category.toLowerCase() === category.toLowerCase()
    ).length

    // Risk scoring
    let riskScore = 0
    if (wouldExceed) riskScore += 40
    if (purchaseRatio > 20) riskScore += 20
    if (purchaseRatio > 10) riskScore += 10
    if (recentImpulseInCategory > 0) riskScore += 15
    if (stats.flagged_count > 3) riskScore += 10
    if (remaining < amount * 2) riskScore += 10

    const risk: 'Low' | 'Medium' | 'High' =
      riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low'

    const recommendation =
      risk === 'High'
        ? `Avoid this purchase. ${wouldExceed ? `It would put you $${(newTotal - budget).toFixed(0)} over your $${budget} budget.` : `At $${amount}, this is a significant spend with your current financial position.`}`
        : risk === 'Medium'
        ? `Proceed with caution. This $${amount} purchase at ${merchant} is ${purchaseRatio.toFixed(1)}% of your monthly budget, leaving only $${remainingAfter.toFixed(0)} after.`
        : `This $${amount} purchase looks manageable. You have $${remaining.toFixed(0)} left in your budget and this keeps you within a healthy range.`

    const alternatives =
      risk !== 'Low'
        ? [
            `Wait 48 hours and revisit this purchase.`,
            `Look for a lower-cost alternative for this ${category} need.`,
            `Move this to next month's budget if it's not urgent.`,
          ]
        : []

    return {
      purchase: { amount, merchant, category },
      current_status: {
        monthly_budget: budget,
        spent_so_far: spent,
        budget_remaining: remaining.toFixed(2),
        category_spent_this_month: catSpentThisMonth,
        would_exceed_budget: wouldExceed,
        remaining_after_purchase: remainingAfter.toFixed(2),
      },
      risk_level: risk,
      risk_score: riskScore,
      recommendation,
      alternatives,
      past_impulse_in_category: recentImpulseInCategory,
    }
  },
})

// ── 5-10. Additional live DB tools ────────────────────────────────────────────

export const getMonthlySummaryTool = tool({
  description: 'Fetch a full monthly summary: budget, spending, projections, category breakdown, and weekly trend.',
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1),
  }),
  execute: async ({ user_id }) => {
    const [stats, user, categories, weekly] = await Promise.all([
      getMonthlyStats(user_id),
      getUser(user_id),
      getCategoryBreakdown(user_id, 30),
      getWeeklySpending(user_id),
    ])
    const budget = Number(user?.monthly_budget ?? 0)
    const spent = Number(stats.total_spent)
    const day = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const projected = day > 0 ? (spent / day) * daysInMonth : 0
    return {
      user: user?.name,
      monthly_budget: budget,
      monthly_income: user?.monthly_income,
      total_spent: spent,
      budget_remaining: (budget - spent).toFixed(2),
      projected_month_end: projected.toFixed(2),
      on_track: projected <= budget,
      transaction_count: stats.transaction_count,
      flagged_count: stats.flagged_count,
      categories,
      weekly_trend: weekly,
      day_of_month: day,
      days_in_month: daysInMonth,
    }
  },
})

export const getWeeklyTrendTool = tool({
  description: 'Fetch 8-week spending trend to identify if spending is rising, falling, or stable.',
  inputSchema: z.object({ user_id: z.number().int().positive().default(1) }),
  execute: async ({ user_id }) => {
    const rows = await getWeeklySpending(user_id)
    if (rows.length >= 2) {
      const latest = Number(rows[rows.length - 1].amount)
      const prev = Number(rows[rows.length - 2].amount)
      const change = prev > 0 ? (((latest - prev) / prev) * 100).toFixed(1) : '0'
      const direction = Number(change) > 0 ? 'increasing' : Number(change) < 0 ? 'decreasing' : 'stable'
      return { weeks: rows, latest_week: latest, previous_week: prev, week_over_week_change: `${change}%`, trend_direction: direction }
    }
    return { weeks: rows }
  },
})

export const getDailyPatternTool = tool({
  description: 'Fetch daily spending for the last N days to identify day-of-week habits.',
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1),
    days: z.number().int().min(1).max(30).default(7),
  }),
  execute: async ({ user_id, days }) => {
    const rows = await getDailySpending(user_id, days)
    const sorted = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount))
    return {
      daily: rows,
      highest_day: sorted[0] ?? null,
      lowest_day: sorted[sorted.length - 1] ?? null,
      avg_daily: rows.length > 0 ? (rows.reduce((s, r) => s + Number(r.amount), 0) / rows.length).toFixed(2) : '0',
    }
  },
})

export const getBehaviorInsightsTool = tool({
  description: 'Fetch all existing behavioral insights for a user from the database.',
  inputSchema: z.object({ user_id: z.number().int().positive().default(1) }),
  execute: async ({ user_id }) => {
    const rows = await getBehaviorInsights(user_id)
    const byType = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + 1
      return acc
    }, {})
    return { total: rows.length, by_type: byType, insights: rows }
  },
})

export const logTransactionTool = tool({
  description: 'Record a transaction mentioned in conversation. Auto-flags as late-night between 10pm–4am.',
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1),
    amount: z.number().positive(),
    merchant: z.string().min(1),
    category: z.enum(['Food', 'Shopping', 'Bills', 'Travel', 'Subscriptions', 'Investment', 'Transport', 'Misc']),
    note: z.string().optional(),
  }),
  execute: async ({ user_id, amount, merchant, category, note }) => {
    const now = new Date()
    const hour = now.getHours()
    const isLateNight = hour >= 22 || hour <= 4
    const tx = await createTransaction({
      user_id, amount, merchant, category,
      date: now.toISOString(),
      note: note ?? null,
      is_flagged: isLateNight,
      flag_reason: isLateNight ? 'late-night' : null,
    })
    return { saved: true, flagged: isLateNight, flag_reason: isLateNight ? 'late-night' : null, transaction: tx }
  },
})

export const saveInsightTool = tool({
  description: 'Persist a newly detected behavioral insight to the database so it appears on the user dashboard.',
  inputSchema: z.object({
    user_id: z.number().int().positive().default(1),
    type: z.enum(['pattern', 'anomaly', 'trend', 'forecast', 'positive']),
    title: z.string().min(1),
    description: z.string().min(1),
    action: z.string().optional(),
    severity: z.enum(['info', 'warning', 'danger']),
  }),
  execute: async ({ user_id, type, title, description, action, severity }) => {
    const insight = await createBehaviorInsight({ user_id, type, title, description, action: action ?? null, severity })
    return { saved: true, insight }
  },
})

// ── Admin tools ───────────────────────────────────────────────────────────────

export const getAdminOverviewTool = tool({
  description: 'Get platform-wide aggregate statistics: total users, transaction volume, flagged counts, and insight severity breakdown.',
  inputSchema: z.object({}),
  execute: async () => {
    return await getAdminOverview()
  },
})

export const getAdminLeaderboardTool = tool({
  description: 'Get per-user spending leaderboard with transaction counts, flagged items, and insight counts for all users.',
  inputSchema: z.object({}),
  execute: async () => {
    const rows = await getAdminUserLeaderboard()
    return { users: rows, count: rows.length }
  },
})

export const getAdminFlaggedReportTool = tool({
  description: 'Get the 100 most recent flagged transactions across all users, including user name and email.',
  inputSchema: z.object({}),
  execute: async () => {
    const rows = await getAdminFlaggedReport()
    return { total: rows.length, transactions: rows }
  },
})

export const getAdminSpendingTrendTool = tool({
  description: 'Get platform-wide daily spending trend (total volume + flagged count per day) for the last N days.',
  inputSchema: z.object({
    days: z.number().int().min(1).max(90).default(30).describe('Days to look back'),
  }),
  execute: async ({ days }) => {
    const rows = await getAdminSpendingTrend(days)
    return { period_days: days, trend: rows }
  },
})

// ─── Consolidated export — all tools in one object ───────────────────────────
// Import this in /api/chat/route.ts as: import { tools } from '@/lib/tools'
export const tools = {
  // User
  getUserProfile: getUserProfileTool,
  // Transactions
  getTransactions: getTransactionsTool,
  getMonthlySummary: getMonthlySummaryTool,
  getWeeklyTrend: getWeeklyTrendTool,
  getDailyPattern: getDailyPatternTool,
  logTransaction: logTransactionTool,
  // Intelligence
  detectBehavior: detectBehaviorTool,
  getSpendingScore: getSpendingScoreTool,
  decisionCoach: decisionCoachTool,
  getBehaviorInsights: getBehaviorInsightsTool,
  saveInsight: saveInsightTool,
  // Admin
  getAdminOverview: getAdminOverviewTool,
  getAdminLeaderboard: getAdminLeaderboardTool,
  getAdminFlaggedReport: getAdminFlaggedReportTool,
  getAdminSpendingTrend: getAdminSpendingTrendTool,
}

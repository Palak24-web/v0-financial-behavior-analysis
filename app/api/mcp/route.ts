/**
 * MoneyMind MCP Server — /api/mcp
 *
 * A fully spec-compliant Model Context Protocol (MCP) server built on
 * @modelcontextprotocol/sdk. Every tool here calls the live Neon database
 * via lib/db.ts — zero mock data.
 *
 * Registered MCP tools (18 total):
 * ─────────────────────────────────
 * User
 *   get_user_profile         — user record + computed savings rate
 *   get_monthly_stats        — budget, spend, flagged summary for current month
 *
 * Transactions
 *   get_transactions         — recent transactions with time-of-day enrichment
 *   get_flagged_transactions — late-night + impulse purchases grouped by type
 *   get_category_breakdown   — per-category spend totals for any window
 *   get_weekly_spending      — 8-week trend with week-over-week % change
 *   get_daily_spending       — day-by-day habit data
 *   get_monthly_summary      — full monthly summary in one call
 *   get_daily_pattern        — highest/lowest/avg day breakdown
 *   create_transaction       — insert a transaction, auto-flag late-night
 *
 * Intelligence
 *   detect_behavior          — run pattern detection across 7 dimensions
 *   get_spending_score       — compute 0-100 financial discipline score
 *   decision_coach           — risk level + recommendation for a purchase
 *   save_insight             — persist a detected insight to DB
 *   get_behavior_insights    — fetch all saved insights for a user
 *
 * Admin
 *   get_admin_overview       — platform-wide aggregate stats
 *   get_admin_leaderboard    — per-user spend leaderboard
 *   get_admin_flagged_report — all flagged transactions across users
 *   get_admin_spending_trend — daily platform trend for last N days
 *
 * Transport: WebStandardStreamableHTTP (stateless, serverless-friendly)
 * Endpoint:  POST /api/mcp  (GET + DELETE also handled for MCP lifecycle)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import {
  getUser,
  getMonthlyStats,
  getCategoryBreakdown,
  getTransactions,
  getTransactionsByPeriod,
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

// ─── Helper ───────────────────────────────────────────────────────────────────

function ok(data: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function err(msg: string): { content: { type: 'text'; text: string }[]; isError: true } {
  return { content: [{ type: 'text', text: msg }], isError: true }
}

// ─── Build server (one instance per request — stateless) ─────────────────────

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'moneymind-financial-agent',
    version: '2.0.0',
  })

  // ══════════════════════════════════════════════════════════════════════════
  // USER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  server.tool(
    'get_user_profile',
    'Retrieve a user profile including name, email, monthly income, and monthly budget. Also computes a rough financial health score based on budget size.',
    { user_id: z.number().int().positive().describe('The user ID to look up') },
    async ({ user_id }) => {
      const user = await getUser(user_id)
      if (!user) return err(`No user found with id ${user_id}`)
      const savingsRate =
        user.monthly_income > 0
          ? (((user.monthly_income - user.monthly_budget) / user.monthly_income) * 100).toFixed(1)
          : null
      return ok({ ...user, savings_rate_pct: savingsRate })
    }
  )

  server.tool(
    'get_monthly_stats',
    'Get the current-month spending totals, transaction count, flagged transaction summary, and projected month-end spend for a user.',
    { user_id: z.number().int().positive().describe('The user ID') },
    async ({ user_id }) => {
      const [stats, user] = await Promise.all([getMonthlyStats(user_id), getUser(user_id)])
      const day = new Date().getDate()
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const projected = day > 0 ? ((Number(stats.total_spent) / day) * daysInMonth).toFixed(2) : '0.00'
      const budget = user?.monthly_budget ?? 0
      return ok({
        ...stats,
        monthly_budget: budget,
        budget_remaining: (budget - Number(stats.total_spent)).toFixed(2),
        day_of_month: day,
        days_in_month: daysInMonth,
        projected_month_end: projected,
        pace: Number(projected) > budget ? 'over-budget' : 'on-track',
      })
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  // TRANSACTION TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  server.tool(
    'get_transactions',
    "Fetch a user's real recent transactions from the database. Each row is enriched with a time_tag (late-night / morning / afternoon / evening) so the AI can detect time-based habits immediately.",
    {
      user_id: z.number().int().positive(),
      limit: z.number().int().min(1).max(200).default(20).describe('Max rows to return (default 20)'),
      days: z.number().int().min(1).max(365).optional().describe('If set, only return transactions from the last N days'),
    },
    async ({ user_id, limit, days }) => {
      const rows = days
        ? await getTransactionsByPeriod(user_id, days)
        : await getTransactions(user_id, limit)

      const enriched = rows.map((t) => {
        const hour = new Date(t.date).getHours()
        const time_tag =
          hour >= 22 || hour <= 4 ? 'late-night'
          : hour >= 5 && hour <= 11 ? 'morning'
          : hour >= 12 && hour <= 17 ? 'afternoon'
          : 'evening'
        return { ...t, time_tag }
      })

      const lateNightCount = enriched.filter((t) => t.time_tag === 'late-night').length
      const flaggedCount = enriched.filter((t) => t.is_flagged).length
      const totalSpent = enriched.reduce((s, t) => s + Number(t.amount), 0)

      return ok({
        transactions: enriched,
        count: enriched.length,
        total_spent: totalSpent.toFixed(2),
        late_night_count: lateNightCount,
        flagged_count: flaggedCount,
        summary: `${enriched.length} transactions totaling $${totalSpent.toFixed(2)}. ${lateNightCount} late-night, ${flaggedCount} flagged.`,
      })
    }
  )

  server.tool(
    'get_flagged_transactions',
    'Get flagged transactions (impulse buys and late-night purchases) for a user, grouped by flag type.',
    {
      user_id: z.number().int().positive(),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ user_id, limit }) => {
      const rows = await getFlaggedTransactions(user_id, limit)
      const lateNight = rows.filter((t) => t.flag_reason === 'late-night')
      const impulse = rows.filter((t) => t.flag_reason === 'impulse')
      const lateNightTotal = lateNight.reduce((s, t) => s + Number(t.amount), 0)
      const impulseTotal = impulse.reduce((s, t) => s + Number(t.amount), 0)
      return ok({
        total_flagged: rows.length,
        late_night: { count: lateNight.length, total: lateNightTotal.toFixed(2), transactions: lateNight },
        impulse: { count: impulse.length, total: impulseTotal.toFixed(2), transactions: impulse },
      })
    }
  )

  server.tool(
    'get_category_breakdown',
    'Get per-category spending totals and transaction counts over the last N days, ordered by highest spend.',
    {
      user_id: z.number().int().positive(),
      days: z.number().int().min(1).max(365).default(30).describe('Look-back window in days (default 30)'),
    },
    async ({ user_id, days }) => {
      const rows = await getCategoryBreakdown(user_id, days)
      return ok({ period_days: days, categories: rows })
    }
  )

  server.tool(
    'get_weekly_spending',
    'Get weekly spending totals for the last 8 weeks with week-over-week % change for trend analysis.',
    { user_id: z.number().int().positive() },
    async ({ user_id }) => {
      const rows = await getWeeklySpending(user_id)
      if (rows.length >= 2) {
        const latest = Number(rows[rows.length - 1].amount)
        const prev = Number(rows[rows.length - 2].amount)
        const change = prev > 0 ? (((latest - prev) / prev) * 100).toFixed(1) : '0'
        const direction = Number(change) > 0 ? 'increasing' : Number(change) < 0 ? 'decreasing' : 'stable'
        return ok({ weeks: rows, latest_week: latest, previous_week: prev, wow_change_pct: `${change}%`, direction })
      }
      return ok({ weeks: rows })
    }
  )

  server.tool(
    'get_daily_spending',
    'Get day-by-day spending totals for the last N days to spot daily habits and weekend spikes.',
    {
      user_id: z.number().int().positive(),
      days: z.number().int().min(1).max(90).default(7),
    },
    async ({ user_id, days }) => {
      const rows = await getDailySpending(user_id, days)
      return ok({ period_days: days, days: rows })
    }
  )

  server.tool(
    'create_transaction',
    'Insert a new transaction for a user. Automatically flags as late-night if the transaction hour is between 22:00–04:59.',
    {
      user_id: z.number().int().positive(),
      amount: z.number().positive().describe('Transaction amount in USD'),
      merchant: z.string().min(1).describe('Merchant name'),
      category: z.enum(['Food', 'Shopping', 'Bills', 'Travel', 'Subscriptions', 'Investment', 'Transport', 'Misc']),
      date: z.string().optional().describe('ISO date string; defaults to now'),
      note: z.string().optional(),
      is_flagged: z.boolean().optional().describe('Override auto-flag logic'),
      flag_reason: z.enum(['late-night', 'impulse', 'duplicate', 'suspicious']).optional(),
    },
    async ({ user_id, amount, merchant, category, date, note, is_flagged, flag_reason }) => {
      const txDate = date ? new Date(date) : new Date()
      const hour = txDate.getHours()
      const autoFlag = is_flagged ?? (hour >= 22 || hour <= 4)
      const autoReason = flag_reason ?? (autoFlag ? 'late-night' : null)
      const tx = await createTransaction({
        user_id, amount, merchant, category,
        date: txDate.toISOString(),
        note: note ?? null,
        is_flagged: autoFlag,
        flag_reason: autoReason,
      })
      return ok({ saved: true, flagged: autoFlag, flag_reason: autoReason, transaction: tx })
    }
  )

  server.tool(
    'get_monthly_summary',
    'Fetch a full monthly summary for a user: budget, total spent, projections, category breakdown, and 8-week trend — all in one call.',
    { user_id: z.number().int().positive() },
    async ({ user_id }) => {
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
      return ok({
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
      })
    }
  )

  server.tool(
    'get_daily_pattern',
    'Fetch day-by-day spending for the last N days and identify the highest and lowest spending days.',
    {
      user_id: z.number().int().positive(),
      days: z.number().int().min(1).max(30).default(7),
    },
    async ({ user_id, days }) => {
      const rows = await getDailySpending(user_id, days)
      const sorted = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount))
      const avg = rows.length > 0 ? (rows.reduce((s, r) => s + Number(r.amount), 0) / rows.length).toFixed(2) : '0'
      return ok({ daily: rows, highest_day: sorted[0] ?? null, lowest_day: sorted[sorted.length - 1] ?? null, avg_daily: avg })
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  server.tool(
    'detect_behavior',
    'Analyze real spending data and detect behavioral patterns across 7 dimensions: late-night habits, food addiction, overspend, impulse buying, weekly trend, budget pace, and positive behavior. Optionally saves detected patterns as behavior_insight rows in the DB.',
    {
      user_id: z.number().int().positive().default(1),
      days: z.number().int().min(7).max(90).default(30).describe('Look-back window in days'),
      save_insights: z.boolean().default(false).describe('If true, persist detected patterns to the DB'),
    },
    async ({ user_id, days, save_insights }) => {
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

      // 1. Late-night spending
      const lateNight = transactions.filter((t) => {
        const h = new Date(t.date).getHours()
        return h >= 22 || h <= 4
      })
      if (lateNight.length >= 2) {
        const total = lateNight.reduce((s, t) => s + Number(t.amount), 0)
        insights.push({
          type: 'pattern',
          title: 'Late-Night Spending Detected',
          description: `You made ${lateNight.length} purchases after 10pm totaling $${total.toFixed(0)}. This is a recurring late-night habit.`,
          action: 'Enable spending limits after 10pm in your bank app.',
          severity: lateNight.length >= 4 ? 'danger' : 'warning',
        })
      }

      // 2. Food delivery frequency
      const foodTx = transactions.filter((t) => t.category === 'Food')
      if (foodTx.length >= 4) {
        const total = foodTx.reduce((s, t) => s + Number(t.amount), 0)
        insights.push({
          type: 'trend',
          title: 'Frequent Food Spending',
          description: `You ordered food ${foodTx.length} times this period, spending $${total.toFixed(0)}.`,
          action: 'Try meal prepping on Sundays to reduce delivery costs.',
          severity: foodTx.length >= 7 ? 'danger' : 'warning',
        })
      }

      // 3. Top category overspend
      const budget = Number(user?.monthly_budget ?? 0)
      const topCat = categories[0]
      if (topCat && budget > 0) {
        const ratio = Number(topCat.total) / budget
        if (ratio > 0.4) {
          insights.push({
            type: 'anomaly',
            title: `${topCat.category} Overspend`,
            description: `${topCat.category} spending of $${topCat.total} is ${(ratio * 100).toFixed(0)}% of your monthly budget.`,
            action: `Set a strict $${(budget * 0.2).toFixed(0)}/month cap on ${topCat.category}.`,
            severity: ratio > 0.6 ? 'danger' : 'warning',
          })
        }
      }

      // 4. Impulse buys
      const impulse = transactions.filter((t) => t.flag_reason === 'impulse')
      if (impulse.length >= 2) {
        insights.push({
          type: 'pattern',
          title: 'Impulse Buying Detected',
          description: `${impulse.length} impulse purchases flagged this period.`,
          action: 'Apply the 48-hour rule before any unplanned purchase over $50.',
          severity: impulse.length >= 4 ? 'danger' : 'warning',
        })
      }

      // 5. Week-over-week spike
      if (weekly.length >= 2) {
        const latest = Number(weekly[weekly.length - 1].amount)
        const prev = Number(weekly[weekly.length - 2].amount)
        const change = prev > 0 ? ((latest - prev) / prev) * 100 : 0
        if (change > 30) {
          insights.push({
            type: 'trend',
            title: 'Spending Increasing Weekly',
            description: `Your spending jumped ${change.toFixed(0)}% week-over-week.`,
            action: 'Pause non-essential spending for the next 5 days.',
            severity: change > 60 ? 'danger' : 'warning',
          })
        }
      }

      // 6. Budget pace
      const dayOfMonth = new Date().getDate()
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const projected = dayOfMonth > 0 ? (Number(stats.total_spent) / dayOfMonth) * daysInMonth : 0
      if (budget > 0 && projected > budget * 1.1) {
        insights.push({
          type: 'forecast',
          title: 'On Pace to Exceed Budget',
          description: `At your current rate, you will spend $${projected.toFixed(0)} — $${(projected - budget).toFixed(0)} over your $${budget} budget.`,
          action: 'Cut back on your top category for the rest of the month.',
          severity: projected > budget * 1.3 ? 'danger' : 'warning',
        })
      }

      // 7. Positive — under budget
      if (budget > 0 && projected < budget * 0.8 && Number(stats.total_spent) > 0) {
        insights.push({
          type: 'positive',
          title: 'Well Under Budget',
          description: `You are on pace to finish the month $${(budget - projected).toFixed(0)} under budget.`,
          action: 'Move the surplus to a high-yield savings account.',
          severity: 'info',
        })
      }

      // Optionally persist
      let savedCount = 0
      if (save_insights) {
        for (const ins of insights) {
          await createBehaviorInsight({ user_id, ...ins })
          savedCount++
        }
      }

      return ok({
        patterns_detected: insights.length,
        saved_to_db: savedCount,
        insights,
        raw_stats: {
          total_spent: stats.total_spent,
          transaction_count: stats.transaction_count,
          flagged_count: stats.flagged_count,
          days_analyzed: days,
        },
      })
    }
  )

  server.tool(
    'get_spending_score',
    "Calculate a user's financial discipline score (0–100) across 5 weighted factors: budget adherence, impulse control, late-night spending, category concentration, and weekly trend. Returns a letter grade and factor breakdown.",
    { user_id: z.number().int().positive().default(1) },
    async ({ user_id }) => {
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
      const day = new Date().getDate()
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const projected = day > 0 ? (spent / day) * daysInMonth : 0

      // Factor 1: Budget adherence (-30)
      if (budget > 0) {
        const ratio = projected / budget
        if (ratio > 1.3) { score -= 30; breakdown.push({ factor: 'Budget Adherence', impact: -30, note: `Projected $${projected.toFixed(0)} is ${((ratio - 1) * 100).toFixed(0)}% over budget` }) }
        else if (ratio > 1.1) { score -= 15; breakdown.push({ factor: 'Budget Adherence', impact: -15, note: 'Slightly over budget pace' }) }
        else { breakdown.push({ factor: 'Budget Adherence', impact: 0, note: 'Within budget' }) }
      }

      // Factor 2: Impulse control (-25)
      const impulseCount = flagged.filter((t) => t.flag_reason === 'impulse').length
      if (impulseCount >= 5) { score -= 25; breakdown.push({ factor: 'Impulse Control', impact: -25, note: `${impulseCount} impulse buys` }) }
      else if (impulseCount >= 2) { score -= 12; breakdown.push({ factor: 'Impulse Control', impact: -12, note: `${impulseCount} impulse buys` }) }
      else { breakdown.push({ factor: 'Impulse Control', impact: 0, note: 'Good impulse control' }) }

      // Factor 3: Late-night spending (-15)
      const lateCount = flagged.filter((t) => t.flag_reason === 'late-night').length
      if (lateCount >= 4) { score -= 15; breakdown.push({ factor: 'Late-Night Spending', impact: -15, note: `${lateCount} purchases after 10pm` }) }
      else if (lateCount >= 2) { score -= 8; breakdown.push({ factor: 'Late-Night Spending', impact: -8, note: `${lateCount} late-night purchases` }) }

      // Factor 4: Category concentration (-15)
      if (categories.length > 0 && budget > 0) {
        const topRatio = Number(categories[0].total) / budget
        if (topRatio > 0.6) { score -= 15; breakdown.push({ factor: 'Category Balance', impact: -15, note: `${categories[0].category} is ${(topRatio * 100).toFixed(0)}% of budget` }) }
        else if (topRatio > 0.45) { score -= 8; breakdown.push({ factor: 'Category Balance', impact: -8, note: `Heavy concentration in ${categories[0].category}` }) }
      }

      // Factor 5: Weekly trend (-10)
      if (weekly.length >= 2) {
        const latest = Number(weekly[weekly.length - 1].amount)
        const prev = Number(weekly[weekly.length - 2].amount)
        const change = prev > 0 ? ((latest - prev) / prev) * 100 : 0
        if (change > 50) { score -= 10; breakdown.push({ factor: 'Spending Trend', impact: -10, note: `${change.toFixed(0)}% week-over-week increase` }) }
        else if (change < -20) { breakdown.push({ factor: 'Spending Trend', impact: 0, note: `Spending decreased ${Math.abs(change).toFixed(0)}% this week` }) }
      }

      score = Math.max(0, Math.min(100, score))
      const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'
      const message =
        score >= 85 ? 'Excellent financial discipline. Keep it up!'
        : score >= 70 ? 'Good control overall, but a few areas need attention.'
        : score >= 55 ? 'Moderate risk — several spending habits need improvement.'
        : score >= 40 ? 'High risk — spending patterns need significant correction.'
        : 'Critical — immediate action needed to regain financial control.'

      return ok({ score, grade, message, breakdown, stats: { monthly_budget: budget, total_spent_this_month: spent, projected_month_end: projected.toFixed(2), flagged_transactions: flagged.length } })
    }
  )

  server.tool(
    'decision_coach',
    "Evaluate whether a user should make a specific purchase. Fetches live budget and spending data, computes a risk score across 5 factors, and returns a structured recommendation with alternatives. This is the core 'Should I buy this?' tool.",
    {
      user_id: z.number().int().positive().default(1),
      amount: z.number().positive().describe('Purchase amount in USD'),
      merchant: z.string().min(1).describe('Merchant name'),
      category: z.string().describe('Spending category (e.g. Shopping, Food, Travel)'),
    },
    async ({ user_id, amount, merchant, category }) => {
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
      const catBreakdown = categories.find((c) => c.category.toLowerCase() === category.toLowerCase())
      const catSpent = Number(catBreakdown?.total ?? 0)
      const recentImpulseInCat = flagged.filter(
        (t) => t.flag_reason === 'impulse' && t.category.toLowerCase() === category.toLowerCase()
      ).length

      let riskScore = 0
      if (wouldExceed) riskScore += 40
      if (purchaseRatio > 20) riskScore += 20
      else if (purchaseRatio > 10) riskScore += 10
      if (recentImpulseInCat > 0) riskScore += 15
      if (stats.flagged_count > 3) riskScore += 10
      if (remaining < amount * 2) riskScore += 10

      const risk: 'Low' | 'Medium' | 'High' = riskScore >= 50 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low'

      const recommendation =
        risk === 'High'
          ? `Avoid this purchase. ${wouldExceed ? `It would put you $${(newTotal - budget).toFixed(0)} over your $${budget} budget.` : `At $${amount}, this is a significant spend given your financial position.`}`
          : risk === 'Medium'
          ? `Proceed with caution. This $${amount} purchase at ${merchant} is ${purchaseRatio.toFixed(1)}% of your monthly budget, leaving only $${remainingAfter.toFixed(0)}.`
          : `This $${amount} purchase looks manageable. You have $${remaining.toFixed(0)} left in your budget.`

      const alternatives =
        risk !== 'Low'
          ? [`Wait 48 hours and revisit.`, `Look for a lower-cost ${category} alternative.`, `Move to next month's budget if not urgent.`]
          : []

      return ok({
        purchase: { amount, merchant, category },
        current_status: { monthly_budget: budget, spent_so_far: spent, budget_remaining: remaining.toFixed(2), category_spent_this_month: catSpent, would_exceed_budget: wouldExceed, remaining_after_purchase: remainingAfter.toFixed(2) },
        risk_level: risk,
        risk_score: riskScore,
        recommendation,
        alternatives,
        past_impulse_in_category: recentImpulseInCat,
      })
    }
  )

  server.tool(
    'save_insight',
    'Persist a newly detected behavioral insight to the database so it appears on the user dashboard.',
    {
      user_id: z.number().int().positive(),
      type: z.enum(['pattern', 'anomaly', 'trend', 'forecast', 'positive']),
      title: z.string().min(1),
      description: z.string().min(1),
      action: z.string().optional().describe('Actionable recommendation text'),
      severity: z.enum(['info', 'warning', 'danger']),
    },
    async ({ user_id, type, title, description, action, severity }) => {
      const insight = await createBehaviorInsight({ user_id, type, title, description, action: action ?? null, severity })
      return ok({ saved: true, insight })
    }
  )

  server.tool(
    'get_behavior_insights',
    'Retrieve all AI-generated behavioral insights for a user (patterns, anomalies, trends, forecasts, positives) ordered by most recent.',
    { user_id: z.number().int().positive() },
    async ({ user_id }) => {
      const rows = await getBehaviorInsights(user_id)
      const byType = rows.reduce<Record<string, number>>((acc, r) => { acc[r.type] = (acc[r.type] ?? 0) + 1; return acc }, {})
      return ok({ total: rows.length, by_type: byType, insights: rows })
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  server.tool(
    'get_admin_overview',
    'Get platform-wide aggregate statistics: total users, total transaction volume, flagged counts, and insight severity breakdown.',
    {},
    async () => {
      const data = await getAdminOverview()
      return ok(data)
    }
  )

  server.tool(
    'get_admin_leaderboard',
    'Get a per-user spending leaderboard with transaction counts, flagged items, and insight counts for all users.',
    {},
    async () => {
      const rows = await getAdminUserLeaderboard()
      return ok({ users: rows, count: rows.length })
    }
  )

  server.tool(
    'get_admin_flagged_report',
    'Get the 100 most recent flagged transactions across all users, including user name and email for context.',
    {},
    async () => {
      const rows = await getAdminFlaggedReport()
      return ok({ total: rows.length, transactions: rows })
    }
  )

  server.tool(
    'get_admin_spending_trend',
    'Get platform-wide daily spending trend (total volume + flagged count per day) for the last N days.',
    { days: z.number().int().min(1).max(90).default(30).describe('Number of days to look back (default 30)') },
    async ({ days }) => {
      const rows = await getAdminSpendingTrend(days)
      return ok({ period_days: days, trend: rows })
    }
  )

  return server
}

// ─── Stateless request handler ────────────────────────────────────────────────
// A new McpServer + transport is created per request.
// This is the correct pattern for serverless/edge deployments.

async function handleMcpRequest(req: Request): Promise<Response> {
  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session persistence
  })
  await server.connect(transport)
  return transport.handleRequest(req)
}

export const POST   = handleMcpRequest
export const GET    = handleMcpRequest
export const DELETE = handleMcpRequest

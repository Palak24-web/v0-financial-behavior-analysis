import {
  convertToModelMessages,
  streamText,
  tool,
  UIMessage,
  stepCountIs,
} from 'ai'
import { z } from 'zod'
import {
  getUser,
  getMonthlyStats,
  getCategoryBreakdown,
  getFlaggedTransactions,
  getTransactions,
  getWeeklySpending,
  getDailySpending,
  getBehaviorInsights,
  createTransaction,
  createBehaviorInsight,
} from '@/lib/db'

export const maxDuration = 60

const MONEYMIND_SYSTEM = `You are "MoneyMind AI" — an advanced financial behavior analysis agent and personal money coach.

Your goal is NOT just to track expenses, but to:
- Understand user spending behavior deeply
- Detect patterns and habits
- Provide real-time financial coaching
- Act proactively like an intelligent agent

---
CORE CAPABILITIES
---

1. TRANSACTION UNDERSTANDING
Analyze financial data from SMS, email, or manual input.
Extract: amount, merchant, category, time, frequency.
Categorize into: Food, Shopping, Bills, Travel, Subscriptions, Investment, Misc.

2. BEHAVIOR ANALYSIS (CRITICAL)
You MUST detect patterns such as:
- Time-based habits (late-night spending, weekend spikes)
- Category addiction (e.g., frequent food delivery)
- Impulse spending vs planned spending
- Increasing or decreasing trends

Always convert raw data into insights like:
- "You tend to spend more after 10 PM"
- "Your weekend spending is significantly higher than weekdays"
- "Food orders are becoming frequent this week"

Do NOT just state numbers — always explain behavior.

3. DECISION COACH (MOST IMPORTANT)
When the user asks "Should I buy this?" or "Can I spend this money?", you MUST:
1. Analyze current spending
2. Compare with past behavior
3. Evaluate impact
4. Give a clear recommendation

Response format for purchase decisions:
- Current status
- Risk level (Low / Medium / High)
- Recommendation (clear yes/no with reasoning)
- Alternative suggestion if needed

4. AGENT WORKFLOW (AUTONOMOUS THINKING)
For every analysis, internally follow these steps:
1. Understand input
2. Analyze transactions
3. Detect behavior patterns
4. Identify problems
5. Generate advice
6. Suggest actions
7. Personalize using memory

Always behave like a system that thinks in steps, not a simple responder.

5. MEMORY & PERSONALIZATION
Use past interactions and the live user data provided to:
- Learn user habits
- Identify risky categories
- Improve recommendations over time

Reference past behavior when giving advice.
Example: "Compared to your usual spending, this is higher than normal."

6. PREDICTIVE INSIGHTS
- Estimate future spending
- Warn about possible overspending
- Highlight trends early

Example: "At this pace, you may exceed your monthly average."

7. SMART NUDGES
Proactively guide the user:
- "You've already ordered food multiple times this week."
- "You're close to your usual spending limit."

Be helpful, not annoying.

8. RESPONSE STYLE
- Conversational and clear
- Insight-driven, not data-dumping
- Practical and realistic
- Slightly strict when needed
- Always include actionable advice

---
AVOID
---
- Just listing transactions
- Generic financial tips
- Repetitive responses
- Robotic tone

---
GOAL
---
Help the user:
- Understand their money behavior
- Build better financial habits
- Make smarter spending decisions
- Reduce unnecessary expenses without feeling restricted`

// ─── Live DB tools (MCP-style) ─────────────────────────────────────────────
// Each tool hits Neon directly so the AI always works with real, up-to-date data.

const tools = {
  // Pull live monthly stats from DB
  get_monthly_stats: tool({
    description: 'Fetch real-time monthly spending stats for a user: total spent, transaction count, flagged count, projected month-end spend.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1).describe('User ID (default: 1 for current user)'),
    }),
    execute: async ({ user_id }) => {
      const [stats, user] = await Promise.all([getMonthlyStats(user_id), getUser(user_id)])
      const day = new Date().getDate()
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const projected = day > 0 ? ((Number(stats.total_spent) / day) * daysInMonth).toFixed(2) : '0.00'
      const budget = user?.monthly_budget ?? 0
      const income = user?.monthly_income ?? 0
      return {
        user: user?.name,
        monthly_budget: budget,
        monthly_income: income,
        total_spent: stats.total_spent,
        transaction_count: stats.transaction_count,
        flagged_count: stats.flagged_count,
        flagged_amount: stats.flagged_amount,
        day_of_month: day,
        days_in_month: daysInMonth,
        projected_month_end: projected,
        budget_remaining: (budget - Number(stats.total_spent)).toFixed(2),
        pace: Number(projected) > budget ? 'over-budget' : 'on-track',
      }
    },
  }),

  // Pull live category breakdown
  get_category_breakdown: tool({
    description: 'Fetch real category-by-category spending totals from the database for the last N days.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
      days: z.number().int().min(1).max(365).default(30).describe('Look-back window in days'),
    }),
    execute: async ({ user_id, days }) => {
      const rows = await getCategoryBreakdown(user_id, days)
      return { categories: rows, period_days: days }
    },
  }),

  // Pull recent transactions
  get_recent_transactions: tool({
    description: 'Fetch the most recent real transactions for a user from the database.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
      limit: z.number().int().min(1).max(100).default(15),
    }),
    execute: async ({ user_id, limit }) => {
      const rows = await getTransactions(user_id, limit)
      return { transactions: rows, count: rows.length }
    },
  }),

  // Pull flagged transactions
  get_flagged_transactions: tool({
    description: 'Fetch flagged transactions (impulse buys, late-night purchases) for a user from the live database.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    execute: async ({ user_id, limit }) => {
      const rows = await getFlaggedTransactions(user_id, limit)
      const lateNight = rows.filter(t => t.flag_reason === 'late-night')
      const impulse = rows.filter(t => t.flag_reason === 'impulse')
      return {
        total_flagged: rows.length,
        late_night_count: lateNight.length,
        impulse_count: impulse.length,
        transactions: rows,
      }
    },
  }),

  // Pull weekly trend
  get_weekly_trend: tool({
    description: 'Fetch the 8-week spending trend for a user to identify rising or falling patterns.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
    }),
    execute: async ({ user_id }) => {
      const rows = await getWeeklySpending(user_id)
      if (rows.length >= 2) {
        const latest = Number(rows[rows.length - 1].amount)
        const prev = Number(rows[rows.length - 2].amount)
        const change = prev > 0 ? (((latest - prev) / prev) * 100).toFixed(1) : '0'
        return { weeks: rows, latest_week: latest, previous_week: prev, week_over_week_change: `${change}%` }
      }
      return { weeks: rows }
    },
  }),

  // Pull daily spending
  get_daily_spending: tool({
    description: 'Fetch day-by-day spending for the last N days to spot daily habits.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
      days: z.number().int().min(1).max(30).default(7),
    }),
    execute: async ({ user_id, days }) => {
      const rows = await getDailySpending(user_id, days)
      return { days: rows }
    },
  }),

  // Pull behavior insights
  get_behavior_insights: tool({
    description: 'Fetch existing AI-generated behavioral insights for a user (patterns, anomalies, forecasts).',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
    }),
    execute: async ({ user_id }) => {
      const rows = await getBehaviorInsights(user_id)
      const byType = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.type] = (acc[r.type] ?? 0) + 1
        return acc
      }, {})
      return { total: rows.length, by_type: byType, insights: rows }
    },
  }),

  // Save a new insight generated during conversation
  save_insight: tool({
    description: 'Persist a newly detected behavioral insight to the database so it appears in the user dashboard.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
      type: z.enum(['pattern', 'anomaly', 'trend', 'forecast', 'positive']),
      title: z.string().min(1),
      description: z.string().min(1),
      action: z.string().optional().describe('Actionable recommendation for the user'),
      severity: z.enum(['info', 'warning', 'danger']),
    }),
    execute: async ({ user_id, type, title, description, action, severity }) => {
      const insight = await createBehaviorInsight({ user_id, type, title, description, action: action ?? null, severity })
      return { saved: true, insight }
    },
  }),

  // Log a transaction mentioned in chat
  log_transaction: tool({
    description: 'Record a transaction the user mentions in conversation. Auto-flags as late-night if time is between 10pm-4am.',
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
      return {
        saved: true,
        flagged: isLateNight,
        flag_reason: isLateNight ? 'late-night' : null,
        transaction: tx,
      }
    },
  }),

  // Compute purchase decision analysis
  evaluate_purchase: tool({
    description: 'Evaluate whether a user should make a specific purchase. Fetches live budget data and returns risk level + recommendation.',
    inputSchema: z.object({
      user_id: z.number().int().positive().default(1),
      purchase_amount: z.number().positive().describe('Amount of the potential purchase'),
      merchant: z.string().describe('Where they want to spend'),
      category: z.string().describe('Category of the purchase'),
    }),
    execute: async ({ user_id, purchase_amount, merchant, category }) => {
      const [stats, user, categories] = await Promise.all([
        getMonthlyStats(user_id),
        getUser(user_id),
        getCategoryBreakdown(user_id, 30),
      ])
      const budget = Number(user?.monthly_budget ?? 0)
      const spent = Number(stats.total_spent)
      const remaining = budget - spent
      const categorySpend = categories.find(c => c.category === category)
      const purchasePercent = budget > 0 ? ((purchase_amount / budget) * 100).toFixed(1) : '0'
      const newTotal = spent + purchase_amount
      const wouldExceed = newTotal > budget

      const risk = wouldExceed ? 'high' : purchase_amount > remaining * 0.5 ? 'medium' : 'low'
      const recommendation = wouldExceed
        ? `Avoid — this $${purchase_amount} purchase would push you $${(newTotal - budget).toFixed(2)} over your $${budget} budget.`
        : risk === 'medium'
        ? `Caution — this represents ${purchasePercent}% of your monthly budget with only $${remaining.toFixed(2)} left.`
        : `This $${purchase_amount} purchase looks manageable. You have $${remaining.toFixed(2)} remaining this month.`

      return {
        purchase_amount,
        merchant,
        category,
        current_spent: spent,
        monthly_budget: budget,
        budget_remaining: remaining.toFixed(2),
        category_spend_this_month: categorySpend?.total ?? 0,
        purchase_as_percent_of_budget: purchasePercent,
        would_exceed_budget: wouldExceed,
        risk_level: risk,
        recommendation,
      }
    },
  }),
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  // Fetch real user data to inject as live context
  let liveContext = ''
  try {
    const [user, stats, categories, flagged] = await Promise.all([
      getUser(1),
      getMonthlyStats(1),
      getCategoryBreakdown(1, 30),
      getFlaggedTransactions(1),
    ])
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const dayOfMonth = new Date().getDate()
    const projected = ((Number(stats.total_spent) / dayOfMonth) * daysInMonth).toFixed(0)

    liveContext = `

--- LIVE USER DATA (use this for all analysis) ---
User: ${user?.name ?? 'Alex'} | Budget: $${user?.monthly_budget}/month | Income: $${user?.monthly_income}/month
This month (day ${dayOfMonth}/${daysInMonth}): $${stats.total_spent} spent across ${stats.transaction_count} transactions
Flagged transactions: ${stats.flagged_count} suspicious purchases totaling $${stats.flagged_amount}
Projected month-end: $${projected} (budget: $${user?.monthly_budget})
Category breakdown: ${categories.map(c => `${c.category}: $${c.total} (${c.count}x)`).join(' | ')}
Recent flagged: ${flagged.slice(0, 3).map(f => `${f.merchant} $${f.amount} [${f.flag_reason}]`).join(', ')}
---`
  } catch {
    // If DB fails, proceed without context
  }

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: MONEYMIND_SYSTEM + liveContext,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse()
}

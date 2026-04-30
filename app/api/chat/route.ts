import {
  convertToModelMessages,
  streamText,
  tool,
  UIMessage,
  stepCountIs,
} from 'ai'
import { z } from 'zod'
import { getUser, getMonthlyStats, getCategoryBreakdown, getFlaggedTransactions } from '@/lib/db'

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

// Tools for the financial agent
const tools = {
  analyzeSpending: tool({
    description: 'Analyze spending data and return behavioral insights, category breakdown, and personalized recommendations',
    inputSchema: z.object({
      transactions: z.array(z.object({
        amount: z.number(),
        merchant: z.string(),
        category: z.string(),
        date: z.string(),
      })).describe('List of transactions to analyze'),
      period: z.string().describe('Time period for analysis (e.g., "this month", "last 30 days")'),
    }),
    execute: async ({ transactions, period }) => {
      const total = transactions.reduce((sum, t) => sum + t.amount, 0)
      const byCategory: Record<string, number> = {}
      transactions.forEach(t => {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
      })
      const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
      return {
        period,
        totalSpent: total,
        categoryBreakdown: byCategory,
        topSpendingCategory: topCategory?.[0] ?? 'Unknown',
        topCategoryAmount: topCategory?.[1] ?? 0,
        transactionCount: transactions.length,
        averageTransactionSize: total / transactions.length,
        insight: `You spent $${total.toFixed(2)} across ${transactions.length} transactions in ${period}. Highest spending in ${topCategory?.[0]} at $${topCategory?.[1]?.toFixed(2)}.`,
      }
    },
  }),
  detectAnomalies: tool({
    description: 'Detect unusual spending patterns and flag suspicious or unexpected transactions',
    inputSchema: z.object({
      transactions: z.array(z.object({
        amount: z.number(),
        merchant: z.string(),
        category: z.string(),
        date: z.string(),
      })),
      averageMonthlySpend: z.number().describe('User average monthly spend for comparison'),
    }),
    execute: async ({ transactions, averageMonthlySpend }) => {
      const anomalies = transactions.filter(t => t.amount > averageMonthlySpend * 0.15)
      const lateNight = transactions.filter(t => {
        const hour = new Date(t.date).getHours()
        return hour >= 22 || hour <= 4
      })
      return {
        unusualTransactions: anomalies.length,
        flaggedItems: anomalies.map(t => ({ merchant: t.merchant, amount: t.amount, reason: 'High single transaction' })),
        lateNightTransactions: lateNight.length,
        anomalyScore: Math.min(100, (anomalies.length / transactions.length) * 100 + lateNight.length * 5),
        summary: `Detected ${anomalies.length} unusual transactions and ${lateNight.length} late-night purchases.`,
      }
    },
  }),
  predictMonthlySpend: tool({
    description: 'Predict end-of-month spending based on current pace and historical patterns',
    inputSchema: z.object({
      currentSpend: z.number().describe('Amount spent so far this month'),
      daysElapsed: z.number().describe('Days elapsed in the current month'),
      daysInMonth: z.number().describe('Total days in current month'),
      historicalAverage: z.number().describe('Historical monthly average'),
    }),
    execute: async ({ currentSpend, daysElapsed, daysInMonth, historicalAverage }) => {
      const dailyRate = currentSpend / daysElapsed
      const projectedTotal = dailyRate * daysInMonth
      const variance = ((projectedTotal - historicalAverage) / historicalAverage) * 100
      const status = variance > 20 ? 'danger' : variance > 10 ? 'warning' : 'on-track'
      return {
        projectedMonthlySpend: projectedTotal,
        historicalAverage,
        variance: variance.toFixed(1),
        status,
        daysRemaining: daysInMonth - daysElapsed,
        remainingBudget: historicalAverage - currentSpend,
        message: status === 'danger'
          ? `Warning: You are on pace to spend $${projectedTotal.toFixed(2)} this month, which is ${variance.toFixed(1)}% above your average. Consider cutting back immediately.`
          : status === 'warning'
          ? `Caution: Projected spend of $${projectedTotal.toFixed(2)} is slightly above your $${historicalAverage} average.`
          : `Great job! You are on track to finish the month within your normal spending range.`,
      }
    },
  }),
  getSavingsSuggestions: tool({
    description: 'Generate personalized savings suggestions based on spending patterns',
    inputSchema: z.object({
      topCategories: z.array(z.object({
        category: z.string(),
        amount: z.number(),
        frequency: z.number(),
      })),
      monthlyIncome: z.number().nullable().describe('User monthly income if known'),
    }),
    execute: async ({ topCategories, monthlyIncome }) => {
      const suggestions = topCategories.map(cat => {
        const saving = cat.amount * 0.2
        return {
          category: cat.category,
          currentSpend: cat.amount,
          potentialSaving: saving,
          tip: getSavingTip(cat.category),
        }
      })
      const totalPotentialSavings = suggestions.reduce((sum, s) => sum + s.potentialSaving, 0)
      return {
        suggestions,
        totalPotentialMonthlySavings: totalPotentialSavings,
        annualSavingsPotential: totalPotentialSavings * 12,
        savingsRate: monthlyIncome ? ((totalPotentialSavings / monthlyIncome) * 100).toFixed(1) : null,
      }
    },
  }),
}

function getSavingTip(category: string): string {
  const tips: Record<string, string> = {
    Food: 'Try meal prepping 3 days a week — this alone can cut food delivery costs by 40%.',
    Shopping: 'Use a 48-hour rule before any purchase over $50 to avoid impulse buys.',
    Subscriptions: 'Audit your subscriptions monthly. Most people pay for 2-3 services they rarely use.',
    Travel: 'Book travel 6-8 weeks in advance and use fare alerts to save 20-30%.',
    Bills: 'Call your service providers annually to negotiate better rates — it works 60% of the time.',
    Entertainment: 'Look for free or lower-cost alternatives like library memberships, free events, or streaming bundles.',
    Investment: 'Great category! Consider automating investments to stay consistent.',
    Misc: 'Track miscellaneous spending closely — it often hides recurring impulse purchases.',
  }
  return tips[category] ?? 'Review this category for opportunities to reduce spending by 15-20%.'
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

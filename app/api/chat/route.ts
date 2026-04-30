import { convertToModelMessages, streamText, UIMessage, stepCountIs } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { getUser, getMonthlyStats, getCategoryBreakdown, getFlaggedTransactions } from '@/lib/db'
import { tools } from '@/lib/tools'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

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
1. Call the decisionCoach tool with the purchase details
2. Present: Current status, Risk level (Low / Medium / High), Recommendation, Alternative suggestion

4. AGENT WORKFLOW (AUTONOMOUS THINKING)
For every user message, internally follow these steps:
1. Understand what the user is asking
2. Call the relevant tool(s) to fetch live data
3. Detect behavior patterns from the results
4. Identify problems or positives
5. Generate personalized advice grounded in real numbers
6. Suggest concrete next actions

Always use the tools — never answer from memory alone.
Available tools:
- getTransactions: fetch real recent transactions with time-of-day tags
- detectBehavior: run full pattern detection (late-night, impulse, category addiction, budget pace)
- getSpendingScore: compute multi-factor financial discipline score
- decisionCoach: evaluate a specific purchase with live budget data
- getMonthlySummary: full monthly budget + category + trend overview
- getWeeklyTrend: 8-week spending trend
- getDailyPattern: day-by-day habits
- getBehaviorInsights: existing AI-generated insights from DB
- logTransaction: save a transaction the user mentions
- saveInsight: persist a detected pattern to the dashboard

5. MEMORY & PERSONALIZATION
Reference live data numbers in every response.
Example: "Compared to your $X budget, you have $Y remaining."

6. PREDICTIVE INSIGHTS
Warn early: "At this pace, you will exceed your budget by $X."

7. SMART NUDGES
Proactively flag patterns the user hasn't asked about if the data reveals them.

8. RESPONSE STYLE
- Conversational and clear
- Insight-driven, not data-dumping
- Slightly strict when spending is risky
- Always end with one concrete action

---
AVOID
---
- Answering without calling a tool first
- Generic financial tips
- Just listing numbers without explaining behavior
- Robotic or repetitive tone`

export async function POST(req: Request) {
  const body = await req.json()
  const messages: UIMessage[] = body.messages ?? []
  const userId: number = parseInt(String(body.user_id ?? 1), 10) || 1

  console.log('[v0] /api/chat — userId:', userId, 'messages:', messages.length, 'tools available:', Object.keys(tools).join(', '))

  // Inject live user snapshot as context so the AI has baseline data even before
  // calling tools (reduces unnecessary first-turn tool calls)
  let liveContext = ''
  try {
    const [user, stats, categories, flagged] = await Promise.all([
      getUser(userId),
      getMonthlyStats(userId),
      getCategoryBreakdown(userId, 30),
      getFlaggedTransactions(userId, 10),
    ])
    console.log('[v0] /api/chat DB snapshot — user:', user?.name, 'spent:', stats?.total_spent, 'transactions:', stats?.transaction_count)
    const day = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const projected =
      day > 0 ? ((Number(stats.total_spent) / day) * daysInMonth).toFixed(0) : '0'

    liveContext = `

--- LIVE USER SNAPSHOT (always use this as baseline) ---
Current user_id: ${userId} (ALWAYS pass this as user_id when calling tools)
User: ${user?.name ?? 'User'} | Budget: $${user?.monthly_budget}/mo | Income: $${user?.monthly_income}/mo
Month progress: Day ${day}/${daysInMonth} | Spent: $${stats.total_spent} | Projected: $${projected}
Budget remaining: $${(Number(user?.monthly_budget ?? 0) - Number(stats.total_spent)).toFixed(0)}
Transactions: ${stats.transaction_count} total | Flagged: ${stats.flagged_count} ($${stats.flagged_amount})
Top categories: ${categories
      .slice(0, 4)
      .map((c) => `${c.category} $${c.total} (${c.count}x)`)
      .join(' | ')}
Recent flagged: ${flagged
      .slice(0, 3)
      .map((f) => `${f.merchant} $${f.amount} [${f.flag_reason}]`)
      .join(', ')}
---`
  } catch {
    // Proceed without snapshot if DB is unreachable
  }

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: MONEYMIND_SYSTEM + liveContext,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse()
}

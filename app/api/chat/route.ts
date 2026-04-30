import { convertToModelMessages, streamText, UIMessage, stepCountIs } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { readFileSync } from 'fs'
import { getUser, getMonthlyStats, getCategoryBreakdown, getFlaggedTransactions } from '@/lib/db'
import {
  getTransactionsTool,
  getMonthlySummaryTool,
  getWeeklyTrendTool,
  detectBehaviorTool,
  getSpendingScoreTool,
  decisionCoachTool,
} from '@/lib/tools'

// Load GROQ_API_KEY from the shared env file if not already in process.env
function getGroqKey(): string {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY
  try {
    const raw = readFileSync('/vercel/share/.env.project', 'utf-8')
    const match = raw.match(/^GROQ_API_KEY=['"]?([^'"\n]+)['"]?/m)
    if (match?.[1]) return match[1].trim()
  } catch {}
  throw new Error('GROQ_API_KEY not found')
}

// Only expose the tools the chatbot actually needs — Groq has limits on tool count
const chatTools = {
  getTransactions: getTransactionsTool,
  getMonthlySummary: getMonthlySummaryTool,
  getWeeklyTrend: getWeeklyTrendTool,
  detectBehavior: detectBehaviorTool,
  getSpendingScore: getSpendingScoreTool,
  decisionCoach: decisionCoachTool,
}

export const maxDuration = 60

const MONEYMIND_SYSTEM = `You are MoneyMind AI — a financial behavior coach with access to the user's real spending data via tools.

RULES:
1. ALWAYS call a tool before answering — never reply from memory alone.
2. For general questions about spending, call getMonthlySummary or getTransactions first.
3. For pattern/habit questions, call detectBehavior.
4. For "should I buy" questions, call decisionCoach with item, amount, and category.
5. For trends, call getWeeklyTrend.
6. For a score/rating, call getSpendingScore.

RESPONSE STYLE:
- Reference real numbers from tool results in every reply.
- Explain behavior, not just numbers. E.g. "You've ordered food 5x this week — that's a habit forming."
- Be direct and slightly strict when spending looks risky.
- End every response with one concrete action the user can take today.
- Keep responses concise — 3-5 sentences unless detail is needed.`

export async function POST(req: Request) {
  const body = await req.json()
  const messages: UIMessage[] = body.messages ?? []
  const userId: number = parseInt(String(body.user_id ?? 1), 10) || 1

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

  try {
    const groq = createGroq({ apiKey: getGroqKey() })
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: MONEYMIND_SYSTEM + liveContext,
      messages: await convertToModelMessages(messages),
      tools: chatTools,
      stopWhen: stepCountIs(10),
      abortSignal: req.signal,
    })
    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error('[v0] /api/chat streamText error:', err)
    // Return a valid stream with a fallback message so the UI never hangs
    const fallback = streamText({
      model: createGroq({ apiKey: getGroqKey() })('llama-3.3-70b-versatile'),
      system: 'You are a helpful financial assistant.',
      messages: [{ role: 'user', content: 'Say: "I could not load your financial data right now. Please try again in a moment."' }],
    })
    return fallback.toUIMessageStreamResponse()
  }
}

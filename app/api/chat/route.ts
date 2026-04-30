import { streamText, convertToModelMessages, UIMessage, stepCountIs } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { getUser, getMonthlyStats, getCategoryBreakdown, getFlaggedTransactions } from '@/lib/db'
import {
  getTransactionsTool,
  getMonthlySummaryTool,
  getWeeklyTrendTool,
  detectBehaviorTool,
  getSpendingScoreTool,
  decisionCoachTool,
} from '@/lib/tools'

const groq = createGroq()

export const maxDuration = 60

const chatTools = {
  getTransactions: getTransactionsTool,
  getMonthlySummary: getMonthlySummaryTool,
  getWeeklyTrend: getWeeklyTrendTool,
  detectBehavior: detectBehaviorTool,
  getSpendingScore: getSpendingScoreTool,
  decisionCoach: decisionCoachTool,
}

function buildSystem(userId: number, snapshot: string) {
  return `You are MoneyMind AI — a sharp financial behavior coach with live access to the user's real spending data.

The current user_id is ${userId}. ALWAYS pass user_id: ${userId} when calling any tool.

MANDATORY RULES:
- You MUST call at least one tool before answering any finance question.
- For spending / budget questions → call getMonthlySummary
- For transaction history → call getTransactions
- For habits / patterns → call detectBehavior
- For trends → call getWeeklyTrend
- For a financial score → call getSpendingScore
- For "should I buy X" questions → call decisionCoach with amount, merchant, and category
- After the tool returns data, write a clear, specific response using real numbers from the result.
- Never say "I don't have access" — you DO have access via tools.
- End every response with one concrete action the user can take today.

${snapshot}`
}

export async function POST(req: Request) {
  let body: { messages?: UIMessage[]; user_id?: number } = {}

  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const messages: UIMessage[] = body.messages ?? []
  const userId = parseInt(String(body.user_id ?? 1), 10) || 1

  console.log('[v0] /api/chat — userId:', userId, 'messages:', messages.length)

  // Build live snapshot injected into system prompt
  let snapshot = ''
  try {
    const [user, stats, categories, flagged] = await Promise.all([
      getUser(userId),
      getMonthlyStats(userId),
      getCategoryBreakdown(userId, 30),
      getFlaggedTransactions(userId, 10),
    ])

    const day = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const spent = Number(stats?.total_spent ?? 0)
    const budget = Number(user?.monthly_budget ?? 0)
    const projected = day > 0 ? ((spent / day) * daysInMonth).toFixed(0) : '0'
    const remaining = (budget - spent).toFixed(0)

    snapshot = `--- LIVE SNAPSHOT (use as context, then call tools for deeper data) ---
User: ${user?.name ?? 'Unknown'} | user_id: ${userId}
Budget: $${budget}/mo | Income: $${user?.monthly_income ?? 0}/mo
Spent this month: $${spent.toFixed(2)} | Remaining: $${remaining} | Projected: $${projected}
Day ${day}/${daysInMonth} | Transactions: ${stats?.transaction_count ?? 0} | Flagged: ${stats?.flagged_count ?? 0}
Top categories: ${(categories ?? []).slice(0, 4).map(c => `${c.category} $${Number(c.total).toFixed(0)} (${c.count}x)`).join(', ')}
Recent flagged: ${(flagged ?? []).slice(0, 3).map(f => `${f.merchant} $${f.amount} [${f.flag_reason}]`).join(', ') || 'none'}
---`

    console.log('[v0] /api/chat snapshot built — user:', user?.name, 'spent:', spent)
  } catch (dbErr) {
    console.error('[v0] /api/chat DB snapshot failed:', dbErr)
    snapshot = `--- SNAPSHOT UNAVAILABLE (use tools to fetch live data) ---`
  }

  // Convert UI messages to model messages
  let modelMessages
  try {
    modelMessages = await convertToModelMessages(messages)
  } catch (convErr) {
    console.error('[v0] /api/chat convertToModelMessages failed:', convErr)
    modelMessages = []
  }

  console.log('[v0] /api/chat calling streamText with', modelMessages.length, 'model messages')

  try {
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: buildSystem(userId, snapshot),
      messages: modelMessages,
      tools: chatTools,
      maxSteps: 5,
      onError: (err) => {
        console.error('[v0] /api/chat streamText error:', err)
      },
      onFinish: ({ text, toolCalls }) => {
        console.log('[v0] /api/chat finished — text length:', text.length, 'toolCalls:', toolCalls?.length ?? 0)
      },
    })

    return result.toUIMessageStreamResponse({
      sendError: true,
    })
  } catch (streamErr) {
    console.error('[v0] /api/chat streamText threw:', streamErr)

    // Return a fallback SSE stream with a safe message
    const fallback = "I couldn't fully analyze your data right now, but based on general patterns, you should review your recent spending and avoid unnecessary expenses. Try asking me again in a moment."
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text-delta', textDelta: fallback })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }
}

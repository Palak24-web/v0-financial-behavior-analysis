import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { readFileSync } from 'fs'
import { getUser, getMonthlyStats, getCategoryBreakdown, getFlaggedTransactions } from '@/lib/db'

function getGroqKey(): string {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY
  try {
    const raw = readFileSync('/vercel/share/.env.project', 'utf-8')
    const match = raw.match(/^GROQ_API_KEY=['"]?([^'"\n]+)['"]?/m)
    if (match?.[1]) return match[1].trim()
  } catch {}
  throw new Error('GROQ_API_KEY not found')
}

const getGroqModel = (model: string) => createGroq({ apiKey: getGroqKey() })(model)

export const maxDuration = 30

// POST /api/decision
// Body: { item: string, amount: number, category: string, user_id?: number }
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    console.log('[v0] /api/decision body:', JSON.stringify(body))

    const item = String(body.item ?? '').trim()
    const amount = body.amount
    const category = String(body.category ?? 'Misc').trim() || 'Misc'
    const userId = parseInt(String(body.user_id ?? 1), 10) || 1

    if (!item) {
      return NextResponse.json({ error: 'item is required' }, { status: 400 })
    }
    if (!amount) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 })
    }

    const parsedAmount = parseFloat(String(amount))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // Fetch live user data from Neon
    console.log('[v0] /api/decision fetching DB for userId:', userId)
    const [user, stats, categories, flagged] = await Promise.all([
      getUser(userId),
      getMonthlyStats(userId),
      getCategoryBreakdown(userId, 30),
      getFlaggedTransactions(userId, 20),
    ])
    console.log('[v0] /api/decision DB result — user:', user?.name, 'stats:', JSON.stringify(stats))

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const budget = Number(user.monthly_budget ?? 0)
    const income = Number(user.monthly_income ?? 0)
    const spent = Number(stats.total_spent ?? 0)
    const remaining = budget - spent
    const flaggedCount = Number(stats.flagged_count ?? 0)
    const categorySpend = categories.find(
      (c) => c.category.toLowerCase() === category.toLowerCase()
    )
    const day = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const projected = day > 0 ? (spent / day) * daysInMonth : 0
    const wouldExceedBudget = spent + parsedAmount > budget
    const purchasePct = budget > 0 ? ((parsedAmount / budget) * 100).toFixed(1) : '0'
    const lateNightCount = flagged.filter((f) => f.flag_reason === 'late-night').length
    const impulseCount = flagged.filter((f) => f.flag_reason === 'impulse').length

    const context = `
User: ${user.name}
Monthly Income: $${income}
Monthly Budget: $${budget}
Spent So Far: $${spent.toFixed(2)} (day ${day} of ${daysInMonth})
Remaining Budget: $${remaining.toFixed(2)}
Projected Month-End Spend: $${projected.toFixed(2)}
Budget Status: ${wouldExceedBudget ? 'WOULD EXCEED BUDGET' : 'within budget'}
Flagged Transactions This Month: ${flaggedCount} (${lateNightCount} late-night, ${impulseCount} impulse)
Category Breakdown (last 30 days): ${categories.map((c) => `${c.category}: $${Number(c.total).toFixed(2)}`).join(', ')}
Spending in "${category}" this month: $${Number(categorySpend?.total ?? 0).toFixed(2)}

Potential Purchase:
- Item: "${item}"
- Amount: $${parsedAmount.toFixed(2)}
- Category: ${category}
- This purchase = ${purchasePct}% of monthly budget
- Would bring total to: $${(spent + parsedAmount).toFixed(2)}
`.trim()

    const result = await generateText({
      model: getGroqModel('llama-3.3-70b-versatile'),
      system: `You are "MoneyMind AI" — a sharp financial decision coach.
When evaluating a purchase:
1. Look at the real budget data — remaining budget, projected overspend, category history
2. Detect behavioral patterns — impulse risk, category addiction, late-night habits
3. Give a clear verdict: "buy", "skip", or "delay"
4. Be direct, data-driven, and slightly strict. No fluff, no generic advice.
5. Always reference specific dollar numbers from the context.
6. Respond ONLY with valid JSON, no markdown, no explanation outside the JSON.`,
      prompt: `Should the user buy this item? Analyze the real financial data below and respond with a JSON object only.

${context}

Respond with this exact JSON shape (no markdown code blocks, just raw JSON):
{
  "verdict": "buy" | "skip" | "delay",
  "risk_level": "low" | "medium" | "high",
  "risk_score": <number 0-100>,
  "headline": "<one punchy sentence verdict>",
  "reasoning": "<2-3 sentences using real dollar numbers>",
  "budget_impact": "<specific dollar impact>",
  "alternative": "<smarter alternative if skip/delay, or null>",
  "coaching_tip": "<one behavioral nudge based on their habits>"
}`,
    })

    // Parse the AI response — strip any accidental markdown fencing
    console.log('[v0] /api/decision AI raw text:', result.text.slice(0, 300))
    let output: {
      verdict: string; risk_level: string; risk_score: number; headline: string
      reasoning: string; budget_impact: string; alternative: string | null; coaching_tip: string
    }
    try {
      // Extract JSON robustly — handle ```json, ```, or bare JSON
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      const raw = jsonMatch ? jsonMatch[0] : result.text.replace(/```[\w]*\n?|```/g, '').trim()
      output = JSON.parse(raw)
      // Validate required fields
      if (!output.verdict || !output.risk_level) throw new Error('Missing required fields')
    } catch (parseErr) {
      console.log('[v0] /api/decision JSON parse failed, using fallback. Error:', parseErr)
      // Fallback: derive verdict from live numbers
      const risk = wouldExceedBudget ? 'high' : parsedAmount > remaining * 0.5 ? 'medium' : 'low'
      output = {
        verdict: wouldExceedBudget ? 'skip' : risk === 'medium' ? 'delay' : 'buy',
        risk_level: risk,
        risk_score: wouldExceedBudget ? 80 : risk === 'medium' ? 55 : 25,
        headline: wouldExceedBudget
          ? `Buying this would push you $${(spent + parsedAmount - budget).toFixed(0)} over your $${budget} budget.`
          : `You have $${Number(remaining).toFixed(0)} remaining — this is ${purchasePct}% of your budget.`,
        reasoning: `Your budget is $${budget} and you have spent $${spent.toFixed(2)} so far this month (day ${new Date().getDate()}). This purchase of $${parsedAmount.toFixed(2)} would bring your total to $${(spent + parsedAmount).toFixed(2)}.`,
        budget_impact: `Budget remaining after purchase: $${(remaining - parsedAmount).toFixed(2)}.`,
        alternative: risk !== 'low' ? `Consider delaying this to next month or finding a lower-cost option.` : null,
        coaching_tip: flaggedCount > 2
          ? `You have ${flaggedCount} flagged transactions this month — stay mindful of impulse buys.`
          : `Track this expense carefully to stay on your $${budget} monthly budget.`,
      }
    }

    return NextResponse.json({
      item,
      amount: parsedAmount,
      category,
      verdict: output.verdict,
      risk_level: output.risk_level,
      risk_score: output.risk_score,
      headline: output.headline,
      reasoning: output.reasoning,
      budget_impact: output.budget_impact,
      alternative: output.alternative,
      coaching_tip: output.coaching_tip,
      context: {
        budget,
        spent,
        remaining: remaining.toFixed(2),
        projected_month_end: projected.toFixed(2),
        would_exceed_budget: wouldExceedBudget,
        flagged_count: flaggedCount,
        category_spend: Number(categorySpend?.total ?? 0).toFixed(2),
      },
    })
  } catch (error) {
    console.error('[v0] /api/decision error:', error)
    // Always return a valid JSON response — never let the UI show a raw crash
    return NextResponse.json({
      verdict: 'delay',
      risk_level: 'unknown',
      risk_score: 50,
      headline: 'Unable to complete full analysis right now.',
      reasoning: 'There was an issue connecting to the data source. Please try again.',
      budget_impact: 'Unknown',
      alternative: 'Try again in a moment.',
      coaching_tip: 'When in doubt, wait 24 hours before any non-essential purchase.',
      context: { budget: 0, spent: 0, remaining: '0', projected_month_end: '0', would_exceed_budget: false, flagged_count: 0, category_spend: '0' },
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 }) // Return 200 so the frontend displays the fallback, not an error banner
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { getUser, getMonthlyStats, getCategoryBreakdown, getFlaggedTransactions } from '@/lib/db'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export const maxDuration = 30

// POST /api/decision
// Body: { item: string, amount: number, category: string, user_id?: number }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { item, amount, category, user_id = 1 } = body

    if (!item || !amount || !category) {
      return NextResponse.json(
        { error: 'item, amount, and category are required' },
        { status: 400 }
      )
    }

    const parsedAmount = parseFloat(String(amount))
    const userId = parseInt(String(user_id), 10)

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // Fetch live user data from Neon
    const [user, stats, categories, flagged] = await Promise.all([
      getUser(userId),
      getMonthlyStats(userId),
      getCategoryBreakdown(userId, 30),
      getFlaggedTransactions(userId, 20),
    ])

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
      model: groq('llama-3.3-70b-versatile'),
      output: Output.object({
        schema: z.object({
          verdict: z.enum(['buy', 'skip', 'delay']),
          risk_level: z.enum(['low', 'medium', 'high']),
          risk_score: z.number().min(0).max(100),
          headline: z.string().describe('One punchy sentence verdict'),
          reasoning: z.string().describe('2-3 sentences explaining the decision using real data'),
          budget_impact: z.string().describe('Specific dollar impact on the budget'),
          alternative: z.string().nullable().describe('A smarter alternative if verdict is skip or delay'),
          coaching_tip: z.string().describe('One behavioral nudge based on their spending habits'),
        }),
      }),
      system: `You are "MoneyMind AI" — a sharp financial decision coach.
When evaluating a purchase:
1. Look at the real budget data — remaining budget, projected overspend, category history
2. Detect behavioral patterns — impulse risk, category addiction, late-night habits
3. Give a clear verdict: "buy", "skip", or "delay"
4. Be direct, data-driven, and slightly strict. No fluff, no generic advice.
5. Always reference specific numbers from the context.`,
      prompt: `Should the user buy this item? Use the real financial data below to decide.\n\n${context}`,
    })

    const output = result.output

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
    console.error('[POST /api/decision]', error)
    return NextResponse.json({ error: 'Decision analysis failed' }, { status: 500 })
  }
}

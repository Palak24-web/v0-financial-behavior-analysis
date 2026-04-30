import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getTransactionsByPeriod, getCategoryBreakdown, getUser, getMonthlyStats } from '@/lib/db'

export const maxDuration = 30

// GET /api/analyze?user_id=1
// Returns AI-generated behavioral analysis for a user based on their real transaction data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userIdParam = searchParams.get('user_id') ?? '1'
    const userId = parseInt(userIdParam, 10)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'user_id must be a valid integer' }, { status: 400 })
    }

    const days = parseInt(searchParams.get('days') ?? '30', 10)

    const [transactions, categories, user, stats] = await Promise.all([
      getTransactionsByPeriod(userId, days),
      getCategoryBreakdown(userId, days),
      getUser(userId),
      getMonthlyStats(userId),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const totalSpent = Number(stats.total_spent ?? 0)
    const topCategory = categories[0]
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const dayOfMonth = new Date().getDate()

    const result = await generateText({
      model: 'openai/gpt-4o-mini',
      output: Output.object({
        schema: z.object({
          behaviorInsight: z.string(),
          topBehaviorPattern: z.string(),
          riskLevel: z.enum(['low', 'medium', 'high']),
          actionableRecommendation: z.string(),
          predictedMonthEnd: z.number(),
          savingOpportunity: z.number(),
          anomalyAlert: z.string().nullable(),
        }),
      }),
      system: 'You are MoneyMind AI, an expert financial behavior analyst. Be specific and data-driven.',
      prompt: `Analyze this real spending data:
User: ${user.name}, Budget: $${user.monthly_budget}/month, Income: $${user.monthly_income}/month
This month so far (day ${dayOfMonth} of ${daysInMonth}): $${totalSpent.toFixed(2)} across ${stats.transaction_count} transactions
Flagged transactions: ${stats.flagged_count} totaling $${stats.flagged_amount}
Top category: ${topCategory?.category ?? 'N/A'} at $${topCategory?.total ?? 0}
All categories: ${categories.map((c) => `${c.category}: $${c.total} (${c.count} tx)`).join(', ')}

Return behavioral insight, top pattern, risk level (low/medium/high), one actionable recommendation, predicted month-end spend as a number, saving opportunity as a number, and anomaly alert if any.`,
    })

    return NextResponse.json({
      transactions: transactions.slice(0, 10),
      summary: {
        total: totalSpent,
        byCategory: Object.fromEntries(categories.map((c) => [c.category, Number(c.total)])),
        flaggedCount: stats.flagged_count,
        transactionCount: stats.transaction_count,
        days,
      },
      aiInsights: result.output,
      user: { id: user.id, name: user.name, budget: user.monthly_budget, income: user.monthly_income },
    })
  } catch (error) {
    console.error('[GET /api/analyze]', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

// POST /api/analyze - ask a specific financial question
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, user_id = 1 } = body

    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const userId = parseInt(String(user_id), 10)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'user_id must be a valid integer' }, { status: 400 })
    }

    const [categories, user, stats] = await Promise.all([
      getCategoryBreakdown(userId, 30),
      getUser(userId),
      getMonthlyStats(userId),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const context = `User: ${user.name}, Budget: $${user.monthly_budget}/month, Income: $${user.monthly_income}/month.
This month: $${stats.total_spent} spent across ${stats.transaction_count} transactions. Flagged: ${stats.flagged_count}.
Category breakdown: ${categories.map((c) => `${c.category} $${c.total}`).join(', ')}.`

    const result = await generateText({
      model: 'openai/gpt-4o-mini',
      system:
        "You are MoneyMind AI, a sharp and direct financial behavior coach. Answer the user's question using their real spending data. Be specific and actionable, not generic.",
      messages: [{ role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }],
    })

    return NextResponse.json({
      question,
      answer: result.text,
      usage: result.usage,
      user: { id: user.id, name: user.name },
    })
  } catch (error) {
    console.error('[POST /api/analyze]', error)
    return NextResponse.json({ error: 'Failed to answer question' }, { status: 500 })
  }
}

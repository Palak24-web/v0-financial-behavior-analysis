import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getTransactionsByPeriod, getCategoryBreakdown, getUser, getMonthlyStats } from '@/lib/db'

export const maxDuration = 30

export async function GET() {
  try {
    const userId = 1
    const [transactions, categories, user, stats] = await Promise.all([
      getTransactionsByPeriod(userId, 30),
      getCategoryBreakdown(userId, 30),
      getUser(userId),
      getMonthlyStats(userId),
    ])

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
User: ${user?.name}, Budget: $${user?.monthly_budget}/month, Income: $${user?.monthly_income}/month
This month so far (day ${dayOfMonth} of ${daysInMonth}): $${totalSpent.toFixed(2)} across ${stats.transaction_count} transactions
Flagged transactions: ${stats.flagged_count} totaling $${stats.flagged_amount}
Top category: ${topCategory?.category ?? 'N/A'} at $${topCategory?.total ?? 0}
All categories: ${categories.map(c => `${c.category}: $${c.total} (${c.count} tx)`).join(', ')}

Return behavioral insight, top pattern, risk level (low/medium/high), one actionable recommendation, predicted month-end spend as a number, saving opportunity as a number, and anomaly alert if any.`,
    })

    return NextResponse.json({
      transactions: transactions.slice(0, 10),
      summary: {
        total: totalSpent,
        byCategory: Object.fromEntries(categories.map(c => [c.category, Number(c.total)])),
        flaggedCount: stats.flagged_count,
        transactionCount: stats.transaction_count,
      },
      aiInsights: result.output,
      user: user ? { name: user.name, budget: user.monthly_budget, income: user.monthly_income } : null,
    })
  } catch (error) {
    console.error('[analyze GET]', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question } = body

    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const [categories, user, stats] = await Promise.all([
      getCategoryBreakdown(1, 30),
      getUser(1),
      getMonthlyStats(1),
    ])

    const context = `User: ${user?.name}, Budget: $${user?.monthly_budget}/month, Income: $${user?.monthly_income}/month.
This month: $${stats.total_spent} spent across ${stats.transaction_count} transactions. Flagged: ${stats.flagged_count}.
Category breakdown: ${categories.map(c => `${c.category} $${c.total}`).join(', ')}.`

    const result = await generateText({
      model: 'openai/gpt-4o-mini',
      system: "You are MoneyMind AI, a sharp and direct financial behavior coach. Answer the user's question using their real spending data. Be specific and actionable, not generic.",
      messages: [
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
    })

    return NextResponse.json({
      question,
      answer: result.text,
      usage: result.usage,
    })
  } catch (error) {
    console.error('[analyze POST]', error)
    return NextResponse.json({ error: 'Failed to answer question' }, { status: 500 })
  }
}

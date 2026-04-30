import { generateText, Output } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

const SAMPLE_TRANSACTIONS = [
  { amount: 45.50, merchant: 'Zomato', category: 'Food', date: '2025-04-28T22:15:00' },
  { amount: 12.00, merchant: 'Netflix', category: 'Subscriptions', date: '2025-04-27T10:00:00' },
  { amount: 89.99, merchant: 'Amazon', category: 'Shopping', date: '2025-04-26T14:30:00' },
  { amount: 35.00, merchant: 'Swiggy', category: 'Food', date: '2025-04-25T23:45:00' },
  { amount: 150.00, merchant: 'Flipkart', category: 'Shopping', date: '2025-04-24T16:00:00' },
  { amount: 28.00, merchant: 'Uber', category: 'Travel', date: '2025-04-23T09:20:00' },
  { amount: 9.99, merchant: 'Spotify', category: 'Subscriptions', date: '2025-04-22T00:00:00' },
  { amount: 62.00, merchant: 'Zomato', category: 'Food', date: '2025-04-21T21:30:00' },
  { amount: 200.00, merchant: 'HDFC Bill', category: 'Bills', date: '2025-04-20T08:00:00' },
  { amount: 18.00, merchant: 'McDonald\'s', category: 'Food', date: '2025-04-19T13:15:00' },
]

export async function GET() {
  const total = SAMPLE_TRANSACTIONS.reduce((s, t) => s + t.amount, 0)
  const byCategory: Record<string, number> = {}
  SAMPLE_TRANSACTIONS.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
  })

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
    system: 'You are MoneyMind AI, an expert financial behavior analyst.',
    prompt: `Analyze this spending data and return a JSON insight:
Total spent this month: $${total.toFixed(2)}
Category breakdown: ${JSON.stringify(byCategory)}
Transactions this period: ${SAMPLE_TRANSACTIONS.length}
Notable: ${SAMPLE_TRANSACTIONS.filter(t => new Date(t.date).getHours() >= 22).length} late-night purchases

Provide a behavioral insight, top pattern, risk level, one actionable recommendation, predicted month-end spend, saving opportunity amount, and anomaly alert if any.`,
  })

  return Response.json({
    transactions: SAMPLE_TRANSACTIONS,
    summary: {
      total,
      byCategory,
      count: SAMPLE_TRANSACTIONS.length,
    },
    aiInsights: result.output,
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { transactions = SAMPLE_TRANSACTIONS, question } = body

  const total = transactions.reduce((s: number, t: { amount: number }) => s + t.amount, 0)
  const byCategory: Record<string, number> = {}
  transactions.forEach((t: { category: string; amount: number }) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
  })

  const result = await generateText({
    model: 'openai/gpt-4o-mini',
    system: 'You are MoneyMind AI. Be concise, insightful, and actionable.',
    prompt: `User question: "${question}"
    
Spending context:
- Total: $${total.toFixed(2)}
- Breakdown: ${JSON.stringify(byCategory)}
- Transactions: ${JSON.stringify(transactions.slice(0, 5))}

Provide a direct, personalized answer in 2-3 sentences with a clear recommendation.`,
  })

  return Response.json({
    question,
    answer: result.text,
    usage: result.usage,
  })
}

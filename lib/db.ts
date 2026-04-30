import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export const sql = neon(process.env.DATABASE_URL)

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = {
  id: number
  name: string
  email: string
  monthly_income: number
  monthly_budget: number
  created_at: string
}

export type Transaction = {
  id: number
  user_id: number
  amount: number
  merchant: string
  category: string
  date: string
  note: string | null
  is_flagged: boolean
  flag_reason: string | null
  created_at: string
}

export type BehaviorInsight = {
  id: number
  user_id: number
  type: string
  title: string
  description: string
  action: string | null
  severity: string
  created_at: string
}

export type ChatSession = {
  id: number
  user_id: number
  title: string | null
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getUser(userId = 1): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`
  return (rows[0] as User) ?? null
}

export async function getTransactions(userId = 1, limit = 50): Promise<Transaction[]> {
  const rows = await sql`
    SELECT * FROM transactions
    WHERE user_id = ${userId}
    ORDER BY date DESC
    LIMIT ${limit}
  `
  return rows as Transaction[]
}

export async function getTransactionsByPeriod(
  userId = 1,
  days = 30
): Promise<Transaction[]> {
  const rows = await sql`
    SELECT * FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - INTERVAL '${days} days'
    ORDER BY date DESC
  `
  return rows as Transaction[]
}

export async function getCategoryBreakdown(
  userId = 1,
  days = 30
): Promise<{ category: string; total: number; count: number }[]> {
  const rows = await sql`
    SELECT
      category,
      SUM(amount)::NUMERIC(10,2) AS total,
      COUNT(*)::INTEGER AS count
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - INTERVAL '${days} days'
    GROUP BY category
    ORDER BY total DESC
  `
  return rows as { category: string; total: number; count: number }[]
}

export async function getWeeklySpending(userId = 1): Promise<{ week: string; amount: number }[]> {
  const rows = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('week', date), 'Mon DD') AS week,
      SUM(amount)::NUMERIC(10,2) AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - INTERVAL '8 weeks'
    GROUP BY DATE_TRUNC('week', date)
    ORDER BY DATE_TRUNC('week', date) ASC
  `
  return rows as { week: string; amount: number }[]
}

export async function getDailySpending(userId = 1, days = 7): Promise<{ day: string; amount: number }[]> {
  const rows = await sql`
    SELECT
      TO_CHAR(date::DATE, 'Dy') AS day,
      SUM(amount)::NUMERIC(10,2) AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - INTERVAL '${days} days'
    GROUP BY date::DATE, TO_CHAR(date::DATE, 'Dy')
    ORDER BY date::DATE ASC
  `
  return rows as { day: string; amount: number }[]
}

export async function getFlaggedTransactions(userId = 1): Promise<Transaction[]> {
  const rows = await sql`
    SELECT * FROM transactions
    WHERE user_id = ${userId} AND is_flagged = TRUE
    ORDER BY date DESC
    LIMIT 20
  `
  return rows as Transaction[]
}

export async function getBehaviorInsights(userId = 1): Promise<BehaviorInsight[]> {
  const rows = await sql`
    SELECT * FROM behavior_insights
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `
  return rows as BehaviorInsight[]
}

export async function getChatMessages(sessionId: number): Promise<ChatMessage[]> {
  const rows = await sql`
    SELECT * FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `
  return rows as ChatMessage[]
}

export async function saveChatMessage(
  sessionId: number,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  await sql`
    INSERT INTO chat_messages (session_id, role, content)
    VALUES (${sessionId}, ${role}, ${content})
  `
  await sql`
    UPDATE chat_sessions SET updated_at = NOW()
    WHERE id = ${sessionId}
  `
}

export async function getMonthlyStats(userId = 1) {
  const rows = await sql`
    SELECT
      SUM(amount)::NUMERIC(10,2) AS total_spent,
      COUNT(*)::INTEGER AS transaction_count,
      COUNT(*) FILTER (WHERE is_flagged = TRUE)::INTEGER AS flagged_count,
      SUM(amount) FILTER (WHERE is_flagged = TRUE)::NUMERIC(10,2) AS flagged_amount
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= DATE_TRUNC('month', NOW())
  `
  return rows[0] as {
    total_spent: number
    transaction_count: number
    flagged_count: number
    flagged_amount: number
  }
}

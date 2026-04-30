import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export const sql = neon(process.env.DATABASE_URL!)

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type MonthlyStats = {
  total_spent: number
  transaction_count: number
  flagged_count: number
  flagged_amount: number
}

export type CategoryBreakdown = {
  category: string
  total: number
  count: number
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  const rows = await sql`SELECT * FROM users ORDER BY id ASC`
  return rows as User[]
}

export async function getUser(userId: number): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`
  return (rows[0] as User) ?? null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
  return (rows[0] as User) ?? null
}

export async function createUser(data: {
  name: string
  email: string
  monthly_income: number
  monthly_budget: number
}): Promise<User> {
  const rows = await sql`
    INSERT INTO users (name, email, monthly_income, monthly_budget)
    VALUES (${data.name}, ${data.email}, ${data.monthly_income}, ${data.monthly_budget})
    RETURNING *
  `
  return rows[0] as User
}

export async function updateUser(
  userId: number,
  data: Partial<{ name: string; email: string; monthly_income: number; monthly_budget: number }>
): Promise<User | null> {
  const fields = Object.entries(data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) return getUser(userId)

  // Build dynamic SET clause safely
  const setClauses = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
  const values = [userId, ...fields.map(([, v]) => v)]

  const rows = await sql(
    `UPDATE users SET ${setClauses} WHERE id = $1 RETURNING *`,
    values
  )
  return (rows[0] as User) ?? null
}

export async function deleteUser(userId: number): Promise<boolean> {
  const rows = await sql`DELETE FROM users WHERE id = ${userId} RETURNING id`
  return rows.length > 0
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(userId: number, limit = 50): Promise<Transaction[]> {
  const rows = await sql`
    SELECT * FROM transactions
    WHERE user_id = ${userId}
    ORDER BY date DESC
    LIMIT ${limit}
  `
  return rows as Transaction[]
}

export async function getTransaction(transactionId: number): Promise<Transaction | null> {
  const rows = await sql`SELECT * FROM transactions WHERE id = ${transactionId} LIMIT 1`
  return (rows[0] as Transaction) ?? null
}

export async function getTransactionsByPeriod(userId: number, days = 30): Promise<Transaction[]> {
  const rows = await sql`
    SELECT * FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - (${days} || ' days')::INTERVAL
    ORDER BY date DESC
  `
  return rows as Transaction[]
}

export async function getTransactionsByCategory(
  userId: number,
  category: string,
  limit = 50
): Promise<Transaction[]> {
  const rows = await sql`
    SELECT * FROM transactions
    WHERE user_id = ${userId} AND category = ${category}
    ORDER BY date DESC
    LIMIT ${limit}
  `
  return rows as Transaction[]
}

export async function getFlaggedTransactions(userId: number, limit = 50): Promise<Transaction[]> {
  const rows = await sql`
    SELECT * FROM transactions
    WHERE user_id = ${userId} AND is_flagged = TRUE
    ORDER BY date DESC
    LIMIT ${limit}
  `
  return rows as Transaction[]
}

export async function getCategoryBreakdown(userId: number, days = 30): Promise<CategoryBreakdown[]> {
  const rows = await sql`
    SELECT
      category,
      SUM(amount)::NUMERIC(10,2) AS total,
      COUNT(*)::INTEGER AS count
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - (${days} || ' days')::INTERVAL
    GROUP BY category
    ORDER BY total DESC
  `
  return rows as CategoryBreakdown[]
}

export async function getWeeklySpending(
  userId: number
): Promise<{ week: string; amount: number; week_start: string }[]> {
  const rows = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('week', date), 'Mon DD') AS week,
      DATE_TRUNC('week', date)::TEXT AS week_start,
      SUM(amount)::NUMERIC(10,2) AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - INTERVAL '8 weeks'
    GROUP BY DATE_TRUNC('week', date)
    ORDER BY DATE_TRUNC('week', date) ASC
  `
  return rows as { week: string; amount: number; week_start: string }[]
}

export async function getDailySpending(
  userId: number,
  days = 7
): Promise<{ day: string; date: string; amount: number }[]> {
  const rows = await sql`
    SELECT
      TO_CHAR(date::DATE, 'Dy') AS day,
      date::DATE::TEXT AS date,
      SUM(amount)::NUMERIC(10,2) AS amount
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= NOW() - (${days} || ' days')::INTERVAL
    GROUP BY date::DATE
    ORDER BY date::DATE ASC
  `
  return rows as { day: string; date: string; amount: number }[]
}

export async function createTransaction(data: {
  user_id: number
  amount: number
  merchant: string
  category: string
  date?: string
  note?: string | null
  is_flagged?: boolean
  flag_reason?: string | null
}): Promise<Transaction> {
  const rows = await sql`
    INSERT INTO transactions (user_id, amount, merchant, category, date, note, is_flagged, flag_reason)
    VALUES (
      ${data.user_id},
      ${data.amount},
      ${data.merchant},
      ${data.category},
      ${data.date ?? 'NOW()'},
      ${data.note ?? null},
      ${data.is_flagged ?? false},
      ${data.flag_reason ?? null}
    )
    RETURNING *
  `
  return rows[0] as Transaction
}

export async function updateTransaction(
  transactionId: number,
  data: Partial<{
    amount: number
    merchant: string
    category: string
    date: string
    note: string | null
    is_flagged: boolean
    flag_reason: string | null
  }>
): Promise<Transaction | null> {
  const fields = Object.entries(data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) return getTransaction(transactionId)

  const setClauses = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
  const values = [transactionId, ...fields.map(([, v]) => v)]

  const rows = await sql(
    `UPDATE transactions SET ${setClauses} WHERE id = $1 RETURNING *`,
    values
  )
  return (rows[0] as Transaction) ?? null
}

export async function deleteTransaction(transactionId: number): Promise<boolean> {
  const rows = await sql`DELETE FROM transactions WHERE id = ${transactionId} RETURNING id`
  return rows.length > 0
}

export async function getMonthlyStats(userId: number): Promise<MonthlyStats> {
  const rows = await sql`
    SELECT
      COALESCE(SUM(amount), 0)::NUMERIC(10,2) AS total_spent,
      COUNT(*)::INTEGER AS transaction_count,
      COUNT(*) FILTER (WHERE is_flagged = TRUE)::INTEGER AS flagged_count,
      COALESCE(SUM(amount) FILTER (WHERE is_flagged = TRUE), 0)::NUMERIC(10,2) AS flagged_amount
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= DATE_TRUNC('month', NOW())
  `
  return rows[0] as MonthlyStats
}

// ─── Behavior Insights ────────────────────────────────────────────────────────

export async function getBehaviorInsights(userId: number): Promise<BehaviorInsight[]> {
  const rows = await sql`
    SELECT * FROM behavior_insights
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `
  return rows as BehaviorInsight[]
}

export async function getBehaviorInsight(insightId: number): Promise<BehaviorInsight | null> {
  const rows = await sql`SELECT * FROM behavior_insights WHERE id = ${insightId} LIMIT 1`
  return (rows[0] as BehaviorInsight) ?? null
}

export async function createBehaviorInsight(data: {
  user_id: number
  type: string
  title: string
  description: string
  action?: string | null
  severity: string
}): Promise<BehaviorInsight> {
  const rows = await sql`
    INSERT INTO behavior_insights (user_id, type, title, description, action, severity)
    VALUES (${data.user_id}, ${data.type}, ${data.title}, ${data.description}, ${data.action ?? null}, ${data.severity})
    RETURNING *
  `
  return rows[0] as BehaviorInsight
}

export async function updateBehaviorInsight(
  insightId: number,
  data: Partial<{ type: string; title: string; description: string; action: string | null; severity: string }>
): Promise<BehaviorInsight | null> {
  const fields = Object.entries(data).filter(([, v]) => v !== undefined)
  if (fields.length === 0) return getBehaviorInsight(insightId)

  const setClauses = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
  const values = [insightId, ...fields.map(([, v]) => v)]

  const rows = await sql(
    `UPDATE behavior_insights SET ${setClauses} WHERE id = $1 RETURNING *`,
    values
  )
  return (rows[0] as BehaviorInsight) ?? null
}

export async function deleteBehaviorInsight(insightId: number): Promise<boolean> {
  const rows = await sql`DELETE FROM behavior_insights WHERE id = ${insightId} RETURNING id`
  return rows.length > 0
}

// ─── Chat Sessions ────────────────────────────────────────────────────────────

export async function getChatSessions(userId: number): Promise<ChatSession[]> {
  const rows = await sql`
    SELECT * FROM chat_sessions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `
  return rows as ChatSession[]
}

export async function getChatSession(sessionId: number): Promise<ChatSession | null> {
  const rows = await sql`SELECT * FROM chat_sessions WHERE id = ${sessionId} LIMIT 1`
  return (rows[0] as ChatSession) ?? null
}

export async function createChatSession(userId: number, title?: string): Promise<ChatSession> {
  const rows = await sql`
    INSERT INTO chat_sessions (user_id, title)
    VALUES (${userId}, ${title ?? null})
    RETURNING *
  `
  return rows[0] as ChatSession
}

export async function updateChatSessionTitle(sessionId: number, title: string): Promise<ChatSession | null> {
  const rows = await sql`
    UPDATE chat_sessions SET title = ${title}, updated_at = NOW()
    WHERE id = ${sessionId}
    RETURNING *
  `
  return (rows[0] as ChatSession) ?? null
}

export async function deleteChatSession(sessionId: number): Promise<boolean> {
  await sql`DELETE FROM chat_messages WHERE session_id = ${sessionId}`
  const rows = await sql`DELETE FROM chat_sessions WHERE id = ${sessionId} RETURNING id`
  return rows.length > 0
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

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
): Promise<ChatMessage> {
  const rows = await sql`
    INSERT INTO chat_messages (session_id, role, content)
    VALUES (${sessionId}, ${role}, ${content})
    RETURNING *
  `
  await sql`UPDATE chat_sessions SET updated_at = NOW() WHERE id = ${sessionId}`
  return rows[0] as ChatMessage
}

export async function deleteMessage(messageId: number): Promise<boolean> {
  const rows = await sql`DELETE FROM chat_messages WHERE id = ${messageId} RETURNING id`
  return rows.length > 0
}

// ─── Admin Analytics ──────────────────────────────────────────────────────────

export async function getAdminOverview() {
  const [userStats, txStats, insightStats] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::INTEGER AS total_users,
        ROUND(AVG(monthly_income)::NUMERIC, 2) AS avg_income,
        ROUND(AVG(monthly_budget)::NUMERIC, 2) AS avg_budget
      FROM users
    `,
    sql`
      SELECT
        COUNT(*)::INTEGER AS total_transactions,
        ROUND(SUM(amount)::NUMERIC, 2) AS total_volume,
        ROUND(AVG(amount)::NUMERIC, 2) AS avg_transaction,
        COUNT(*) FILTER (WHERE is_flagged = TRUE)::INTEGER AS flagged_count,
        COUNT(*) FILTER (WHERE flag_reason = 'late-night')::INTEGER AS late_night_count,
        COUNT(*) FILTER (WHERE flag_reason = 'impulse')::INTEGER AS impulse_count
      FROM transactions
    `,
    sql`
      SELECT
        COUNT(*)::INTEGER AS total_insights,
        COUNT(*) FILTER (WHERE severity = 'danger')::INTEGER AS danger_count,
        COUNT(*) FILTER (WHERE severity = 'warning')::INTEGER AS warning_count,
        COUNT(*) FILTER (WHERE severity = 'info')::INTEGER AS info_count
      FROM behavior_insights
    `,
  ])
  return {
    users: userStats[0],
    transactions: txStats[0],
    insights: insightStats[0],
  }
}

export async function getAdminCategoryStats() {
  const rows = await sql`
    SELECT
      category,
      COUNT(*)::INTEGER AS transaction_count,
      ROUND(SUM(amount)::NUMERIC, 2) AS total_volume,
      ROUND(AVG(amount)::NUMERIC, 2) AS avg_amount,
      COUNT(*) FILTER (WHERE is_flagged = TRUE)::INTEGER AS flagged_count
    FROM transactions
    GROUP BY category
    ORDER BY total_volume DESC
  `
  return rows
}

export async function getAdminUserLeaderboard() {
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.monthly_budget,
      u.monthly_income,
      COUNT(t.id)::INTEGER AS transaction_count,
      COALESCE(ROUND(SUM(t.amount)::NUMERIC, 2), 0) AS total_spent,
      COUNT(t.id) FILTER (WHERE t.is_flagged = TRUE)::INTEGER AS flagged_count,
      COUNT(bi.id)::INTEGER AS insight_count
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id
    LEFT JOIN behavior_insights bi ON bi.user_id = u.id
    GROUP BY u.id, u.name, u.email, u.monthly_budget, u.monthly_income
    ORDER BY total_spent DESC
  `
  return rows
}

export async function getAdminFlaggedReport() {
  const rows = await sql`
    SELECT
      t.*,
      u.name AS user_name,
      u.email AS user_email
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.is_flagged = TRUE
    ORDER BY t.date DESC
    LIMIT 100
  `
  return rows
}

export async function getAdminSpendingTrend(days = 30) {
  const rows = await sql`
    SELECT
      date::DATE::TEXT AS day,
      COUNT(*)::INTEGER AS tx_count,
      ROUND(SUM(amount)::NUMERIC, 2) AS total,
      COUNT(*) FILTER (WHERE is_flagged = TRUE)::INTEGER AS flagged
    FROM transactions
    WHERE date >= NOW() - (${days} || ' days')::INTERVAL
    GROUP BY date::DATE
    ORDER BY date::DATE ASC
  `
  return rows
}

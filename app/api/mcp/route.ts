/**
 * MoneyMind MCP Server
 *
 * Exposes live financial database tools via the Model Context Protocol (MCP)
 * over HTTP using the Web Standards Streamable HTTP transport.
 *
 * MCP endpoint: POST/GET/DELETE /api/mcp
 *
 * Tools exposed:
 *  - get_user_profile        → user details + budget info
 *  - get_monthly_stats       → spend totals, flagged counts for current month
 *  - get_category_breakdown  → per-category spend for N days
 *  - get_transactions        → paginated transaction list
 *  - get_flagged_transactions → impulse / late-night flags
 *  - get_weekly_spending     → 8-week spending trend
 *  - get_daily_spending      → day-by-day for last N days
 *  - get_behavior_insights   → AI-generated behavioral insights for a user
 *  - get_admin_overview      → platform-wide aggregates (admin)
 *  - get_admin_leaderboard   → per-user spend leaderboard (admin)
 *  - get_admin_flagged_report → all flagged transactions across users (admin)
 *  - get_admin_spending_trend → daily platform spend trend (admin)
 *  - create_transaction       → insert a new transaction
 *  - create_behavior_insight  → insert a new behavioral insight
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import {
  getUser,
  getMonthlyStats,
  getCategoryBreakdown,
  getTransactions,
  getFlaggedTransactions,
  getWeeklySpending,
  getDailySpending,
  getBehaviorInsights,
  getAdminOverview,
  getAdminUserLeaderboard,
  getAdminFlaggedReport,
  getAdminSpendingTrend,
  createTransaction,
  createBehaviorInsight,
} from '@/lib/db'

// ─── Build MCP server ─────────────────────────────────────────────────────────

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'moneymind-financial-agent',
    version: '1.0.0',
  })

  // ── User profile ──────────────────────────────────────────────────────────
  server.tool(
    'get_user_profile',
    'Retrieve a user profile including name, email, monthly income, and monthly budget.',
    { user_id: z.number().int().positive().describe('The user ID to look up') },
    async ({ user_id }) => {
      const user = await getUser(user_id)
      if (!user) {
        return { content: [{ type: 'text', text: `No user found with id ${user_id}` }], isError: true }
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(user, null, 2),
        }],
      }
    }
  )

  // ── Monthly stats ─────────────────────────────────────────────────────────
  server.tool(
    'get_monthly_stats',
    'Get the current-month spending totals, transaction count, and flagged transaction summary for a user.',
    { user_id: z.number().int().positive().describe('The user ID') },
    async ({ user_id }) => {
      const stats = await getMonthlyStats(user_id)
      const day = new Date().getDate()
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const projected = ((Number(stats.total_spent) / day) * daysInMonth).toFixed(2)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ...stats, day_of_month: day, days_in_month: daysInMonth, projected_total: projected }, null, 2),
        }],
      }
    }
  )

  // ── Category breakdown ────────────────────────────────────────────────────
  server.tool(
    'get_category_breakdown',
    'Get per-category spending totals and transaction counts over the last N days.',
    {
      user_id: z.number().int().positive(),
      days: z.number().int().min(1).max(365).default(30).describe('Look-back window in days (default 30)'),
    },
    async ({ user_id, days }) => {
      const rows = await getCategoryBreakdown(user_id, days)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Transactions ──────────────────────────────────────────────────────────
  server.tool(
    'get_transactions',
    'Retrieve the most recent transactions for a user, ordered by date descending.',
    {
      user_id: z.number().int().positive(),
      limit: z.number().int().min(1).max(200).default(20).describe('Maximum number of transactions to return'),
    },
    async ({ user_id, limit }) => {
      const rows = await getTransactions(user_id, limit)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Flagged transactions ───────────────────────────────────────────────────
  server.tool(
    'get_flagged_transactions',
    'Get flagged transactions (impulse buys, late-night purchases) for a user.',
    {
      user_id: z.number().int().positive(),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ user_id, limit }) => {
      const rows = await getFlaggedTransactions(user_id, limit)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Weekly spending trend ─────────────────────────────────────────────────
  server.tool(
    'get_weekly_spending',
    'Get weekly spending totals for the last 8 weeks for trend analysis.',
    { user_id: z.number().int().positive() },
    async ({ user_id }) => {
      const rows = await getWeeklySpending(user_id)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Daily spending ────────────────────────────────────────────────────────
  server.tool(
    'get_daily_spending',
    'Get day-by-day spending totals for the last N days.',
    {
      user_id: z.number().int().positive(),
      days: z.number().int().min(1).max(90).default(7),
    },
    async ({ user_id, days }) => {
      const rows = await getDailySpending(user_id, days)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Behavior insights ─────────────────────────────────────────────────────
  server.tool(
    'get_behavior_insights',
    'Retrieve all AI-generated behavioral insights for a user (patterns, anomalies, trends, forecasts).',
    { user_id: z.number().int().positive() },
    async ({ user_id }) => {
      const rows = await getBehaviorInsights(user_id)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Create transaction ────────────────────────────────────────────────────
  server.tool(
    'create_transaction',
    'Insert a new transaction for a user. Automatically flags as late-night if hour is 22-04.',
    {
      user_id: z.number().int().positive(),
      amount: z.number().positive().describe('Transaction amount in USD'),
      merchant: z.string().min(1).describe('Merchant name'),
      category: z.enum(['Food', 'Shopping', 'Bills', 'Travel', 'Subscriptions', 'Investment', 'Transport', 'Misc']),
      date: z.string().optional().describe('ISO date string; defaults to now'),
      note: z.string().optional(),
      is_flagged: z.boolean().optional(),
      flag_reason: z.enum(['late-night', 'impulse', 'duplicate', 'suspicious']).optional(),
    },
    async ({ user_id, amount, merchant, category, date, note, is_flagged, flag_reason }) => {
      const txDate = date ? new Date(date) : new Date()
      const hour = txDate.getHours()
      const autoFlag = is_flagged ?? (hour >= 22 || hour <= 4)
      const autoReason = flag_reason ?? (autoFlag ? 'late-night' : null)

      const tx = await createTransaction({
        user_id, amount, merchant, category,
        date: txDate.toISOString(),
        note: note ?? null,
        is_flagged: autoFlag,
        flag_reason: autoReason,
      })
      return { content: [{ type: 'text', text: JSON.stringify(tx, null, 2) }] }
    }
  )

  // ── Create behavior insight ───────────────────────────────────────────────
  server.tool(
    'create_behavior_insight',
    'Save a new behavioral insight for a user (e.g., detected pattern, anomaly, or recommendation).',
    {
      user_id: z.number().int().positive(),
      type: z.enum(['pattern', 'anomaly', 'trend', 'forecast', 'positive']),
      title: z.string().min(1),
      description: z.string().min(1),
      action: z.string().optional().describe('Actionable recommendation text'),
      severity: z.enum(['info', 'warning', 'danger']),
    },
    async ({ user_id, type, title, description, action, severity }) => {
      const insight = await createBehaviorInsight({ user_id, type, title, description, action: action ?? null, severity })
      return { content: [{ type: 'text', text: JSON.stringify(insight, null, 2) }] }
    }
  )

  // ── Admin: platform overview ──────────────────────────────────────────────
  server.tool(
    'get_admin_overview',
    'Get platform-wide aggregate statistics: total users, transactions, volume, and insight counts.',
    {},
    async () => {
      const data = await getAdminOverview()
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ── Admin: leaderboard ────────────────────────────────────────────────────
  server.tool(
    'get_admin_leaderboard',
    'Get per-user spending leaderboard with transaction counts, flagged items, and insight counts.',
    {},
    async () => {
      const rows = await getAdminUserLeaderboard()
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Admin: flagged report ─────────────────────────────────────────────────
  server.tool(
    'get_admin_flagged_report',
    'Get a full report of all flagged transactions across all users (latest 100).',
    {},
    async () => {
      const rows = await getAdminFlaggedReport()
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── Admin: spending trend ─────────────────────────────────────────────────
  server.tool(
    'get_admin_spending_trend',
    'Get platform-wide daily spending trend (total volume + flagged count) for the last N days.',
    { days: z.number().int().min(1).max(90).default(30) },
    async ({ days }) => {
      const rows = await getAdminSpendingTrend(days)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
  )

  return server
}

// ─── Stateless request handler ────────────────────────────────────────────────
// Each request gets its own transport instance (stateless mode — no session ID).
// This works perfectly for serverless deployments.

async function handleMcpRequest(req: Request): Promise<Response> {
  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  })
  await server.connect(transport)
  const response = await transport.handleRequest(req)
  return response
}

export const POST = handleMcpRequest
export const GET  = handleMcpRequest
export const DELETE = handleMcpRequest

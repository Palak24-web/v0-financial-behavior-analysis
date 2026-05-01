import { NextResponse } from 'next/server'

// GET /api - returns the full API reference
export async function GET() {
  return NextResponse.json({
    name: 'MoneyMind AI — REST API',
    version: '1.0.0',
    description: 'Financial behavior analysis backend. All endpoints return JSON.',
    base_url: '/api',
    endpoints: {
      users: {
        'GET /api/users': {
          description: 'List all users',
          query: { email: 'optional — filter by email (returns single user)' },
          response: { users: 'User[]', count: 'number' },
        },
        'POST /api/users': {
          description: 'Create a new user',
          body: { name: 'string', email: 'string', monthly_income: 'number', monthly_budget: 'number' },
          response: { user: 'User' },
        },
        'GET /api/users/[id]': {
          description: 'Get a single user',
          query: { include: 'stats | insights' },
          response: { user: 'User', stats: 'MonthlyStats (if include=stats)', insights: 'BehaviorInsight[] (if include=insights)' },
        },
        'PATCH /api/users/[id]': {
          description: 'Update a user (partial)',
          body: { name: 'string?', email: 'string?', monthly_income: 'number?', monthly_budget: 'number?' },
          response: { user: 'User' },
        },
        'DELETE /api/users/[id]': {
          description: 'Delete a user',
          response: { message: 'string' },
        },
      },
      transactions: {
        'GET /api/transactions': {
          description: 'Fetch transactions for a user',
          query: {
            user_id: 'required',
            type: 'recent | period | categories | weekly | daily | flagged | stats',
            days: 'number (default 30)',
            limit: 'number (default 50)',
            category: 'string — filter by category (only for type=recent)',
          },
        },
        'POST /api/transactions': {
          description: 'Create a transaction. Auto-flags late-night purchases (22:00–04:59).',
          body: {
            user_id: 'number',
            amount: 'number',
            merchant: 'string',
            category: 'Rent | Groceries | Subscriptions | Shopping | Utilities | Food & Drink | Transport | Travel | Entertainment | Health | Investment | Misc',
            date: 'ISO datetime (optional, default NOW)',
            note: 'string | null',
            is_flagged: 'boolean',
            flag_reason: 'late-night | impulse | unusual | large | null',
          },
        },
        'GET /api/transactions/[id]': { description: 'Get a single transaction by ID' },
        'PATCH /api/transactions/[id]': { description: 'Update a transaction (partial)' },
        'DELETE /api/transactions/[id]': { description: 'Delete a transaction' },
      },
      insights: {
        'GET /api/insights': {
          description: 'Get behavior insights for a user',
          query: {
            user_id: 'required',
            type: 'pattern | anomaly | trend | forecast | positive',
            severity: 'info | warning | danger',
            include: 'stats — adds monthly budget stats to response',
          },
        },
        'POST /api/insights': {
          description: 'Create a new behavior insight',
          body: {
            user_id: 'number',
            type: 'pattern | anomaly | trend | forecast | positive',
            title: 'string',
            description: 'string',
            action: 'string | null',
            severity: 'info | warning | danger',
          },
        },
        'GET /api/insights/[id]': { description: 'Get a single insight by ID' },
        'PATCH /api/insights/[id]': { description: 'Update an insight (partial)' },
        'DELETE /api/insights/[id]': { description: 'Delete an insight' },
      },
      chat: {
        'GET /api/sessions': {
          description: 'List all chat sessions for a user',
          query: { user_id: 'required' },
        },
        'POST /api/sessions': {
          description: 'Create a new chat session',
          body: { user_id: 'number', title: 'string | null' },
        },
        'GET /api/sessions/[id]': {
          description: 'Get a session',
          query: { include: 'messages — include full message history' },
        },
        'PATCH /api/sessions/[id]': {
          description: 'Update session title',
          body: { title: 'string' },
        },
        'DELETE /api/sessions/[id]': { description: 'Delete a session and all its messages' },
        'GET /api/sessions/[id]/messages': { description: 'Get all messages in a session' },
        'POST /api/sessions/[id]/messages': {
          description: 'Add a message to a session',
          body: { role: 'user | assistant', content: 'string' },
        },
        'POST /api/chat': { description: 'AI streaming chat endpoint (AI SDK compatible)' },
      },
      ai: {
        'GET /api/analyze': {
          description: 'AI-generated behavioral analysis for a user',
          query: { user_id: 'number (default 1)', days: 'number (default 30)' },
          response: { transactions: 'Transaction[]', summary: 'object', aiInsights: 'object', user: 'object' },
        },
        'POST /api/analyze': {
          description: 'Ask a specific financial question about a user',
          body: { question: 'string', user_id: 'number (default 1)' },
          response: { question: 'string', answer: 'string', usage: 'object' },
        },
      },
      admin: {
        'GET /api/admin': {
          description: 'Admin analytics dashboard',
          query: {
            view: 'overview | categories | leaderboard | flagged | trend | full',
            days: 'number — period for trend view (default 30)',
          },
          views: {
            overview: 'Aggregate user, transaction, and insight stats',
            categories: 'Per-category spending breakdown across all users',
            leaderboard: 'All users ranked by total spend with flagged counts',
            flagged: 'All flagged transactions with user info (last 100)',
            trend: 'Daily spending trend for a given period',
            full: 'All views combined in a single response',
          },
        },
      },
    },
  })
}

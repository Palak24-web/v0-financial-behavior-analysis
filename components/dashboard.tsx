'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, CreditCard, BarChart3, Coffee, ShoppingBag, Plane, DollarSign } from 'lucide-react'
import { WeeklyAreaChart, MonthlyBarChart, CategoryPieChart, StackedWeeklyChart } from './spending-chart'
import { SmartInsightTrigger } from './smart-insight-trigger'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CATEGORY_ICONS: Record<string, typeof Coffee> = {
  'Food & Drink': Coffee,
  'Groceries': ShoppingBag,
  'Shopping': ShoppingBag,
  'Transport': Plane,
  'Subscriptions': CreditCard,
  'Utilities': Zap,
  'Rent': DollarSign,
}

function StatCard({
  label, value, sub, change, trend, icon: Icon, color,
}: {
  label: string; value: string; sub: string; change: string; trend: 'up' | 'down' | 'neutral'; icon: typeof CreditCard; color: string
}) {
  const isNegativeTrend = trend === 'up' && (label === 'Total Spent' || label === 'Anomalies Found')
  const badgeCls = isNegativeTrend
    ? 'bg-red-500/10 text-red-400'
    : trend === 'up'
    ? 'bg-green-500/10 text-green-400'
    : trend === 'down'
    ? 'bg-green-500/10 text-green-400'
    : 'bg-yellow-500/10 text-yellow-400'

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-xl bg-secondary">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5 ${badgeCls}`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
          {change}
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground font-mono">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>
    </div>
  )
}

type DashboardTab = 'overview' | 'weekly' | 'monthly' | 'categories'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')

  const { data: insightsData, isLoading: loadingInsights } = useSWR('/api/insights?user_id=1&include=stats', fetcher)
  const { data: txData, isLoading: loadingTx } = useSWR('/api/transactions?user_id=1&type=recent&limit=8', fetcher)
  const { data: weeklyData } = useSWR('/api/transactions?user_id=1&type=weekly', fetcher)
  const { data: categoriesData } = useSWR('/api/transactions?user_id=1&type=categories&days=30', fetcher)
  const { data: dailyData } = useSWR('/api/transactions?user_id=1&type=daily&days=7', fetcher)

  const stats = insightsData?.stats
  const insights = insightsData?.insights ?? []
  const transactions = txData?.transactions ?? []
  const weekly = weeklyData?.weekly ?? []
  const categories = categoriesData?.categories ?? []
  const daily = dailyData?.daily ?? []

  const totalSpent = stats?.total_spent ?? 0
  const budget = stats?.budget ?? 3200
  const projected = stats?.projected_spend ?? 0
  const budgetUsedPct = stats?.budget_used_pct ?? 0
  const daysRemaining = stats?.days_remaining ?? 0
  const flaggedCount = stats?.flagged_count ?? 0
  const isOverBudget = stats?.is_over_budget ?? false

  // Build chart data from real DB data
  const weeklyChartData = weekly.map((w: { week: string; amount: number }) => ({
    week: w.week,
    amount: Number(w.amount),
    savings: Math.max(0, budget / 4 - Number(w.amount)),
  }))

  const categoryChartData = categories.map((c: { category: string; total: number }) => ({
    name: c.category,
    value: Number(c.total),
  }))

  const dailyChartData = daily.map((d: { day: string; amount: number }) => ({
    day: d.day,
    food: 0, shopping: 0, other: Number(d.amount),
  }))

  const potentialSavings = Math.round(totalSpent * 0.2)
  const behaviorScore = Math.max(30, Math.min(90, 100 - budgetUsedPct * 0.5 - flaggedCount * 5))

  const statCards = [
    {
      label: 'Total Spent',
      value: `$${Number(totalSpent).toLocaleString()}`,
      change: budgetUsedPct > 100 ? 'Over Budget' : `${budgetUsedPct}% used`,
      trend: (budgetUsedPct > 80 ? 'up' : 'down') as 'up' | 'down' | 'neutral',
      sub: `of $${budget} budget`,
      icon: CreditCard,
      color: budgetUsedPct > 80 ? 'text-danger' : 'text-success',
    },
    {
      label: 'Potential Savings',
      value: `$${potentialSavings.toLocaleString()}`,
      change: '-20%',
      trend: 'down' as const,
      sub: 'if you follow tips',
      icon: Target,
      color: 'text-success',
    },
    {
      label: 'Behavior Score',
      value: `${behaviorScore}/100`,
      change: flaggedCount > 3 ? 'Needs work' : '+8pts',
      trend: flaggedCount > 3 ? 'neutral' as const : 'up' as const,
      sub: flaggedCount > 3 ? 'impulse buying detected' : 'improving this month',
      icon: Zap,
      color: 'text-warning',
    },
    {
      label: 'Anomalies Found',
      value: String(flaggedCount),
      change: 'flagged',
      trend: 'neutral' as const,
      sub: `$${Number(stats?.flagged_amount ?? 0).toFixed(0)} in unusual tx`,
      icon: AlertTriangle,
      color: 'text-danger',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingInsights
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
                <div className="h-4 w-16 bg-secondary rounded mb-3" />
                <div className="h-7 w-24 bg-secondary rounded mb-2" />
                <div className="h-3 w-20 bg-secondary rounded" />
              </div>
            ))
          : statCards.map(s => <StatCard key={s.label} {...s} />)
        }
      </div>

      {/* Chart Tabs + Chart */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-foreground">Spending Analytics</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Real data from your transaction history</p>
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
            {(['overview', 'weekly', 'monthly', 'categories'] as DashboardTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium capitalize ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'overview' && <WeeklyAreaChart data={weeklyChartData.length ? weeklyChartData : undefined} />}
        {activeTab === 'weekly' && <StackedWeeklyChart data={dailyChartData.length ? dailyChartData : undefined} />}
        {activeTab === 'monthly' && <MonthlyBarChart data={weeklyChartData.length ? weeklyChartData : undefined} />}
        {activeTab === 'categories' && <CategoryPieChart data={categoryChartData.length ? categoryChartData : undefined} />}
      </div>

      {/* Two column: Transactions + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recent Transactions</h3>
            <span className="text-xs text-muted-foreground">{transactions.length} shown</span>
          </div>
          <div className="space-y-3">
            {loadingTx
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-secondary flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-28 bg-secondary rounded" />
                      <div className="h-2.5 w-20 bg-secondary rounded" />
                    </div>
                    <div className="h-3 w-14 bg-secondary rounded" />
                  </div>
                ))
              : transactions.map((tx: { id: number; merchant: string; category: string; amount: number; date: string; is_flagged: boolean; flag_reason: string | null }) => {
                  const Icon = CATEGORY_ICONS[tx.category] ?? CreditCard
                  const dateStr = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  return (
                    <div key={tx.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{tx.merchant}</p>
                          {tx.is_flagged && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              tx.flag_reason === 'late-night'
                                ? 'bg-orange-500/10 text-orange-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {tx.flag_reason === 'late-night' ? 'Late Night' : tx.flag_reason === 'impulse' ? 'Impulse' : 'Flagged'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{tx.category} · {dateStr}</p>
                      </div>
                      <p className="text-sm font-semibold font-mono text-danger flex-shrink-0">
                        -${Number(tx.amount).toFixed(2)}
                      </p>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* Smart Insight Trigger */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Smart Insights</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary">Auto-detected</span>
            </div>
          </div>
          <SmartInsightTrigger userId={1} />
        </div>
      </div>

      {/* Prediction Bar */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Month-End Prediction</h3>
          </div>
          <span className={`text-xs font-mono font-semibold ${isOverBudget ? 'text-danger' : 'text-success'}`}>
            Projected: ${projected.toLocaleString()} {isOverBudget ? '(over budget)' : '(on track)'}
          </span>
        </div>
        <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
          />
          {isOverBudget && (
            <div className="absolute inset-y-0 left-0 bg-danger rounded-full opacity-30" style={{ width: '100%' }} />
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">$0</span>
          <span className="text-xs text-muted-foreground font-mono">Spent: ${Number(totalSpent).toLocaleString()}</span>
          <span className={`text-xs font-semibold font-mono ${isOverBudget ? 'text-danger' : 'text-muted-foreground'}`}>
            Budget: ${budget.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          {isOverBudget
            ? <>At your current pace, you will exceed your budget by <span className="text-danger font-semibold">${(projected - budget).toLocaleString()}</span>. Reduce Food and Shopping spending for the remaining <span className="font-semibold">{daysRemaining} days</span>.</>
            : <>You are on track to finish within your budget. <span className="text-success font-semibold">${(budget - projected).toLocaleString()}</span> headroom remaining with {daysRemaining} days left.</>
          }
        </p>
      </div>
    </div>
  )
}

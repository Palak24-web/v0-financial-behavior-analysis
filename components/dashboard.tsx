'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, ShoppingBag, Coffee, Plane, CreditCard, BarChart3 } from 'lucide-react'
import { WeeklyAreaChart, MonthlyBarChart, CategoryPieChart, StackedWeeklyChart } from './spending-chart'

const stats = [
  {
    label: 'Total Spent',
    value: '$2,340',
    change: '+12.4%',
    trend: 'up',
    sub: 'vs last month',
    icon: CreditCard,
    color: 'text-danger',
  },
  {
    label: 'Potential Savings',
    value: '$468',
    change: '-20%',
    trend: 'down',
    sub: 'if you follow tips',
    icon: Target,
    color: 'text-success',
  },
  {
    label: 'Behavior Score',
    value: '62/100',
    change: '+8pts',
    trend: 'up',
    sub: 'improving this month',
    icon: Zap,
    color: 'text-warning',
  },
  {
    label: 'Anomalies Found',
    value: '3',
    change: 'flagged',
    trend: 'neutral',
    sub: 'unusual transactions',
    icon: AlertTriangle,
    color: 'text-danger',
  },
]

const recentTransactions = [
  { icon: Coffee, merchant: 'Zomato', category: 'Food', amount: -45.50, date: 'Today, 10:15 PM', flag: 'late-night' },
  { icon: ShoppingBag, merchant: 'Amazon', category: 'Shopping', amount: -89.99, date: 'Yesterday', flag: 'impulse' },
  { icon: Plane, merchant: 'Uber', category: 'Travel', amount: -28.00, date: 'Apr 23', flag: null },
  { icon: Coffee, merchant: 'Swiggy', category: 'Food', amount: -35.00, date: 'Apr 25, 11:45 PM', flag: 'late-night' },
  { icon: CreditCard, merchant: 'Netflix', category: 'Subscription', amount: -12.00, date: 'Apr 27', flag: null },
]

const insights = [
  {
    type: 'warning',
    title: 'Weekend Spending Spike',
    desc: 'You spent 3.2x more on weekends vs weekdays. Saturday alone was $210.',
    action: 'Set a weekend budget',
  },
  {
    type: 'alert',
    title: 'Late Night Food Orders',
    desc: '4 food deliveries placed after 10 PM this week totaling $142. These are often impulse purchases.',
    action: 'Enable spend lock after 10 PM',
  },
  {
    type: 'info',
    title: 'Food Delivery Addiction',
    desc: 'Food accounts for 33% of your total spend. You\'ve ordered delivery 8 times this month.',
    action: 'Try meal prepping this week',
  },
]

type DashboardTab = 'overview' | 'weekly' | 'monthly' | 'categories'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-xl bg-secondary">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  stat.trend === 'up' && stat.label === 'Total Spent'
                    ? 'bg-red-500/10 text-red-400'
                    : stat.trend === 'up'
                    ? 'bg-green-500/10 text-green-400'
                    : stat.trend === 'down'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {stat.trend === 'up' ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : stat.trend === 'down' ? <TrendingDown className="w-3 h-3 inline mr-0.5" /> : null}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{stat.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Chart Tabs + Chart */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-foreground">Spending Analytics</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Track your financial behavior visually</p>
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
        {activeTab === 'overview' && <WeeklyAreaChart />}
        {activeTab === 'weekly' && <StackedWeeklyChart />}
        {activeTab === 'monthly' && <MonthlyBarChart />}
        {activeTab === 'categories' && <CategoryPieChart />}
      </div>

      {/* Two column: Transactions + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recent Transactions</h3>
            <button className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx, i) => {
              const Icon = tx.icon
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{tx.merchant}</p>
                      {tx.flag && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          tx.flag === 'late-night'
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {tx.flag === 'late-night' ? 'Late Night' : 'Impulse'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{tx.category} · {tx.date}</p>
                  </div>
                  <p className="text-sm font-semibold font-mono text-danger flex-shrink-0">{tx.amount}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">AI Behavior Insights</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary">Live Analysis</span>
            </div>
          </div>
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border ${
                  ins.type === 'warning'
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : ins.type === 'alert'
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-blue-500/20 bg-blue-500/5'
                }`}
              >
                <p className={`text-xs font-semibold mb-1 ${
                  ins.type === 'warning' ? 'text-yellow-400' : ins.type === 'alert' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {ins.type === 'warning' ? '⚠ ' : ins.type === 'alert' ? '! ' : 'i '}{ins.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{ins.desc}</p>
                <button className={`text-xs font-medium mt-2 ${
                  ins.type === 'warning' ? 'text-yellow-400' : ins.type === 'alert' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  → {ins.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prediction Bar */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Month-End Prediction</h3>
          </div>
          <span className="text-xs font-mono text-danger font-semibold">Projected: $3,120 (+33%)</span>
        </div>
        <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: '75%' }} />
          <div className="absolute inset-y-0 left-0 bg-danger rounded-full opacity-40" style={{ width: '100%' }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">$0</span>
          <span className="text-xs text-muted-foreground">Current: $2,340</span>
          <span className="text-xs text-danger font-semibold">Limit: $2,400</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          At your current spending pace, you will exceed your monthly budget by <span className="text-danger font-semibold">$720</span>. MoneyMind recommends reducing Food and Shopping by 25% for the remaining 2 days.
        </p>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, TrendingUp, ShoppingCart, Moon, Zap, CheckCircle, X, ChevronRight } from 'lucide-react'

interface SmartInsight {
  id: string
  type: string
  severity: 'info' | 'warning' | 'danger'
  title: string
  message: string
  action: string
  value?: number
  category?: string
}

interface SmartInsightsResponse {
  triggered_count: number
  insights: SmartInsight[]
  snapshot: {
    food_orders_7d: number
    late_night_7d: number
    impulse_7d: number
    total_spent: number
    budget: number
    projected_month_end: number
  }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const TYPE_ICON: Record<string, typeof AlertTriangle> = {
  food_frequency: ShoppingCart,
  late_night: Moon,
  impulse: Zap,
  category_overspend: TrendingUp,
  weekly_spike: TrendingUp,
  budget_pace: AlertTriangle,
  positive: CheckCircle,
}

const SEVERITY_STYLES = {
  danger: {
    banner: 'bg-red-500/10 border-red-500/30',
    icon: 'bg-red-500/15 text-red-400',
    title: 'text-red-400',
    action: 'text-red-300 hover:text-red-200',
    dot: 'bg-red-500',
    badge: 'bg-red-500/20 text-red-300',
  },
  warning: {
    banner: 'bg-yellow-500/10 border-yellow-500/30',
    icon: 'bg-yellow-500/15 text-yellow-400',
    title: 'text-yellow-400',
    action: 'text-yellow-300 hover:text-yellow-200',
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-500/20 text-yellow-300',
  },
  info: {
    banner: 'bg-green-500/10 border-green-500/30',
    icon: 'bg-green-500/15 text-green-400',
    title: 'text-green-400',
    action: 'text-green-300 hover:text-green-200',
    dot: 'bg-green-500',
    badge: 'bg-green-500/20 text-green-300',
  },
}

function InsightCard({
  insight,
  onDismiss,
  expanded,
  onToggle,
}: {
  insight: SmartInsight
  onDismiss: (id: string) => void
  expanded: boolean
  onToggle: (id: string) => void
}) {
  const s = SEVERITY_STYLES[insight.severity]
  const Icon = TYPE_ICON[insight.type] ?? AlertTriangle

  return (
    <div className={`rounded-2xl border p-4 ${s.banner} transition-all duration-200`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl flex-shrink-0 ${s.icon}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={`text-sm font-semibold ${s.title}`}>{insight.title}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${s.badge}`}>
              {insight.severity === 'info' ? 'Positive' : insight.severity}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{insight.message}</p>

          {expanded && (
            <div className={`mt-3 flex items-start gap-1.5 text-xs font-medium ${s.action}`}>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{insight.action}</span>
            </div>
          )}

          <button
            onClick={() => onToggle(insight.id)}
            className={`mt-2 text-xs underline underline-offset-2 ${s.action} transition-colors`}
          >
            {expanded ? 'Hide tip' : 'See what to do'}
          </button>
        </div>

        <button
          onClick={() => onDismiss(insight.id)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function SmartInsightTrigger({ userId = 1 }: { userId?: number }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const { data, isLoading } = useSWR<SmartInsightsResponse>(
    `/api/smart-insights?user_id=${userId}`,
    fetcher,
    {
      refreshInterval: 60_000, // re-check every 60s
      revalidateOnFocus: true,
    }
  )

  // Auto-expand the first danger insight on load
  useEffect(() => {
    if (data?.insights) {
      const firstDanger = data.insights.find((i) => i.severity === 'danger')
      if (firstDanger && !dismissed.has(firstDanger.id)) {
        setExpanded((prev) => new Set([...prev, firstDanger.id]))
      }
    }
  }, [data?.insights, dismissed])

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]))
  }

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-secondary flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-36 bg-secondary rounded" />
                <div className="h-2.5 w-full bg-secondary rounded" />
                <div className="h-2.5 w-4/5 bg-secondary rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const allInsights = data?.insights ?? []
  const visible = allInsights.filter((i) => !dismissed.has(i.id))
  const toShow = showAll ? visible : visible.slice(0, 3)

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-center">
        <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">No alerts right now</p>
        <p className="text-xs text-muted-foreground mt-1">Your spending looks healthy. Keep it up!</p>
      </div>
    )
  }

  const dangerCount = visible.filter((i) => i.severity === 'danger').length
  const warningCount = visible.filter((i) => i.severity === 'warning').length

  return (
    <div className="space-y-3">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-foreground">Smart Insights</span>
          </div>
          {dangerCount > 0 && (
            <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
              {dangerCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
              {warningCount} warning
            </span>
          )}
        </div>
        {visible.length > 3 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-primary hover:opacity-80 transition-opacity"
          >
            {showAll ? 'Show less' : `+${visible.length - 3} more`}
          </button>
        )}
      </div>

      {/* Insight cards */}
      {toShow.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onDismiss={handleDismiss}
          expanded={expanded.has(insight.id)}
          onToggle={handleToggle}
        />
      ))}
    </div>
  )
}

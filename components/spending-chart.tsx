'use client'

import dynamic from 'next/dynamic'

// Lazy-load chart internals to avoid Turbopack chunk-load failures with Recharts ES modules
const ChartInner = dynamic(() => import('./spending-chart-inner'), { ssr: false, loading: () => <ChartSkeleton /> })

function ChartSkeleton() {
  return (
    <div className="w-full h-[200px] rounded-xl bg-secondary animate-pulse flex items-center justify-center">
      <span className="text-xs text-muted-foreground">Loading chart...</span>
    </div>
  )
}

export function WeeklyAreaChart() {
  return <ChartInner type="weekly-area" />
}

export function MonthlyBarChart() {
  return <ChartInner type="monthly-bar" />
}

export function CategoryPieChart() {
  return <ChartInner type="category-pie" />
}

export function StackedWeeklyChart() {
  return <ChartInner type="stacked-weekly" />
}

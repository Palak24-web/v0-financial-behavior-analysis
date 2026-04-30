'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ─── Fallback / seed data (shown while DB data loads) ────────────────────────

const FALLBACK_WEEKLY = [
  { week: 'Apr 07', amount: 520, savings: 280 },
  { week: 'Apr 14', amount: 740, savings: 60 },
  { week: 'Apr 21', amount: 680, savings: 120 },
  { week: 'Apr 28', amount: 1072, savings: 0 },
]

const FALLBACK_DAILY = [
  { day: 'Mon', food: 20, shopping: 12, other: 10 },
  { day: 'Tue', food: 8, shopping: 5, other: 5 },
  { day: 'Wed', food: 35, shopping: 40, other: 10 },
  { day: 'Thu', food: 12, shopping: 7, other: 5 },
  { day: 'Fri', food: 55, shopping: 60, other: 21 },
  { day: 'Sat', food: 80, shopping: 90, other: 40 },
  { day: 'Sun', food: 45, shopping: 30, other: 20 },
]

const FALLBACK_CATEGORIES = [
  { name: 'Shopping', value: 1333, color: '#60a5fa' },
  { name: 'Rent', value: 1200, color: '#4ade80' },
  { name: 'Food & Drink', value: 385, color: '#f59e0b' },
  { name: 'Groceries', value: 304, color: '#a78bfa' },
  { name: 'Subscriptions', value: 140, color: '#f87171' },
  { name: 'Utilities', value: 283, color: '#38bdf8' },
  { name: 'Transport', value: 210, color: '#fb923c' },
]

const COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#f87171', '#38bdf8', '#fb923c']

// ─── Shared Tooltip ───────────────────────────────────────────────────────────

type TooltipEntry = { value: number; color?: string; name?: string }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="font-semibold font-mono" style={{ color: entry.color || '#4ade80' }}>
          {entry.name ? `${entry.name}: ` : ''}${Number(entry.value).toFixed(0)}
        </p>
      ))}
    </div>
  )
}

// ─── Chart Components ─────────────────────────────────────────────────────────

export function WeeklyAreaChart({ data }: { data?: { week: string; amount: number; savings?: number }[] }) {
  const chartData = data && data.length ? data : FALLBACK_WEEKLY
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="amount" name="Spent" stroke="#4ade80" strokeWidth={2} fill="url(#colorAmount)" />
        {chartData.some(d => d.savings !== undefined) && (
          <Area type="monotone" dataKey="savings" name="Headroom" stroke="#60a5fa" strokeWidth={1.5} fill="url(#colorSavings)" strokeDasharray="4 2" />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function MonthlyBarChart({ data }: { data?: { week: string; amount: number }[] }) {
  const chartData = data && data.length ? data : FALLBACK_WEEKLY
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="amount" name="Spent" fill="#4ade80" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryPieChart({ data }: { data?: { name: string; value: number }[] }) {
  const raw = data && data.length ? data : FALLBACK_CATEGORIES
  const chartData = raw.map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }))
  const total = chartData.reduce((s, d) => s + Number(d.value), 0)

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as { name: string; value: number; color: string }
              return (
                <div className="bg-card border border-border rounded-xl p-2 shadow-xl text-xs">
                  <p style={{ color: d.color }} className="font-semibold">{d.name}</p>
                  <p className="text-foreground font-mono">${Number(d.value).toFixed(0)}</p>
                  <p className="text-muted-foreground">{((Number(d.value) / total) * 100).toFixed(1)}%</p>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
        {chartData.map((cat) => (
          <div key={cat.name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-xs text-muted-foreground truncate">{cat.name}</span>
            </div>
            <span className="text-xs font-semibold text-foreground font-mono flex-shrink-0">${Number(cat.value).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StackedWeeklyChart({ data }: { data?: { day: string; food?: number; shopping?: number; other?: number }[] }) {
  const chartData = data && data.length ? data : FALLBACK_DAILY
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
        <Bar dataKey="food" name="Food" stackId="a" fill="#4ade80" />
        <Bar dataKey="shopping" name="Shopping" stackId="a" fill="#60a5fa" />
        <Bar dataKey="other" name="Other" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

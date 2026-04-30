'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

const weeklyData = [
  { day: 'Mon', amount: 42, food: 20, shopping: 12, other: 10 },
  { day: 'Tue', amount: 18, food: 8, shopping: 5, other: 5 },
  { day: 'Wed', amount: 85, food: 35, shopping: 40, other: 10 },
  { day: 'Thu', amount: 24, food: 12, shopping: 7, other: 5 },
  { day: 'Fri', amount: 136, food: 55, shopping: 60, other: 21 },
  { day: 'Sat', amount: 210, food: 80, shopping: 90, other: 40 },
  { day: 'Sun', amount: 95, food: 45, shopping: 30, other: 20 },
]

const monthlyData = [
  { month: 'Nov', amount: 1820 },
  { month: 'Dec', amount: 2450 },
  { month: 'Jan', amount: 1960 },
  { month: 'Feb', amount: 1740 },
  { month: 'Mar', amount: 2100 },
  { month: 'Apr', amount: 2340 },
]

const categoryData = [
  { name: 'Food', value: 461, color: '#4ade80' },
  { name: 'Shopping', value: 439, color: '#60a5fa' },
  { name: 'Bills', value: 200, color: '#f59e0b' },
  { name: 'Travel', value: 128, color: '#a78bfa' },
  { name: 'Subscriptions', value: 122, color: '#f87171' },
]

type TooltipEntry = {
  value: number
  color?: string
  name?: string
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 shadow-xl text-sm">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="font-semibold" style={{ color: entry.color || '#4ade80' }}>
            {entry.name ? `${entry.name}: ` : ''}${entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

type ChartType = 'weekly-area' | 'monthly-bar' | 'category-pie' | 'stacked-weekly'

export default function SpendingChartInner({ type }: { type: ChartType }) {
  if (type === 'weekly-area') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="amount" stroke="#4ade80" strokeWidth={2} fill="url(#colorAmount)" />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'monthly-bar') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="amount" fill="#4ade80" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'category-pie') {
    return (
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={3}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as { name: string; value: number; color: string }
                  return (
                    <div className="bg-surface border border-border rounded-xl p-2 shadow-xl text-xs">
                      <p style={{ color: data.color }} className="font-semibold">{data.name}</p>
                      <p className="text-foreground">${data.value}</p>
                    </div>
                  )
                }
                return null
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2 flex-1">
          {categoryData.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-xs text-muted-foreground">{cat.name}</span>
              </div>
              <span className="text-xs font-semibold text-foreground">${cat.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'stacked-weekly') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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

  return null
}

'use client'

import { useState, useEffect } from 'react'
import { Brain, LayoutDashboard, MessageSquare, Code2, TrendingUp, Shield, Zap, ChevronRight, User, Sparkles, ExternalLink } from 'lucide-react'
import { Dashboard } from '@/components/dashboard'
import { Chatbot } from '@/components/chatbot'
import { DecisionCoach } from '@/components/decision-coach'

type Tab = 'dashboard' | 'chat' | 'api'

// ✅ MOCK USER (NO AUTH REQUIRED)
const DEMO_USER = {
  id: 1,
  name: "Demo User",
  email: "demo@example.com",
  monthly_income: 5000,
  monthly_budget: 3000,
  onboarded: true,
}

const NAV_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'api', label: 'API Docs', icon: Code2 },
]

const FEATURES = [
  { icon: Brain, title: 'Behavior Detection', desc: 'Spots late-night splurges, impulse buys, and category addictions automatically.' },
  { icon: TrendingUp, title: 'Predictive Insights', desc: 'Forecasts month-end spend and flags when you are heading for overrun.' },
  { icon: Shield, title: 'Anomaly Alerts', desc: 'Flags unusual transactions in real-time and explains what triggered the alert.' },
  { icon: Zap, title: 'AI Decision Coach', desc: 'Get a buy / skip / delay verdict before any purchase.' },
]

function ApiDocs() {
  return <div className="text-center text-muted-foreground">API Docs</div>
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  // ✅ REMOVE AUTH — use demo user
  const user = DEMO_USER

  return (
    <div className="min-h-screen bg-background">

      {/* HEADER */}
      <header className="border-b border-border bg-background px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="font-bold">MoneyMind</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm">{user.name}</span>
        </div>
      </header>

      {/* HERO */}
      {activeTab === 'dashboard' && (
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold">
            Welcome, {user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Budget: ${user.monthly_budget} · Income: ${user.monthly_income}
          </p>
        </div>
      )}

      {/* NAV */}
      <div className="flex gap-2 p-4">
        {NAV_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as Tab)}
            className={`px-3 py-2 rounded ${
              activeTab === id ? 'bg-primary text-white' : 'bg-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <main className="p-4">

        {activeTab === 'dashboard' && (
          <Dashboard userId={user.id} />
        )}

        {activeTab === 'chat' && (
          <Chatbot userId={user.id} userName={user.name} />
        )}

        {activeTab === 'api' && <ApiDocs />}
      </main>
    </div>
  )
}
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Sparkles, LayoutDashboard, MessageSquare, Code2, Brain, TrendingUp, Shield, Zap, ChevronRight, ExternalLink, ChevronDown, User } from 'lucide-react'
import { Dashboard } from '@/components/dashboard'
import { Chatbot } from '@/components/chatbot'
import { DecisionCoach } from '@/components/decision-coach'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type AppUser = { id: number; name: string; email: string; monthly_income: string; monthly_budget: string }

function UserSelector({ selected, onChange }: { selected: AppUser | null; onChange: (u: AppUser) => void }) {
  const [open, setOpen] = useState(false)
  const { data } = useSWR<{ users: AppUser[] }>('/api/users', fetcher)
  const users = data?.users ?? []

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-1.5 text-sm hover:border-primary/50 transition-colors"
      >
        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="font-medium text-foreground max-w-[120px] truncate">
          {selected?.name ?? 'Select user'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select User</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => { onChange(u); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/60 transition-colors ${selected?.id === u.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground">Budget ${Number(u.monthly_budget).toLocaleString()}/mo</p>
                  </div>
                  {selected?.id === u.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type Tab = 'dashboard' | 'chat' | 'api'

const NAV_TABS = [
  { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat' as Tab, label: 'AI Chat', icon: MessageSquare },
  { id: 'api' as Tab, label: 'API Docs', icon: Code2 },
]

const FEATURES = [
  {
    icon: Brain,
    title: 'Behavioral Analysis',
    desc: 'Detects impulse buying, late-night spending, and category addictions using advanced LLM reasoning.',
  },
  {
    icon: TrendingUp,
    title: 'Predictive Insights',
    desc: 'Forecasts your month-end spend based on current pace and flags when you are heading for overrun.',
  },
  {
    icon: Shield,
    title: 'Anomaly Detection',
    desc: 'Flags unusual or suspicious transactions in real-time and explains what triggered the alert.',
  },
  {
    icon: Zap,
    title: 'AI Coaching',
    desc: 'Personalized, actionable advice — not generic tips. MoneyMind knows your habits and speaks directly to them.',
  },
]

const API_ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/chat',
    desc: 'Stream a conversation with MoneyMind AI. Supports tool calling for analysis, anomaly detection, predictions, and savings suggestions.',
    body: `{
  "messages": [
    {
      "id": "1",
      "role": "user",
      "parts": [{ "type": "text", "text": "Am I overspending on food?" }]
    }
  ]
}`,
    response: 'text/event-stream (SSE) — streaming AI response with reasoning and tool results',
  },
  {
    method: 'GET',
    path: '/api/analyze',
    desc: 'Get an AI-generated behavioral analysis of sample transaction data. Returns category breakdown, behavior insights, risk level, and savings opportunities.',
    body: null,
    response: `{
  "transactions": [...],
  "summary": { "total": 650.48, "byCategory": {...} },
  "aiInsights": {
    "behaviorInsight": "...",
    "riskLevel": "medium",
    "actionableRecommendation": "...",
    "predictedMonthEnd": 2340,
    "savingOpportunity": 468
  }
}`,
  },
  {
    method: 'POST',
    path: '/api/analyze',
    desc: 'Ask a specific financial question about your spending. Returns a direct, personalized AI answer.',
    body: `{
  "question": "Should I buy a new phone?",
  "transactions": [...]
}`,
    response: `{
  "question": "Should I buy a new phone?",
  "answer": "Based on your current spending pace...",
  "usage": { "promptTokens": 312, "completionTokens": 89 }
}`,
  },
]

function ApiDocs() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">MoneyMind AI — API Reference</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Powered by <span className="text-primary font-medium">GPT-4o Mini</span> via Vercel AI Gateway.
            The chat endpoint uses <span className="text-primary font-medium">streamText</span> with tool calling for agentic financial analysis.
            All endpoints are Next.js App Router Route Handlers.
          </p>
        </div>
      </div>

      {/* Model Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'LLM Model', value: 'GPT-4o Mini' },
          { label: 'Framework', value: 'AI SDK 6' },
          { label: 'Streaming', value: 'SSE / UIMessage' },
          { label: 'Tools', value: '4 Agent Tools' },
        ].map((item) => (
          <div key={item.label} className="bg-surface border border-border rounded-xl p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold text-primary mt-0.5 font-mono">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Endpoints */}
      <div className="space-y-3">
        {API_ENDPOINTS.map((ep, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${
                  ep.method === 'GET'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {ep.method}
                </span>
                <span className="text-sm font-mono text-foreground">{ep.path}</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedIndex === i ? 'rotate-90' : ''}`} />
            </button>

            {expandedIndex === i && (
              <div className="px-4 pb-4 space-y-3 border-t border-border">
                <p className="text-sm text-muted-foreground leading-relaxed pt-3">{ep.desc}</p>

                {ep.body && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Request Body</p>
                    <pre className="bg-background border border-border rounded-xl p-3 text-xs font-mono text-primary overflow-x-auto leading-relaxed">
                      {ep.body}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Response</p>
                  <pre className="bg-background border border-border rounded-xl p-3 text-xs font-mono text-green-400 overflow-x-auto leading-relaxed">
                    {ep.response}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Agent Tools */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-3">Agent Tools (via streamText)</h3>
        <div className="space-y-2">
          {[
            { name: 'analyzeSpending', desc: 'Breaks down transactions by category and generates behavioral insights' },
            { name: 'detectAnomalies', desc: 'Flags unusual transactions, high-value purchases, and late-night spending' },
            { name: 'predictMonthlySpend', desc: 'Forecasts month-end totals based on current daily spending rate' },
            { name: 'getSavingsSuggestions', desc: 'Generates personalized 20% reduction tips per category' },
          ].map((tool) => (
            <div key={tool.name} className="flex items-start gap-3 p-3 bg-background border border-border rounded-xl">
              <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg flex-shrink-0">{tool.name}</code>
              <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const DEFAULT_USER: AppUser = { id: 1, name: 'Alex Morgan', email: 'alex@moneymind.ai', monthly_income: '7500.00', monthly_budget: '3200.00' }

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [selectedUser, setSelectedUser] = useState<AppUser>(DEFAULT_USER)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-foreground text-sm">MoneyMind</span>
              <span className="font-bold text-primary text-sm"> AI</span>
            </div>
            <span className="hidden sm:flex text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium border border-primary/20">
              Agent · GPT-4o
            </span>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
            {NAV_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* User Selector + Status */}
          <div className="flex items-center gap-3">
            <UserSelector selected={selectedUser} onChange={setSelectedUser} />
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              AI Agent Active
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner — only on dashboard */}
      {activeTab === 'dashboard' && (
        <div className="bg-surface border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground text-balance leading-tight">
                  Your AI Financial<br />
                  <span className="text-primary">Behavior Coach</span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed max-w-lg">
                  Analyzing <span className="text-foreground font-medium">{selectedUser.name}</span>&apos;s spending patterns, behavioral habits, and financial decisions — powered by Groq.
                </p>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="flex items-center gap-2 bg-secondary text-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors border border-border"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat with AI
                  </button>
                  <DecisionCoach userId={selectedUser.id} />
                  <button
                    onClick={() => setActiveTab('api')}
                    className="flex items-center gap-2 bg-secondary text-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors border border-border"
                  >
                    <ExternalLink className="w-4 h-4" />
                    API Docs
                  </button>
                </div>
              </div>

              {/* Feature Chips */}
              <div className="grid grid-cols-2 gap-3 max-w-md w-full">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-background border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">{title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard userId={selectedUser.id} />}

        {activeTab === 'chat' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-background border border-border rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
              <Chatbot userId={selectedUser.id} userName={selectedUser.name} />
            </div>
          </div>
        )}

        {activeTab === 'api' && <ApiDocs />}
      </main>
    </div>
  )
}

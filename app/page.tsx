'use client'

import { useState, useEffect } from 'react'
import { Brain, LayoutDashboard, MessageSquare, Code2, TrendingUp, Shield, Zap, ChevronRight, LogOut, User, Sparkles, ExternalLink } from 'lucide-react'
import { Dashboard } from '@/components/dashboard'
import { Chatbot } from '@/components/chatbot'
import { DecisionCoach } from '@/components/decision-coach'

type Tab = 'dashboard' | 'chat' | 'api'

type SessionUser = {
  id: number
  name: string
  email: string
  monthly_income: number
  monthly_budget: number
  onboarded: boolean
}

const NAV_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'api', label: 'API Docs', icon: Code2 },
]

const FEATURES = [
  { icon: Brain, title: 'Behavior Detection', desc: 'Spots late-night splurges, impulse buys, and category addictions automatically.' },
  { icon: TrendingUp, title: 'Predictive Insights', desc: 'Forecasts month-end spend and flags when you are heading for overrun.' },
  { icon: Shield, title: 'Anomaly Alerts', desc: 'Flags unusual transactions in real-time and explains what triggered the alert.' },
  { icon: Zap, title: 'AI Decision Coach', desc: 'Get a buy / skip / delay verdict before any purchase, grounded in your real budget.' },
]

const API_ENDPOINTS = [
  { method: 'POST', path: '/api/chat', desc: 'Stream AI responses with tool-calling for spending analysis.' },
  { method: 'POST', path: '/api/decision', desc: 'Get a buy/skip/delay verdict for a pending purchase.' },
  { method: 'GET', path: '/api/transactions', desc: 'Fetch recent, weekly, category, or daily transaction data.' },
  { method: 'GET', path: '/api/insights', desc: 'Fetch saved behavior insights for a user.' },
  { method: 'GET', path: '/api/smart-insights', desc: 'Auto-detect spending patterns from live data.' },
  { method: 'POST', path: '/api/auth/signup', desc: 'Create a new account with hashed password.' },
  { method: 'POST', path: '/api/auth/signin', desc: 'Sign in and receive a 30-day HTTP-only session cookie.' },
  { method: 'POST', path: '/api/auth/signout', desc: 'Clear the session cookie and log out.' },
  { method: 'GET', path: '/api/auth/session', desc: 'Return the current authenticated user.' },
]

function ApiDocs() {
  const [expanded, setExpanded] = useState<number | null>(0)
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">MoneyMind API Reference</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            All endpoints are Next.js App Router route handlers. Chat uses <span className="text-primary font-medium">streamText</span> with Groq tool-calling. Auth uses HTTP-only JWT cookies.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {API_ENDPOINTS.map((ep, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${ep.method === 'GET' ? 'bg-blue-500/10 text-blue-400' : 'bg-primary/10 text-primary'}`}>
                  {ep.method}
                </span>
                <code className="text-sm font-mono text-foreground">{ep.path}</code>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === i ? 'rotate-90' : ''}`} />
            </button>
            {expanded === i && (
              <div className="px-4 pb-4 border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">{ep.desc}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
          if (!data.user.onboarded) {
            window.location.href = '/onboarding'
          }
        } else {
          window.location.href = '/signin'
        }
      })
      .catch(() => { window.location.href = '/signin' })
      .finally(() => setAuthLoading(false))
  }, [])

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    window.location.href = '/signin'
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading MoneyMind...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-sm hidden sm:block">MoneyMind</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
            {NAV_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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

          {/* User + signout */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-1.5">
              <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground max-w-[90px] truncate">{user.name}</span>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero — dashboard only */}
      {activeTab === 'dashboard' && (
        <div className="bg-surface border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-medium text-primary uppercase tracking-wide">Live Analysis</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight text-balance">
                  Welcome back, {user.name.split(' ')[0]}
                </h1>
                <p className="text-muted-foreground text-sm mt-1.5 max-w-md leading-relaxed">
                  Budget <span className="text-foreground font-medium">${Number(user.monthly_budget).toLocaleString()}/mo</span>
                  {' · '}
                  Income <span className="text-foreground font-medium">${Number(user.monthly_income).toLocaleString()}/mo</span>
                </p>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ask AI
                  </button>
                  <DecisionCoach userId={user.id} />
                  <button
                    onClick={() => setActiveTab('api')}
                    className="flex items-center gap-2 bg-secondary text-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors border border-border"
                  >
                    <ExternalLink className="w-4 h-4" />
                    API Docs
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-background border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-primary" />
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

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard userId={user.id} />}

        {activeTab === 'chat' && (
          <div className="max-w-2xl mx-auto">
            <div
              className="bg-background border border-border rounded-2xl overflow-hidden"
              style={{ height: 'calc(100vh - 200px)' }}
            >
              <Chatbot userId={user.id} userName={user.name} />
            </div>
          </div>
        )}

        {activeTab === 'api' && <ApiDocs />}
      </main>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ShoppingCart, X, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Lightbulb, TrendingUp, DollarSign } from 'lucide-react'

const CATEGORIES = ['Food', 'Shopping', 'Bills', 'Travel', 'Subscriptions', 'Investment', 'Transport', 'Misc']

type Verdict = 'buy' | 'skip' | 'delay'
type RiskLevel = 'low' | 'medium' | 'high'

interface DecisionResult {
  item: string
  amount: number
  category: string
  verdict: Verdict
  risk_level: RiskLevel
  risk_score: number
  headline: string
  reasoning: string
  budget_impact: string
  alternative: string | null
  coaching_tip: string
  context: {
    budget: number
    spent: number
    remaining: string
    projected_month_end: string
    would_exceed_budget: boolean
    flagged_count: number
    category_spend: string
  }
}

const VERDICT_CONFIG = {
  buy: {
    icon: CheckCircle2,
    label: 'Go Ahead',
    bg: 'bg-green-500/10 border-green-500/20',
    text: 'text-green-400',
    badge: 'bg-green-500/15 text-green-400',
  },
  skip: {
    icon: XCircle,
    label: 'Skip It',
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-400',
    badge: 'bg-red-500/15 text-red-400',
  },
  delay: {
    icon: Clock,
    label: 'Delay',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/15 text-yellow-400',
  },
}

const RISK_CONFIG = {
  low: { color: 'text-green-400', bar: 'bg-green-500', label: 'Low Risk' },
  medium: { color: 'text-yellow-400', bar: 'bg-yellow-500', label: 'Medium Risk' },
  high: { color: 'text-red-400', bar: 'bg-red-500', label: 'High Risk' },
}

export function DecisionCoach({ userId = 1 }: { userId?: number }) {
  const [open, setOpen] = useState(false)
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Shopping')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DecisionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setResult(null)
    setError(null)
    setItem('')
    setAmount('')
    setCategory('Shopping')
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 300)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item.trim() || !amount) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: item.trim(),
          amount: parseFloat(amount),
          category,
          user_id: userId,
        }),
      })
      const data = await res.json()
      // Always show result — the route now returns 200 with a valid object even on errors
      if (data.verdict) {
        // Coerce numeric fields to numbers — the API may return them as strings
        setResult({
          ...data,
          amount: Number(data.amount ?? 0),
          risk_score: Number(data.risk_score ?? 50),
          context: {
            ...data.context,
            budget: Number(data.context?.budget ?? 0),
            spent: Number(data.context?.spent ?? 0),
            remaining: String(data.context?.remaining ?? '0'),
            projected_month_end: String(data.context?.projected_month_end ?? '0'),
            would_exceed_budget: Boolean(data.context?.would_exceed_budget),
            flagged_count: Number(data.context?.flagged_count ?? 0),
            category_spend: String(data.context?.category_spend ?? '0'),
          },
        })
      } else {
        throw new Error(data.error ?? 'Could not analyze purchase')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get decision. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Normalize verdict/risk to known keys — API may return unexpected values
  const safeVerdict = (result?.verdict as Verdict) in VERDICT_CONFIG
    ? (result!.verdict as Verdict)
    : 'delay'
  const safeRisk = (result?.risk_level as RiskLevel) in RISK_CONFIG
    ? (result!.risk_level as RiskLevel)
    : 'medium'

  const verdictCfg = result ? VERDICT_CONFIG[safeVerdict] : null
  const riskCfg = result ? RISK_CONFIG[safeRisk] : null

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm"
      >
        <ShoppingCart className="w-4 h-4" />
        Should I Buy This?
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Should I Buy This?</p>
                  <p className="text-xs text-muted-foreground">AI decision coach — powered by your real budget data</p>
                </div>
              </div>
              <button onClick={close} className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {!result ? (
                /* ── Form ── */
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      What do you want to buy?
                    </label>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => setItem(e.target.value)}
                      placeholder="e.g. New iPhone, Air Fryer, Gym membership..."
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                        Amount ($)
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !item.trim() || !amount}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing your budget...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Get AI Decision
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-muted-foreground">
                    Analyzed using your real live spending data
                  </p>
                </form>
              ) : (
                /* ── Result ── */
                <div className="p-5 space-y-4">
                  {/* Verdict Card */}
                  <div className={`border rounded-2xl p-4 ${verdictCfg!.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {(() => { const Icon = verdictCfg!.icon; return <Icon className={`w-5 h-5 ${verdictCfg!.text}`} /> })()}
                        <span className={`text-base font-bold ${verdictCfg!.text}`}>{verdictCfg!.label}</span>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${verdictCfg!.badge}`}>
                        {result.item} · ${Number(result.amount).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{result.headline}</p>
                  </div>

                  {/* Risk Score */}
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Risk Score</span>
                      <span className={`text-xs font-bold ${riskCfg!.color}`}>{riskCfg!.label} · {result.risk_score}/100</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${riskCfg!.bar}`}
                        style={{ width: `${result.risk_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">AI Reasoning</p>
                      <p className="text-sm text-foreground leading-relaxed">{result.reasoning}</p>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex items-start gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground leading-relaxed">{result.budget_impact}</p>
                      </div>
                    </div>
                  </div>

                  {/* Budget Snapshot */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Remaining', value: `$${result.context.remaining}`, warn: parseFloat(result.context.remaining) < 0 },
                      { label: 'In Category', value: `$${result.context.category_spend}`, warn: false },
                      { label: 'Flagged Tx', value: String(result.context.flagged_count), warn: result.context.flagged_count > 3 },
                    ].map((s) => (
                      <div key={s.label} className="bg-surface border border-border rounded-xl p-3 text-center">
                        <p className={`text-sm font-bold font-mono ${s.warn ? 'text-red-400' : 'text-foreground'}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Alternative */}
                  {result.alternative && (
                    <div className="flex items-start gap-2.5 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                      <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-blue-400 mb-0.5">Smarter Alternative</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{result.alternative}</p>
                      </div>
                    </div>
                  )}

                  {/* Coaching Tip */}
                  <div className="flex items-start gap-2.5 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <Lightbulb className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-primary mb-0.5">Coaching Tip</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{result.coaching_tip}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={reset}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors border border-border"
                    >
                      Check Another
                    </button>
                    <button
                      onClick={close}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

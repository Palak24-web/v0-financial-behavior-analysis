'use client'

import { useState, useEffect } from 'react'
import { Brain, DollarSign, Plus, Trash2, ArrowRight, ChevronRight, SkipForward } from 'lucide-react'

const CATEGORIES = ['Food', 'Shopping', 'Bills', 'Travel', 'Subscriptions', 'Investment', 'Transport', 'Misc']

type Transaction = {
  id: string
  merchant: string
  amount: string
  category: string
  note: string
}

const emptyTx = (): Transaction => ({
  id: Math.random().toString(36).slice(2),
  merchant: '', amount: '', category: 'Food', note: '',
})

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [income, setIncome] = useState('')
  const [budget, setBudget] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([emptyTx()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.user?.id) setUserId(d.user.id) })
      .catch(() => {})
  }, [])

  const addTx = () => setTransactions(t => [...t, emptyTx()])
  const removeTx = (id: string) => setTransactions(t => t.filter(tx => tx.id !== id))
  const updateTx = (id: string, field: keyof Transaction, value: string) =>
    setTransactions(t => t.map(tx => tx.id === id ? { ...tx, [field]: value } : tx))

  const submit = async (skipAll: boolean) => {
    setLoading(true)
    setError('')
    try {
      // Re-fetch userId fresh if not yet resolved
      let uid = userId
      if (!uid) {
        const r = await fetch('/api/auth/session', { credentials: 'include' })
        const d = await r.json()
        uid = d.user?.id ?? null
        if (uid) setUserId(uid)
      }

      const validTx = skipAll
        ? []
        : transactions.filter(tx => tx.merchant && tx.amount && parseFloat(tx.amount) > 0)

      const payload = {
        skip: skipAll,
        monthly_income: income || '0',
        monthly_budget: budget || '0',
        transactions: validTx,
        user_id: uid,
      }

      const res = await fetch('/api/auth/onboard', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      window.location.href = '/'
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    if (!income || !budget) { setError('Please fill in both fields'); return }
    setError('')
    setStep(2)
  }

  const handleLaunch = () => submit(false)
  const handleSkip = () => submit(true)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">MoneyMind</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>{s}</div>
              {s < 2 && <div className={`w-16 h-0.5 transition-all ${step > s ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">
            {step === 1 ? 'Financial Profile' : 'Seed Transactions'}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8">

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          {/* ── Step 1: Financial Profile ── */}
          {step === 1 && (
            <div>
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-xl font-bold text-foreground">Set up your financial profile</h2>
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-4 mt-1 flex-shrink-0"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip setup
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                This helps MoneyMind AI coach you based on your real budget.
              </p>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Monthly Income</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="number" min="0" step="100"
                      value={income} onChange={e => setIncome(e.target.value)}
                      placeholder="5000"
                      className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Your total take-home income each month</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Monthly Spending Limit</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="number" min="0" step="100"
                      value={budget} onChange={e => setBudget(e.target.value)}
                      placeholder="3000"
                      className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">How much you want to spend each month</p>
                </div>

                {income && budget && parseFloat(income) > 0 && parseFloat(budget) > 0 && (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                    <p className="text-sm text-foreground font-medium">Savings target</p>
                    <p className="text-2xl font-bold text-primary mt-0.5">
                      ${Math.max(0, parseFloat(income) - parseFloat(budget)).toFixed(0)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.max(0, ((1 - parseFloat(budget) / parseFloat(income)) * 100)).toFixed(0)}% savings rate
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleContinue}
                className="w-full mt-6 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Seed Transactions ── */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-foreground">Add your recent spending</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Optional — add a few transactions so AI can analyze your habits right away.
              </p>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {transactions.map((tx, i) => (
                  <div key={tx.id} className="bg-background border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Transaction {i + 1}</span>
                      {transactions.length > 1 && (
                        <button onClick={() => removeTx(tx.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Merchant (e.g. Zomato)"
                        value={tx.merchant}
                        onChange={e => updateTx(tx.id, 'merchant', e.target.value)}
                        className="col-span-2 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                      />
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                        <input
                          type="number" placeholder="Amount" value={tx.amount}
                          onChange={e => updateTx(tx.id, 'amount', e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg pl-6 pr-2 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <select
                        value={tx.category}
                        onChange={e => updateTx(tx.id, 'category', e.target.value)}
                        className="bg-surface border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      >
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input
                        placeholder="Note (optional)" value={tx.note}
                        onChange={e => updateTx(tx.id, 'note', e.target.value)}
                        className="col-span-2 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addTx}
                className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 rounded-xl py-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add another transaction
              </button>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-secondary text-foreground border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  ) : (
                    <>Launch Dashboard <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>

              <button
                onClick={handleSkip}
                disabled={loading}
                className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 border border-transparent hover:border-border rounded-xl"
              >
                <SkipForward className="w-4 h-4" />
                Skip — go to dashboard without adding transactions
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can always update your data from the dashboard settings.
        </p>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  Brain,
  DollarSign,
  Plus,
  Trash2,
  ArrowRight,
  ChevronRight,
  SkipForward
} from 'lucide-react'

const CATEGORIES = [
  'Food',
  'Shopping',
  'Bills',
  'Travel',
  'Subscriptions',
  'Investment',
  'Transport',
  'Misc'
]

type Transaction = {
  id: string
  merchant: string
  amount: string
  category: string
  note: string
}

const emptyTx = (): Transaction => ({
  id: Math.random().toString(36).slice(2),
  merchant: '',
  amount: '',
  category: 'Food',
  note: ''
})

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [income, setIncome] = useState('')
  const [budget, setBudget] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([emptyTx()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Add transaction
  const addTx = () => setTransactions(t => [...t, emptyTx()])

  // Remove transaction
  const removeTx = (id: string) =>
    setTransactions(t => t.filter(tx => tx.id !== id))

  // Update transaction
  const updateTx = (id: string, field: keyof Transaction, value: string) =>
    setTransactions(t =>
      t.map(tx => (tx.id === id ? { ...tx, [field]: value } : tx))
    )

  // Save locally (no backend dependency)
  const saveData = (skipAll: boolean) => {
    const validTx = skipAll
      ? []
      : transactions.filter(
          tx => tx.merchant && tx.amount && parseFloat(tx.amount) > 0
        )

    const payload = {
      monthly_income: income || '0',
      monthly_budget: budget || '0',
      transactions: validTx
    }

    localStorage.setItem('moneymind_data', JSON.stringify(payload))
  }

  const handleContinue = () => {
    if (!income || !budget) {
      setError('Please fill in both fields')
      return
    }
    setError('')
    setStep(2)
  }

  const handleLaunch = () => {
    saveData(false)
    window.location.href = '/'
  }

  const handleSkip = () => {
    saveData(true)
    window.location.href = '/'
  }

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
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {s}
              </div>
              {s < 2 && (
                <div
                  className={`w-16 h-0.5 ${
                    step > s ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
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

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-xl font-bold text-foreground">
                  Set up your financial profile
                </h2>
                <button
                  onClick={handleSkip}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip setup
                </button>
              </div>

              <div className="space-y-5 mt-4">
                <input
                  type="number"
                  placeholder="Monthly Income"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  className="w-full border p-2 rounded"
                />

                <input
                  type="number"
                  placeholder="Monthly Budget"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>

              <button
                onClick={handleContinue}
                className="w-full mt-6 bg-primary text-white py-2 rounded"
              >
                Continue
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-4">
                Add your recent spending
              </h2>

              {transactions.map(tx => (
                <div key={tx.id} className="mb-3 border p-2 rounded">
                  <input
                    placeholder="Merchant"
                    value={tx.merchant}
                    onChange={e =>
                      updateTx(tx.id, 'merchant', e.target.value)
                    }
                    className="w-full mb-2"
                  />
                  <input
                    placeholder="Amount"
                    value={tx.amount}
                    onChange={e =>
                      updateTx(tx.id, 'amount', e.target.value)
                    }
                    className="w-full mb-2"
                  />
                </div>
              ))}

              <button onClick={addTx} className="text-sm mb-4">
                + Add transaction
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border py-2 rounded"
                >
                  Back
                </button>

                <button
                  onClick={handleLaunch}
                  className="flex-1 bg-primary text-white py-2 rounded"
                >
                  Launch Dashboard
                </button>
              </div>

              <button
                onClick={handleSkip}
                className="w-full mt-3 text-sm text-gray-400"
              >
                Skip — go to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
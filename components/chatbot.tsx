'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, Sparkles, User, Bot, TrendingUp, ShoppingBag, AlertCircle, Lightbulb, RefreshCw } from 'lucide-react'

const QUICK_PROMPTS = [
  { icon: TrendingUp, text: 'Where did I spend the most this month?' },
  { icon: AlertCircle, text: 'Am I overspending on food delivery?' },
  { icon: ShoppingBag, text: 'Should I buy a new laptop now?' },
  { icon: Lightbulb, text: 'How can I save $200 this month?' },
]

const WELCOME_MESSAGE = `Hi! I'm **MoneyMind AI**, your intelligent financial behavior coach.

I can help you:
- Analyze your spending patterns and habits
- Detect unusual or impulsive purchases
- Predict your month-end expenses
- Give you personalized savings advice

What would you like to explore today?`

function MarkdownText({ text }: { text: string }) {
  // Simple markdown: bold, line breaks
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part === '\n') return <br key={i} />
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MessageBubble({
  role,
  parts,
}: {
  role: 'user' | 'assistant'
  parts: Array<{ type: string; text?: string }>
}) {
  const text = parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')

  // Still streaming or tool-only step — don't render empty bubble
  if (!text.trim()) return null


  const isUser = role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-primary' : 'bg-secondary border border-border'
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-primary-foreground" />
          : <Bot className="w-4 h-4 text-primary" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-surface border border-border text-foreground rounded-tl-sm'
      }`}>
        <MarkdownText text={text} />
      </div>
    </div>
  )
}

const TOOL_LABELS: Record<string, string> = {
  getTransactions: 'Fetching your transactions...',
  getMonthlySummary: 'Loading monthly summary...',
  getWeeklyTrend: 'Analyzing weekly trend...',
  getDailyPattern: 'Reading daily habits...',
  detectBehavior: 'Detecting spending patterns...',
  getSpendingScore: 'Calculating your score...',
  decisionCoach: 'Evaluating purchase...',
  getBehaviorInsights: 'Loading insights...',
  getUserProfile: 'Loading your profile...',
  logTransaction: 'Saving transaction...',
  saveInsight: 'Saving insight...',
}

function ToolCallBubble({ toolName }: { toolName: string }) {
  const label = TOOL_LABELS[toolName] ?? `Running ${toolName}...`
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-surface border border-primary/20 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

export function Chatbot({ userId = 1, userName = 'User' }: { userId?: number; userName?: string }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `chat-user-${userId}`,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: { id, messages: msgs, user_id: userId },
      }),
    }),
  })

  // Reset chat when userId changes
  useEffect(() => {
    setMessages([])
    setInput('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    sendMessage({ text: trimmed })
    setInput('')
  }

  const handleQuickPrompt = (text: string) => {
    if (isLoading) return
    sendMessage({ text })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">MoneyMind AI</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">
                {isLoading ? 'Thinking...' : `Analyzing ${userName}'s finances`}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setMessages([])}
          className="p-2 rounded-xl hover:bg-secondary transition-colors"
          title="Clear chat"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome message */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-surface border border-border text-foreground">
            <MarkdownText text={WELCOME_MESSAGE} />
          </div>
        </div>

        {messages.map((message) => {
          const parts = message.parts as Array<{ type: string; text?: string; toolName?: string; state?: string }>
          // Show active tool calls as inline spinners
          const activeTools = parts.filter(
            (p) => p.type === 'tool-invocation' && (p.state === 'input-streaming' || p.state === 'input-available')
          )
          return (
            <div key={message.id}>
              <MessageBubble role={message.role as 'user' | 'assistant'} parts={parts} />
              {activeTools.map((p, i) => (
                <ToolCallBubble key={i} toolName={p.toolName ?? ''} />
              ))}
            </div>
          )
        })}

        {isLoading && status === 'submitted' && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts — show only when no messages */}
      {messages.length === 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground mb-2 px-1">Quick questions:</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map(({ icon: Icon, text }) => (
              <button
                key={text}
                onClick={() => handleQuickPrompt(text)}
                className="flex items-start gap-2 p-3 rounded-xl bg-surface border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
              >
                <Icon className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground leading-relaxed">{text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl p-2 focus-within:border-primary/50 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your spending..."
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none px-2 py-1.5 max-h-32 leading-relaxed"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground/50 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}

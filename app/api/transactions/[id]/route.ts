import { NextRequest, NextResponse } from 'next/server'
import { getTransaction, updateTransaction, deleteTransaction } from '@/lib/db'
import { z } from 'zod'

const UpdateTransactionSchema = z.object({
  amount: z.number().positive().optional(),
  merchant: z.string().min(1).max(200).optional(),
  category: z.enum([
    'Rent', 'Groceries', 'Subscriptions', 'Shopping', 'Utilities',
    'Food & Drink', 'Transport', 'Travel', 'Entertainment', 'Health',
    'Investment', 'Misc',
  ]).optional(),
  date: z.string().datetime().optional(),
  note: z.string().max(500).nullable().optional(),
  is_flagged: z.boolean().optional(),
  flag_reason: z.enum(['late-night', 'impulse', 'unusual', 'large']).nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

// GET /api/transactions/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const txId = parseInt(id, 10)

    if (isNaN(txId)) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
    }

    const transaction = await getTransaction(txId)
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('[GET /api/transactions/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}

// PATCH /api/transactions/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const txId = parseInt(id, 10)

    if (isNaN(txId)) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = UpdateTransactionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await getTransaction(txId)
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction = await updateTransaction(txId, parsed.data)
    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('[PATCH /api/transactions/[id]]', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}

// DELETE /api/transactions/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const txId = parseInt(id, 10)

    if (isNaN(txId)) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
    }

    const existing = await getTransaction(txId)
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    await deleteTransaction(txId)
    return NextResponse.json({ message: `Transaction ${txId} deleted successfully` })
  } catch (error) {
    console.error('[DELETE /api/transactions/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}

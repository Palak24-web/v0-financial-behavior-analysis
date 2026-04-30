import { NextRequest, NextResponse } from 'next/server'
import { getBehaviorInsight, updateBehaviorInsight, deleteBehaviorInsight } from '@/lib/db'
import { z } from 'zod'

const UpdateInsightSchema = z.object({
  type: z.enum(['pattern', 'anomaly', 'trend', 'forecast', 'positive']).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  action: z.string().max(500).nullable().optional(),
  severity: z.enum(['info', 'warning', 'danger']).optional(),
})

type Params = { params: Promise<{ id: string }> }

// GET /api/insights/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const insightId = parseInt(id, 10)

    if (isNaN(insightId)) {
      return NextResponse.json({ error: 'Invalid insight ID' }, { status: 400 })
    }

    const insight = await getBehaviorInsight(insightId)
    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    return NextResponse.json({ insight })
  } catch (error) {
    console.error('[GET /api/insights/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch insight' }, { status: 500 })
  }
}

// PATCH /api/insights/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const insightId = parseInt(id, 10)

    if (isNaN(insightId)) {
      return NextResponse.json({ error: 'Invalid insight ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = UpdateInsightSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await getBehaviorInsight(insightId)
    if (!existing) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    const insight = await updateBehaviorInsight(insightId, parsed.data)
    return NextResponse.json({ insight })
  } catch (error) {
    console.error('[PATCH /api/insights/[id]]', error)
    return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 })
  }
}

// DELETE /api/insights/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const insightId = parseInt(id, 10)

    if (isNaN(insightId)) {
      return NextResponse.json({ error: 'Invalid insight ID' }, { status: 400 })
    }

    const existing = await getBehaviorInsight(insightId)
    if (!existing) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    await deleteBehaviorInsight(insightId)
    return NextResponse.json({ message: `Insight ${insightId} deleted successfully` })
  } catch (error) {
    console.error('[DELETE /api/insights/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete insight' }, { status: 500 })
  }
}

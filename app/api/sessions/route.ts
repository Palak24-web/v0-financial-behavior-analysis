import { NextRequest, NextResponse } from 'next/server'
import { getChatSessions, createChatSession } from '@/lib/db'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  user_id: z.number().int().positive(),
  title: z.string().max(200).nullable().optional(),
})

// GET /api/sessions?user_id=1
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userIdParam = searchParams.get('user_id')

    if (!userIdParam) {
      return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 })
    }

    const userId = parseInt(userIdParam, 10)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'user_id must be a valid integer' }, { status: 400 })
    }

    const sessions = await getChatSessions(userId)
    return NextResponse.json({ sessions, count: sessions.length })
  } catch (error) {
    console.error('[GET /api/sessions]', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

// POST /api/sessions - create a new chat session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const session = await createChatSession(parsed.data.user_id, parsed.data.title ?? undefined)
    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sessions]', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

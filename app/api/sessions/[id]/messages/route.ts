import { NextRequest, NextResponse } from 'next/server'
import { getChatSession, getChatMessages, saveChatMessage } from '@/lib/db'
import { z } from 'zod'

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Content cannot be empty').max(10000),
})

type Params = { params: Promise<{ id: string }> }

// GET /api/sessions/[id]/messages - get all messages for a session
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)

    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const session = await getChatSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const messages = await getChatMessages(sessionId)
    return NextResponse.json({ messages, count: messages.length, session_id: sessionId })
  } catch (error) {
    console.error('[GET /api/sessions/[id]/messages]', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST /api/sessions/[id]/messages - add a message to a session
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)

    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const session = await getChatSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = AddMessageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const message = await saveChatMessage(sessionId, parsed.data.role, parsed.data.content)
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sessions/[id]/messages]', error)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }
}

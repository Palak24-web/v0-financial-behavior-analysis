import { NextRequest, NextResponse } from 'next/server'
import {
  getChatSession,
  getChatMessages,
  updateChatSessionTitle,
  deleteChatSession,
} from '@/lib/db'
import { z } from 'zod'

const UpdateSessionSchema = z.object({
  title: z.string().min(1).max(200),
})

type Params = { params: Promise<{ id: string }> }

// GET /api/sessions/[id] - get session with messages
export async function GET(req: NextRequest, { params }: Params) {
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

    const { searchParams } = new URL(req.url)
    const includeMessages = searchParams.get('include') === 'messages'

    if (includeMessages) {
      const messages = await getChatMessages(sessionId)
      return NextResponse.json({ session, messages, message_count: messages.length })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('[GET /api/sessions/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

// PATCH /api/sessions/[id] - update session title
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)

    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = UpdateSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await getChatSession(sessionId)
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = await updateChatSessionTitle(sessionId, parsed.data.title)
    return NextResponse.json({ session })
  } catch (error) {
    console.error('[PATCH /api/sessions/[id]]', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

// DELETE /api/sessions/[id] - delete session and all its messages
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)

    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    const existing = await getChatSession(sessionId)
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await deleteChatSession(sessionId)
    return NextResponse.json({ message: `Session ${sessionId} and all its messages deleted successfully` })
  } catch (error) {
    console.error('[DELETE /api/sessions/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}

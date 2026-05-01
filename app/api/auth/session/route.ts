import { NextResponse } from 'next/server'
import { getSession, getUserFromDb } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null }, { status: 401 })
  // Always re-read from DB so onboarded/budget values are never stale
  const user = await getUserFromDb(session.id)
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user })
}

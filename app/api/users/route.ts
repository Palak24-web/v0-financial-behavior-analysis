import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, createUser, getUserByEmail } from '@/lib/db'
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  monthly_income: z.number().positive('Monthly income must be positive'),
  monthly_budget: z.number().positive('Monthly budget must be positive'),
})

// GET /api/users - list all users
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (email) {
      const user = await getUserByEmail(email)
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      return NextResponse.json({ user })
    }

    const users = await getAllUsers()
    return NextResponse.json({ users, count: users.length })
  } catch (error) {
    console.error('[GET /api/users]', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST /api/users - create a new user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Check for duplicate email
    const existing = await getUserByEmail(parsed.data.email)
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }

    const user = await createUser(parsed.data)
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/users]', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { neon } from '@neondatabase/serverless'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'moneymind-super-secret-key-change-in-prod'
)
const COOKIE = 'mm_session'

export type SessionUser = {
  id: number
  name: string
  email: string
  monthly_income: number
  monthly_budget: number
  onboarded: boolean
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET)
  return token
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return (payload as { user: SessionUser }).user
  } catch {
    return null
  }
}

export async function getUserFromDb(id: number): Promise<SessionUser | null> {
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`
    SELECT id, name, email, monthly_income, monthly_budget, onboarded
    FROM users WHERE id = ${id}
  `
  if (!rows[0]) return null
  return {
    id: rows[0].id,
    name: rows[0].name,
    email: rows[0].email,
    monthly_income: Number(rows[0].monthly_income),
    monthly_budget: Number(rows[0].monthly_budget),
    onboarded: Boolean(rows[0].onboarded),
  }
}

export const SESSION_COOKIE = COOKIE

import { NextRequest, NextResponse } from 'next/server'
import {
  getAdminOverview,
  getAdminCategoryStats,
  getAdminUserLeaderboard,
  getAdminFlaggedReport,
  getAdminSpendingTrend,
} from '@/lib/db'

// GET /api/admin
// Query params:
//   view=overview|categories|leaderboard|flagged|trend  (default: overview)
//   days=30   (for trend view)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'overview'
    const days = parseInt(searchParams.get('days') ?? '30', 10)

    switch (view) {
      case 'overview': {
        const data = await getAdminOverview()
        return NextResponse.json(data)
      }

      case 'categories': {
        const categories = await getAdminCategoryStats()
        return NextResponse.json({ categories })
      }

      case 'leaderboard': {
        const users = await getAdminUserLeaderboard()
        return NextResponse.json({ users, count: users.length })
      }

      case 'flagged': {
        const flagged = await getAdminFlaggedReport()
        return NextResponse.json({ flagged, count: flagged.length })
      }

      case 'trend': {
        const trend = await getAdminSpendingTrend(days)
        return NextResponse.json({ trend, days })
      }

      case 'full': {
        // Return all analytics in a single request
        const [overview, categories, leaderboard, flagged, trend] = await Promise.all([
          getAdminOverview(),
          getAdminCategoryStats(),
          getAdminUserLeaderboard(),
          getAdminFlaggedReport(),
          getAdminSpendingTrend(days),
        ])
        return NextResponse.json({
          overview,
          categories,
          leaderboard,
          flagged,
          trend,
          days,
          generated_at: new Date().toISOString(),
        })
      }

      default:
        return NextResponse.json(
          { error: `Invalid view "${view}". Valid views: overview, categories, leaderboard, flagged, trend, full` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[GET /api/admin]', error)
    return NextResponse.json({ error: 'Failed to fetch admin analytics' }, { status: 500 })
  }
}

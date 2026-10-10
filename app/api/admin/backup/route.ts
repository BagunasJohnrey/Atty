import { NextResponse } from "next/server"
import { backupAllToSheets } from "@/integration/backup"
import { requireAdmin } from "@/lib/auth/dal"
import { HttpError, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

/**
 * Neon → Sheets backup trigger (events + attendance only).
 *
 * POST is the manual admin button (session gate, like every other BFF
 * route). GET is the nightly Vercel cron, guarded by a shared secret
 * instead of a session — cron has no cookies. An unset CRON_SECRET fails
 * closed so the endpoint can never run unauthenticated by misconfiguration.
 */
function checkCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new HttpError(401, "UNAUTHORIZED", "Authentication required.")
  }
}

export async function POST() {
  return respondWith(async () => {
    await requireAdmin()
    const summary = await backupAllToSheets()
    return NextResponse.json({
      success: true,
      message: "Sheets backup complete.",
      summary,
    })
  })
}

export async function GET(request: Request) {
  return respondWith(async () => {
    checkCronSecret(request)
    const summary = await backupAllToSheets()
    return NextResponse.json({
      success: true,
      message: "Sheets backup complete.",
      summary,
    })
  })
}

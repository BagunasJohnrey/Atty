import { NextResponse } from "next/server"
import { getAttendanceReport } from "@/integration/reports"
import { respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type ReportParams = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, context: ReportParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const report = await getAttendanceReport(eventId)
    return NextResponse.json({ success: true, report })
  })
}

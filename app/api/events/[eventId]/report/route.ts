import { getAttendanceReportCachedFor } from "@/integration/cached"
import { requireAdmin } from "@/lib/auth/dal"
import { cachedJson, respondWith } from "@/lib/api"
import { parseReportFilters } from "@/lib/reports/filters"

export const dynamic = "force-dynamic"

type ReportParams = { params: Promise<{ eventId: string }> }

export async function GET(request: Request, context: ReportParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const filters = parseReportFilters(new URL(request.url).searchParams)
    const report = await getAttendanceReportCachedFor(eventId, filters)
    return cachedJson({ success: true, report }, 15)
  })
}

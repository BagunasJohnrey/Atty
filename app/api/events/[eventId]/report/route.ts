import { getAttendanceReport } from "@/integration/reports"
import { cachedJson, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type ReportParams = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, context: ReportParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const report = await getAttendanceReport(eventId)
    return cachedJson({ success: true, report }, 15)
  })
}

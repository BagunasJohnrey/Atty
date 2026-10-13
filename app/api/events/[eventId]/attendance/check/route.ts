import { NextResponse } from "next/server"
import { checkAttendance } from "@/integration/attendance"
import { getEventCachedFor } from "@/integration/cached"
import { requireAdmin } from "@/lib/auth/dal"
import { HttpError, parseJsonBody, requireString, respondWith } from "@/lib/api"
import { isDayWithinEvent, outsideEventDatesMessage } from "@/lib/events"
import { manilaDayKey } from "@/lib/format"

export const dynamic = "force-dynamic"

type CheckParams = { params: Promise<{ eventId: string }> }

export async function POST(request: Request, context: CheckParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const body = await parseJsonBody(request)
    const srcode = requireString(body, "srcode", 20)
    // Validate against today's date up front so the kiosk refuses a scan
    // outside the event's dates instead of failing later on confirm.
    const event = await getEventCachedFor(eventId)
    if (!isDayWithinEvent(event.date, manilaDayKey(Date.now()))) {
      throw new HttpError(
        409,
        "EVENT_DATE_CLOSED",
        outsideEventDatesMessage(event)
      )
    }
    const check = await checkAttendance(eventId, srcode)
    return NextResponse.json({ success: true, check })
  })
}

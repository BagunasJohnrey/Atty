import { NextResponse } from "next/server"
import { getAttendance, recordAttendance } from "@/integration/attendance"
import { parseJsonBody, requireString, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type AttendanceParams = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, context: AttendanceParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const attendance = await getAttendance(eventId)
    return NextResponse.json({ success: true, attendance })
  })
}

export async function POST(request: Request, context: AttendanceParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const body = await parseJsonBody(request)
    const srcode = requireString(body, "srcode")
    const recorded = await recordAttendance(eventId, srcode)
    return NextResponse.json(
      {
        success: true,
        message: "Attendance recorded successfully.",
        ...recorded,
      },
      { status: 201 }
    )
  })
}

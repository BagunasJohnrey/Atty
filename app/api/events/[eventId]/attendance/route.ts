import { NextResponse } from "next/server"
import { getAttendance, recordAttendance } from "@/integration/attendance"
import { filterAttendance, parseAttendanceFilters } from "@/lib/attendance"
import { parseJsonBody, requireString, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type AttendanceParams = { params: Promise<{ eventId: string }> }

export async function GET(request: Request, context: AttendanceParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const filters = parseAttendanceFilters(
      new URL(request.url).searchParams
    )
    const attendance = filterAttendance(await getAttendance(eventId), filters)
    return NextResponse.json({ success: true, attendance, total: attendance.length })
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

import type { AttendanceReport } from "@/models/report"
import { requestAppsScript } from "./http"

export async function getAttendanceReport(
  eventId: string
): Promise<AttendanceReport> {
  const response = await requestAppsScript<{ report: AttendanceReport }>(
    "getAttendanceReport",
    {
      eventId,
    }
  )
  return response.report
}

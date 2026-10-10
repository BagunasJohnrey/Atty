import type { AttendanceReport } from "@/models/report"
import { requestAppsScript } from "./http"
import { getAttendanceReportNeon } from "./neon"

/** Cutover flag shared with attendance: `neon` serves the report from Neon;
 *  anything else (or unset) keeps the Apps Script path. */
function isNeonAttendanceEnabled(): boolean {
  return process.env.NEON_ATTENDANCE === "neon"
}

export async function getAttendanceReport(
  eventId: string
): Promise<AttendanceReport> {
  if (isNeonAttendanceEnabled()) return getAttendanceReportNeon(eventId)
  const response = await requestAppsScript<{ report: AttendanceReport }>(
    "getAttendanceReport",
    {
      eventId,
    }
  )
  return response.report
}

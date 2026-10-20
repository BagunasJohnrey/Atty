import type { AttendanceReport } from "@/models/report"
import {
  normalizeReportFilters,
  type ReportFilters,
} from "@/lib/reports/filters"
import { requestAppsScript } from "./http"
import { getAttendanceReportNeon } from "./neon"

/** Cutover flag shared with attendance: `neon` serves the report from Neon;
 *  anything else (or unset) keeps the Apps Script path. */
function isNeonAttendanceEnabled(): boolean {
  return process.env.NEON_ATTENDANCE === "neon"
}

export async function getAttendanceReport(
  eventId: string,
  filters?: ReportFilters
): Promise<AttendanceReport> {
  const normalized = normalizeReportFilters(filters)
  if (isNeonAttendanceEnabled()) {
    return getAttendanceReportNeon(eventId, normalized)
  }
  const body: Record<string, string> = { eventId }
  if (normalized.college) body.college = normalized.college
  if (normalized.program) body.program = normalized.program
  if (normalized.yearLevel) body.yearLevel = normalized.yearLevel
  if (normalized.gender) body.gender = normalized.gender
  const response = await requestAppsScript<{ report: AttendanceReport }>(
    "getAttendanceReport",
    body
  )
  return response.report
}

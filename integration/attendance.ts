import type {
  AttendanceCheck,
  AttendanceRecord,
  RecordedAttendance,
} from "@/models/attendance"
import { requestAppsScript } from "./http"

export async function recordAttendance(
  eventId: string,
  srcode: string
): Promise<RecordedAttendance> {
  const response = await requestAppsScript<RecordedAttendance>(
    "recordAttendance",
    {
      eventId,
      srcode,
    }
  )
  return response
}

export async function checkAttendance(
  eventId: string,
  srcode: string
): Promise<AttendanceCheck> {
  const response = await requestAppsScript<{ check: AttendanceCheck }>(
    "checkAttendance",
    {
      eventId,
      srcode,
    }
  )
  return response.check
}

export async function getAttendance(
  eventId: string
): Promise<AttendanceRecord[]> {
  const response = await requestAppsScript<{ attendance: AttendanceRecord[] }>(
    "getAttendance",
    {
      eventId,
    }
  )
  return response.attendance
}

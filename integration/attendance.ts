import type {
  AttendanceCheck,
  AttendanceRecord,
  RecordedAttendance,
} from "@/models/attendance"
import { requestAppsScript } from "./http"
import {
  checkAttendanceNeon,
  listAttendanceNeon,
  recordAttendanceNeon,
} from "./neon"

/** Cutover flag: `neon` serves attendance from Neon; anything else (or
 *  unset) keeps the Apps Script path. Fail-safe defaults to legacy. Reads,
 *  validation, and writes move together — validation must see the same
 *  store that writes land in, or duplicates slip through. */
function isNeonAttendanceEnabled(): boolean {
  return process.env.NEON_ATTENDANCE === "neon"
}

export async function recordAttendance(
  eventId: string,
  srcode: string,
  /** Device ms epoch for offline replays; omitted by the live kiosk. */
  scannedAt?: number
): Promise<RecordedAttendance> {
  if (isNeonAttendanceEnabled())
    return recordAttendanceNeon(eventId, srcode, scannedAt)
  const response = await requestAppsScript<RecordedAttendance>(
    "recordAttendance",
    scannedAt === undefined
      ? {
          eventId,
          srcode,
        }
      : {
          eventId,
          srcode,
          scannedAt,
        }
  )
  return response
}

export async function checkAttendance(
  eventId: string,
  srcode: string
): Promise<AttendanceCheck> {
  if (isNeonAttendanceEnabled()) return checkAttendanceNeon(eventId, srcode)
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
  if (isNeonAttendanceEnabled()) return listAttendanceNeon(eventId)
  const response = await requestAppsScript<{ attendance: AttendanceRecord[] }>(
    "getAttendance",
    {
      eventId,
    }
  )
  return response.attendance
}

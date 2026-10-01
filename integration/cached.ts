import { unstable_cache } from "next/cache"
import { getAttendance } from "./attendance"
import { getEvent, getEvents } from "./events"
import { getAttendanceReport } from "./reports"
import type { AttendanceRecord } from "@/models/attendance"
import type { AttendanceReport } from "@/models/report"
import type { SchoolEvent } from "@/models/event"

/**
 * Persistent read cache for Apps Script reads.
 *
 * `integration/http.ts` holds a per-instance Map that dedupes concurrent
 * reads and honours short TTLs, but it is discarded on every deploy and
 * does nothing across serverless instances. This layer sits above it and
 * persists entries across requests, instances, and deployments, so a cold
 * start no longer pays an Apps Script roundtrip for data that has not
 * changed.
 *
 * Freshness is bounded twice over: a `revalidate` window matches the
 * in-process TTLs, and every mutation expires the affected tags outright.
 */

export const EVENTS_TAG = "appsscript:events"

export function eventTag(eventId: string): string {
  return `appsscript:event:${eventId}`
}

export function attendanceTag(eventId: string): string {
  return `appsscript:attendance:${eventId}`
}

export function reportTag(eventId: string): string {
  return `appsscript:report:${eventId}`
}

export const getEventsCached = unstable_cache(getEvents, ["appsscript", "getEvents"], {
  tags: [EVENTS_TAG],
  revalidate: 30,
})

export const getEventCached = unstable_cache(getEvent, ["appsscript", "getEvent"], {
  tags: [EVENTS_TAG],
  revalidate: 30,
})

export const getAttendanceCached = unstable_cache(
  getAttendance,
  ["appsscript", "getAttendance"],
  { revalidate: 10 }
)

export const getAttendanceReportCached = unstable_cache(
  getAttendanceReport,
  ["appsscript", "getAttendanceReport"],
  { revalidate: 15 }
)

/**
 * Per-event wrappers that also carry the event-scoped tag, so recording
 * attendance or editing an event expires exactly the reads that mention
 * that event rather than every cached read.
 */
export function getEventCachedFor(eventId: string): Promise<SchoolEvent> {
  return unstable_cache(getEvent, ["appsscript", "getEvent", eventId], {
    tags: [EVENTS_TAG, eventTag(eventId)],
    revalidate: 30,
  })(eventId)
}

export function getAttendanceCachedFor(
  eventId: string
): Promise<AttendanceRecord[]> {
  return unstable_cache(getAttendance, ["appsscript", "getAttendance", eventId], {
    tags: [attendanceTag(eventId), reportTag(eventId)],
    revalidate: 10,
  })(eventId)
}

export function getAttendanceReportCachedFor(
  eventId: string
): Promise<AttendanceReport> {
  return unstable_cache(
    getAttendanceReport,
    ["appsscript", "getAttendanceReport", eventId],
    { tags: [reportTag(eventId)], revalidate: 15 }
  )(eventId)
}

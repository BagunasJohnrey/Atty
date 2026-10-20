import "server-only"

import { neon } from "@neondatabase/serverless"
import type {
  AttendanceCheck,
  AttendanceRecord,
  RecordedAttendance,
} from "@/models/attendance"
import type {
  CreateEventInput,
  SchoolEvent,
  UpdateEventInput,
} from "@/models/event"
import type { AttendanceReport } from "@/models/report"
import type { Student } from "@/models/student"
import { manilaDayKey } from "@/lib/format"
import { isDayWithinEvent, outsideEventDatesMessage } from "@/lib/events"
import {
  hasReportFilters,
  matchesReportFilters,
  normalizeReportFilters,
  type ReportFilters,
} from "@/lib/reports/filters"
import { AppsScriptError } from "./errors"
import { getOrganization } from "./organizations"
import { getOrganizationNeon } from "./neon-organizations"

/**
 * Minimal Neon read layer.
 *
 * Phase 2 of the migration will grow this into the primary data path; the
 * Sheets backup is its first consumer. Reads only — writes go through the
 * domain modules with their own guards. Uses the HTTP driver, so there is
 * no pool to configure on serverless.
 */

export interface NeonEventRow {
  id: string
  name: string
  event_date: string
  status: string
  sheet_name: string
  location: string
  description: string
  org_id: string
  time: string
}

export interface NeonAttendanceRow {
  srcode: string
  scannedAt: string
}

function getSql() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) {
    throw new Error("NEON_DATABASE_URL is not configured. See .env.example.")
  }
  return neon(url)
}

export async function fetchEventsNeon(): Promise<NeonEventRow[]> {
  const sql = getSql()
  const rows = await sql`
    select id, name, event_date, status, sheet_name, location, description, org_id, time
    from events
    order by id
  `
  return rows as NeonEventRow[]
}

export async function getEventsNeon(): Promise<SchoolEvent[]> {
  const rows = await fetchEventsNeon()
  return rows.map((row) =>
    mapEventRow(row as unknown as Record<string, unknown>)
  )
}

export async function fetchAttendanceNeon(
  eventId: string
): Promise<NeonAttendanceRow[]> {
  const sql = getSql()
  const rows = await sql`
    select srcode, scanned_at
    from attendance
    where event_id = ${eventId}
    order by scanned_at
  `
  return (rows as { srcode: string; scanned_at: Date | string }[]).map(
    (row) => ({
      srcode: String(row.srcode ?? ""),
      scannedAt:
        row.scanned_at instanceof Date
          ? row.scanned_at.toISOString()
          : String(row.scanned_at ?? ""),
    })
  )
}

/**
 * Single-student lookup by srcode. Throws the same SRCODE_NOT_FOUND the
 * Apps Script path produces, so callers (and their HTTP mapping) behave
 * identically under both flags.
 */
export async function lookupStudentNeon(srcode: string): Promise<Student> {
  const sql = getSql()
  const rows = await sql`
    select srcode, full_name, college, program, year_level, gender
    from students
    where srcode = ${srcode}
    limit 1
  `
  const row = (rows as Record<string, string | null>[])[0]
  if (!row) {
    throw new AppsScriptError(
      "SRCODE_NOT_FOUND",
      "SRCODE not found in the Masterlist.",
      "lookupStudent"
    )
  }
  return mapStudentRow(row)
}

const EVENT_STATUSES = ["Upcoming", "Active", "Closed"] as const

type NeonEventStatus = (typeof EVENT_STATUSES)[number]

const EVENT_ID_PATTERN = /^EVT-(\d+)$/i

const EVENT_UPDATE_FIELDS = [
  "name",
  "date",
  "location",
  "description",
  "status",
  "orgId",
  "time",
] as const

function invalidRequest(message: string, action: string): AppsScriptError {
  return new AppsScriptError("INVALID_REQUEST", message, action)
}

function requiredEventString(
  value: unknown,
  label: string,
  maxLength: number,
  action: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidRequest(`${label} is required.`, action)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw invalidRequest(`${label} is too long.`, action)
  }
  return trimmed
}

function optionalEventString(
  value: unknown,
  label: string,
  maxLength: number,
  action: string
): string {
  if (value === undefined || value === null) return ""
  if (typeof value !== "string") {
    throw invalidRequest(`${label} must be a string.`, action)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw invalidRequest(`${label} is too long.`, action)
  }
  return trimmed
}

/** Mirrors Validators.normalizeDate: YYYY-MM-DD or MM/DD/YYYY in,
 *  zero-padded MM/DD/YYYY out. Ranges ("start - end", as the event form
 *  serializes multi-day events) normalize each half and return the
 *  canonical "MM/DD/YYYY - MM/DD/YYYY" span. */
export function normalizeEventDateTS(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidRequest("Event date is required.", "createEvent")
  }
  const text = value.trim()
  const halves = text.split(" - ")
  if (halves.length === 1) return normalizeSingleEventDate(text)
  if (halves.length !== 2) {
    throw invalidRequest(
      "Event date is invalid. Use MM/DD/YYYY, YYYY-MM-DD, or a range like MM/DD/YYYY - MM/DD/YYYY.",
      "createEvent"
    )
  }
  const start = normalizeSingleEventDate(halves[0].trim())
  const end = normalizeSingleEventDate(halves[1].trim())
  // Canonical halves are fixed-width, so lexicographic order is chronological.
  if (start > end) {
    throw invalidRequest(
      "End date must be on or after the start date.",
      "createEvent"
    )
  }
  return `${start} - ${end}`
}

function normalizeSingleEventDate(text: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  let parts = iso
    ? { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }
    : us
      ? { y: Number(us[3]), m: Number(us[1]), d: Number(us[2]) }
      : null
  if (!parts) {
    // Pretty halves ("November 15, 2026", as the form serializes ranges)
    // parse as local midnight, so the local getters are timezone-safe.
    // Impossible dates ("February 30, 2026") roll over and fail the probe
    // check below.
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) {
      parts = {
        y: parsed.getFullYear(),
        m: parsed.getMonth() + 1,
        d: parsed.getDate(),
      }
    }
  }
  const probe = parts ? new Date(parts.y, parts.m - 1, parts.d) : null
  if (
    !parts ||
    !probe ||
    probe.getFullYear() !== parts.y ||
    probe.getMonth() !== parts.m - 1 ||
    probe.getDate() !== parts.d
  ) {
    throw invalidRequest(
      "Event date is invalid. Use MM/DD/YYYY, YYYY-MM-DD, or a range like MM/DD/YYYY - MM/DD/YYYY.",
      "createEvent"
    )
  }
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(parts.m)}/${pad(parts.d)}/${parts.y}`
}

/** Mirrors Events.normalizeStatus: case-insensitive match or throw. */
export function normalizeEventStatusTS(value: unknown): NeonEventStatus {
  for (const status of EVENT_STATUSES) {
    if (
      typeof value === "string" &&
      value.trim().toLowerCase() === status.toLowerCase()
    ) {
      return status
    }
  }
  throw invalidRequest(
    "Event status is invalid. Use Upcoming, Active, or Closed.",
    "updateEvent"
  )
}

/** Mirrors Events.nextId: highest EVT-<n> suffix + 1, minimum 3 digits. */
export function nextEventIdTS(ids: string[]): string {
  let maxSequence = 0
  for (const id of ids) {
    const match = EVENT_ID_PATTERN.exec(id)
    if (match) maxSequence = Math.max(maxSequence, Number(match[1]))
  }
  let next = String(maxSequence + 1)
  while (next.length < 3) next = "0" + next
  return `EVT-${next}`
}

function mapEventRow(row: Record<string, unknown>): SchoolEvent {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    date: String(row.event_date ?? ""),
    // Verbatim like Models.eventFromRow; the DB check constraint owns validity.
    status: String(row.status ?? "Upcoming") as SchoolEvent["status"],
    sheetName: String(row.sheet_name ?? row.id ?? ""),
    location: String(row.location ?? ""),
    description: String(row.description ?? ""),
    orgId: String(row.org_id ?? ""),
    time: String(row.time ?? ""),
  }
}

/** Non-empty org ids must resolve against whichever backend owns
 *  organizers (NEON_ORGANIZATIONS); blank stays blank ("no organization"). */
async function assertOrgNeon(orgId: string): Promise<string> {
  if (!orgId) return ""
  if (process.env.NEON_ORGANIZATIONS === "neon") {
    await getOrganizationNeon(orgId)
  } else {
    await getOrganization(orgId)
  }
  return orgId
}

export async function getEventNeon(eventId: string): Promise<SchoolEvent> {
  const sql = getSql()
  const rows = await sql`
    select id, name, event_date, status, sheet_name, location, description, org_id, time
    from events where id = ${eventId} limit 1
  `
  const row = (rows as Record<string, unknown>[])[0]
  if (!row) {
    throw new AppsScriptError("EVENT_NOT_FOUND", "Event not found.", "getEvent")
  }
  return mapEventRow(row)
}

export async function createEventNeon(
  input: CreateEventInput
): Promise<SchoolEvent> {
  const action = "createEvent"
  const name = requiredEventString(input.name, "Event name", 150, action)
  const date = normalizeEventDateTS(input.date)
  const location = optionalEventString(
    input.location,
    "Event location",
    150,
    action
  )
  const description = requiredEventString(
    input.description,
    "Event description",
    500,
    action
  )
  const orgId = optionalEventString(input.orgId, "Organization ID", 20, action)
  const time = optionalEventString(input.time, "Event time", 100, action)
  const owner = await assertOrgNeon(orgId)

  const insertOnce = async (): Promise<SchoolEvent> => {
    const sql = getSql()
    const existing = (await sql`select id from events`) as { id: string }[]
    const id = nextEventIdTS(existing.map((row) => String(row.id)))
    const rows = await sql`
      insert into events (id, name, event_date, status, sheet_name, location, description, org_id, time)
      values (${id}, ${name}, ${date}, 'Upcoming', ${id}, ${location}, ${description}, ${owner}, ${time})
      returning *
    `
    return mapEventRow((rows as Record<string, unknown>[])[0])
  }

  try {
    return await insertOnce()
  } catch (error) {
    // Two simultaneous creates can claim the same id; recompute once.
    if ((error as { code?: string })?.code === "23505") return insertOnce()
    throw error
  }
}

export async function updateEventNeon(
  eventId: string,
  patch: UpdateEventInput
): Promise<SchoolEvent> {
  const action = "updateEvent"
  for (const key of Object.keys(patch)) {
    if (!(EVENT_UPDATE_FIELDS as readonly string[]).includes(key)) {
      throw invalidRequest(`Unknown field: ${key}`, action)
    }
  }
  const current = await getEventNeon(eventId)
  const columns: Record<string, string> = {}
  if (patch.name !== undefined) {
    columns.name = requiredEventString(patch.name, "Event name", 150, action)
  }
  if (patch.date !== undefined) {
    columns.event_date = normalizeEventDateTS(patch.date)
  }
  if (patch.location !== undefined) {
    columns.location = optionalEventString(
      patch.location,
      "Event location",
      150,
      action
    )
  }
  if (patch.description !== undefined) {
    columns.description = optionalEventString(
      patch.description,
      "Event description",
      500,
      action
    )
  }
  if (patch.status !== undefined) {
    columns.status = normalizeEventStatusTS(patch.status)
  }
  if (patch.orgId !== undefined) {
    const orgId = optionalEventString(
      patch.orgId,
      "Organization ID",
      20,
      action
    )
    columns.org_id = await assertOrgNeon(orgId)
  }
  if (patch.time !== undefined) {
    columns.time = optionalEventString(patch.time, "Event time", 100, action)
  }
  const entries = Object.entries(columns)
  if (entries.length === 0) return current
  const sql = getSql()
  const sets = entries.map(([column], i) => `${column} = $${i + 1}`)
  const values = entries.map(([, value]) => value)
  values.push(eventId)
  const rows = (await sql.query(
    `update events set ${sets.join(", ")} where id = $${values.length} returning *`,
    values
  )) as Record<string, unknown>[]
  return rows[0] ? mapEventRow(rows[0]) : current
}

export async function openEventNeon(eventId: string): Promise<SchoolEvent> {
  const event = await getEventNeon(eventId)
  if (event.status === "Active") return event
  if (event.status === "Closed") {
    throw new AppsScriptError(
      "EVENT_NOT_ACTIVE",
      "The event is closed and cannot be reopened.",
      "openEvent"
    )
  }
  const sql = getSql()
  const rows = (await sql`
    update events set status = 'Active' where id = ${eventId} returning *
  `) as Record<string, unknown>[]
  return rows[0] ? mapEventRow(rows[0]) : { ...event, status: "Active" }
}

export async function closeEventNeon(eventId: string): Promise<SchoolEvent> {
  const event = await getEventNeon(eventId)
  if (event.status === "Closed") return event
  const sql = getSql()
  const rows = (await sql`
    update events set status = 'Closed' where id = ${eventId} returning *
  `) as Record<string, unknown>[]
  return rows[0] ? mapEventRow(rows[0]) : { ...event, status: "Closed" }
}

export async function deleteEventNeon(eventId: string): Promise<SchoolEvent> {
  // Read first so a missing id reports EVENT_NOT_FOUND instead of a silent
  // no-op. Attendance rows cascade from the foreign key.
  const event = await getEventNeon(eventId)
  const sql = getSql()
  const rows = (await sql`
    delete from events where id = ${eventId} returning *
  `) as Record<string, unknown>[]
  return rows[0] ? mapEventRow(rows[0]) : event
}

function toISO(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? "")
}

function mapStudentRow(row: Record<string, unknown>): Student {
  return {
    srcode: String(row.srcode ?? ""),
    name: String(row.full_name ?? ""),
    college: String(row.college ?? ""),
    program: String(row.program ?? ""),
    yearLevel: String(row.year_level ?? ""),
    gender: String(row.gender ?? ""),
  }
}

/** Mirrors Events.assertCanRecord, including which status gets which message. */
function assertCanRecordNeon(event: SchoolEvent): void {
  if (event.status === "Active") return
  if (event.status === "Closed") {
    throw new AppsScriptError(
      "EVENT_NOT_ACTIVE",
      "The event is closed and no longer accepts attendance.",
      "recordAttendance"
    )
  }
  throw new AppsScriptError(
    "EVENT_NOT_ACTIVE",
    "The event is not active yet.",
    "recordAttendance"
  )
}

/**
 * Mirrors Events.assertDateOpen: the scan's Manila day must be one of the
 * event's dates from its details. Replays are judged by the day they were
 * taken, so `day` is the scan day, not necessarily today.
 */
function assertDateOpenNeon(
  event: SchoolEvent,
  day: string,
  action: string
): void {
  if (isDayWithinEvent(event.date, day)) return
  throw new AppsScriptError(
    "EVENT_DATE_CLOSED",
    outsideEventDatesMessage(event),
    action
  )
}

function requireSrcode(value: unknown, action: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppsScriptError("INVALID_REQUEST", "SRCODE is required.", action)
  }
  const trimmed = value.trim()
  if (trimmed.length > 20) {
    throw new AppsScriptError("INVALID_REQUEST", "SRCODE is too long.", action)
  }
  return trimmed
}

export async function recordAttendanceNeon(
  eventId: string,
  srcode: string,
  /** Device ms epoch for offline replays; defaults to now. */
  scannedAt?: number
): Promise<RecordedAttendance> {
  const action = "recordAttendance"
  const code = requireSrcode(srcode, action)
  // Event and student reads are independent — run them together so one
  // validation costs one roundtrip batch instead of two in a row.
  const [event, student] = await Promise.all([
    getEventNeon(eventId),
    lookupStudentNeon(code),
  ])
  assertCanRecordNeon(event)
  const sql = getSql()
  const at = scannedAt === undefined ? new Date() : new Date(scannedAt)
  assertDateOpenNeon(event, manilaDayKey(at), action)
  const rows = (await sql`
    insert into attendance (event_id, srcode, day, scanned_at)
    values (${eventId}, ${code}, ${manilaDayKey(at)}, ${at})
    on conflict (event_id, srcode, day) do nothing
    returning scanned_at
  `) as { scanned_at: unknown }[]
  if (rows.length === 0) {
    throw new AppsScriptError(
      "DUPLICATE_ATTENDANCE",
      "Already recorded today.",
      action
    )
  }
  return { timestamp: toISO(rows[0].scanned_at), student }
}

export async function checkAttendanceNeon(
  eventId: string,
  srcode: string
): Promise<AttendanceCheck> {
  const action = "checkAttendance"
  const code = requireSrcode(srcode, action)
  // Same parallelization as record: event and student are independent reads.
  // An unknown srcode resolves to null here instead of throwing (check, not
  // record, owns the not-found case).
  // getEventNeon's return feeds the date gate below — and its value is the
  // EVENT_NOT_FOUND throw for unknown events.
  const [event, student] = await Promise.all([
    getEventNeon(eventId),
    lookupStudentNeon(code).catch((error) => {
      if ((error as AppsScriptError)?.code !== "SRCODE_NOT_FOUND") throw error
      return null
    }),
  ])
  assertDateOpenNeon(event, manilaDayKey(new Date()), action)
  const sql = getSql()
  const rows = (await sql`
    select scanned_at from attendance
    where event_id = ${eventId} and srcode = ${code} and day = ${manilaDayKey(new Date())}
    order by scanned_at desc
    limit 1
  `) as { scanned_at: unknown }[]
  const result: AttendanceCheck = { present: rows.length > 0 }
  if (student) result.student = student
  if (result.present) result.timestamp = toISO(rows[0].scanned_at)
  return result
}

export async function listAttendanceNeon(
  eventId: string
): Promise<AttendanceRecord[]> {
  await getEventNeon(eventId)
  return listAttendanceRowsNeon(eventId)
}

async function listAttendanceRowsNeon(
  eventId: string
): Promise<AttendanceRecord[]> {
  const sql = getSql()
  const rows = (await sql`
    select a.srcode, a.scanned_at,
      s.full_name, s.college, s.program, s.year_level, s.gender
    from attendance a
    left join students s on s.srcode = a.srcode
    where a.event_id = ${eventId} and trim(a.srcode) <> ''
    order by a.scanned_at
  `) as Record<string, unknown>[]
  return rows.map((row) => ({
    timestamp: toISO(row.scanned_at),
    srcode: String(row.srcode ?? ""),
    name: String(row.full_name ?? ""),
    college: String(row.college ?? ""),
    program: String(row.program ?? ""),
    yearLevel: String(row.year_level ?? ""),
    gender: String(row.gender ?? ""),
  }))
}

function groupAttendanceBy(
  records: AttendanceRecord[],
  field: "college" | "program" | "yearLevel" | "gender"
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const record of records) {
    const key = String(record[field] || "Unknown").trim() || "Unknown"
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

export async function getAttendanceReportNeon(
  eventId: string,
  filters?: ReportFilters
): Promise<AttendanceReport> {
  const event = await getEventNeon(eventId)
  const attendance = await listAttendanceRowsNeon(eventId)
  const normalized = normalizeReportFilters(filters)
  const hasFilters = hasReportFilters(normalized)
  const scoped = hasFilters
    ? attendance.filter((record) => matchesReportFilters(record, normalized))
    : attendance
  const sql = getSql()
  // A facet filter also narrows the roster the rate is measured against;
  // otherwise filtering by one department would still count every student
  // on campus as absent.
  const college = normalized.college ?? ""
  const program = normalized.program ?? ""
  const yearLevel = normalized.yearLevel ?? ""
  const gender = normalized.gender ?? ""
  const counted = (await sql`
    select count(*)::int as n from students
    where (${college} = '' or lower(trim(college)) = lower(${college}))
      and (${program} = '' or lower(trim(program)) = lower(${program}))
      and (${yearLevel} = '' or lower(trim(year_level)) = lower(${yearLevel}))
      and (${gender} = '' or lower(trim(gender)) = lower(${gender}))
  `) as { n: number }[]
  const totalStudents = counted[0]?.n ?? 0
  const totalScans = scoped.length
  const presentSrcodes = new Set(scoped.map((record) => record.srcode))
  const totalPresent = presentSrcodes.size
  const totalAbsent = Math.max(0, totalStudents - totalPresent)
  // Overall groups count distinct students (first scan wins), so shares
  // never exceed 100% on multi-day events.
  const seenSrcodes = new Set<string>()
  const distinct = scoped.filter((record) => {
    if (seenSrcodes.has(record.srcode)) return false
    seenSrcodes.add(record.srcode)
    return true
  })
  const byDay = new Map<string, AttendanceRecord[]>()
  for (const record of scoped) {
    const day = manilaDayKey(record.timestamp)
    const group = byDay.get(day)
    if (group) group.push(record)
    else byDay.set(day, [record])
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, records]) => {
      const present = new Set(records.map((record) => record.srcode)).size
      const absent = Math.max(0, totalStudents - present)
      return {
        day,
        present,
        absent,
        rate:
          totalStudents <= 0
            ? 0
            : Math.round((present / totalStudents) * 10000) / 100,
        byCollege: groupAttendanceBy(records, "college"),
        byProgram: groupAttendanceBy(records, "program"),
        byYearLevel: groupAttendanceBy(records, "yearLevel"),
        byGender: groupAttendanceBy(records, "gender"),
      }
    })
  return {
    event,
    totalStudents,
    totalPresent,
    totalAbsent,
    attendanceRate:
      totalStudents <= 0
        ? 0
        : Math.round((totalPresent / totalStudents) * 10000) / 100,
    totalScans,
    byCollege: groupAttendanceBy(distinct, "college"),
    byProgram: groupAttendanceBy(distinct, "program"),
    byYearLevel: groupAttendanceBy(distinct, "yearLevel"),
    byGender: groupAttendanceBy(distinct, "gender"),
    days,
  }
}

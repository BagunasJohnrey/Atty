import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppsScriptError } from "./errors"
import {
  checkAttendanceNeon,
  closeEventNeon,
  createEventNeon,
  fetchAttendanceNeon,
  fetchEventsNeon,
  getAttendanceReportNeon,
  getEventNeon,
  listAttendanceNeon,
  lookupStudentNeon,
  openEventNeon,
  recordAttendanceNeon,
  updateEventNeon,
} from "./neon"
import { getOrganization } from "./organizations"
import { neon } from "@neondatabase/serverless"

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }))
vi.mock("./organizations", () => ({ getOrganization: vi.fn() }))

const neonMock = vi.mocked(neon)
const orgMock = vi.mocked(getOrganization)
const OLD_URL = process.env.NEON_DATABASE_URL

function queryText(strings: TemplateStringsArray | string): string {
  return typeof strings === "string" ? strings : strings.join(" ")
}

function mockSql(
  impl: (strings: TemplateStringsArray | string, ...values: unknown[]) => unknown
) {
  const sql = vi.fn(
    (strings: TemplateStringsArray | string, ...values: unknown[]) =>
      Promise.resolve(impl(strings, ...values)) as never
  ) as unknown as {
    (...args: unknown[]): Promise<unknown>
    query: (text: string, params: unknown[]) => Promise<unknown>
    mock: { calls: unknown[][] }
  }
  sql.query = (text: string, params: unknown[]) => sql(text, params)
  neonMock.mockReturnValue(sql as never)
  return sql
}

beforeEach(() => {
  neonMock.mockReset()
  orgMock.mockReset()
  orgMock.mockResolvedValue({ id: "ORG-001", name: "Org", email: "" })
  process.env.NEON_DATABASE_URL = "postgresql://test/test"
})

describe("neon readers", () => {
  it("throws a clear error without a connection string", async () => {
    delete process.env.NEON_DATABASE_URL
    await expect(fetchEventsNeon()).rejects.toThrow("NEON_DATABASE_URL")
    process.env.NEON_DATABASE_URL = OLD_URL
  })

  it("reads events ordered by id", async () => {
    const sql = vi.fn().mockResolvedValue([
      {
        id: "EVT-001",
        name: "Orientation",
        event_date: "09/20/2026",
        status: "Active",
        sheet_name: "EVT-001",
        location: "Gym",
        description: "",
        org_id: "ORG-001",
        time: "",
      },
    ])
    neonMock.mockReturnValue(sql as never)
    const events = await fetchEventsNeon()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: "EVT-001", name: "Orientation" })
    expect(String(sql.mock.calls[0])).toContain("from events")
  })

  it("normalizes attendance timestamps to ISO strings", async () => {
    const sql = vi.fn().mockResolvedValue([
      { srcode: "26-12345", scanned_at: new Date("2026-09-20T00:01:23.000Z") },
    ])
    neonMock.mockReturnValue(sql as never)
    const rows = await fetchAttendanceNeon("EVT-001")
    expect(rows).toEqual([
      { srcode: "26-12345", scannedAt: "2026-09-20T00:01:23.000Z" },
    ])
    expect(String(sql.mock.calls[0])).toContain("from attendance")
  })

  it("looks up one student by srcode", async () => {
    const sql = vi.fn().mockResolvedValue([
      {
        srcode: "26-12345",
        full_name: "Juan Dela Cruz",
        college: "CICS",
        program: "BSIT",
        year_level: "First Year",
        gender: "Male",
      },
    ])
    neonMock.mockReturnValue(sql as never)
    await expect(lookupStudentNeon("26-12345")).resolves.toMatchObject({
      srcode: "26-12345",
      name: "Juan Dela Cruz",
      yearLevel: "First Year",
    })
  })

  it("throws SRCODE_NOT_FOUND for an unknown srcode", async () => {
    const sql = vi.fn().mockResolvedValue([])
    neonMock.mockReturnValue(sql as never)
    await expect(lookupStudentNeon("00-00000")).rejects.toMatchObject({
      code: "SRCODE_NOT_FOUND",
    })
  })
})

const neonEventRow = {
  id: "EVT-001",
  name: "Orientation",
  event_date: "09/20/2026",
  status: "Active",
  sheet_name: "EVT-001",
  location: "Gym",
  description: "",
  org_id: "ORG-001",
  time: "",
}

describe("neon events", () => {
  it("maps one event row to the app shape", async () => {
    const sql = mockSql(() => [neonEventRow])
    await expect(getEventNeon("EVT-001")).resolves.toMatchObject({
      id: "EVT-001",
      date: "09/20/2026",
      sheetName: "EVT-001",
      orgId: "ORG-001",
    })
    expect(String(sql.mock.calls[0])).toContain("from events")
  })

  it("throws EVENT_NOT_FOUND for an unknown event", async () => {
    mockSql(() => [])
    await expect(getEventNeon("EVT-999")).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    })
  })

  it("creates with the next sequence id and Upcoming status", async () => {
    const sql = mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [{ id: "EVT-007" }]
      if (q.includes("insert into events")) {
        const v = values as string[]
        return [
          {
            id: v[0],
            name: v[1],
            event_date: v[2],
            status: "Upcoming",
            sheet_name: v[3],
            location: v[4],
            description: v[5],
            org_id: v[6],
            time: v[7],
          },
        ]
      }
      throw new Error(`unexpected query: ${q}`)
    })
    const event = await createEventNeon({ name: "New", date: "2026-10-20" })
    expect(event).toMatchObject({ id: "EVT-008", status: "Upcoming" })
    expect(String(sql.mock.calls[1])).toContain("insert into events")
  })

  it("rejects an empty name and a bad date without querying", async () => {
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(createEventNeon({ name: "  ", date: "2026-10-20" })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    await expect(createEventNeon({ name: "New", date: "not-a-date" })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    expect(sql).not.toHaveBeenCalled()
  })

  it("rejects an unknown org without querying events", async () => {
    orgMock.mockRejectedValue(
      new AppsScriptError("ORG_NOT_FOUND", "Organization not found.", "getOrganization")
    )
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(
      createEventNeon({ name: "New", date: "2026-10-20", orgId: "ORG-404" })
    ).rejects.toMatchObject({ code: "ORG_NOT_FOUND" })
    expect(sql).not.toHaveBeenCalled()
  })

  it("rejects unknown patch keys without querying", async () => {
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(
      updateEventNeon("EVT-001", { nope: true } as never)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" })
    expect(sql).not.toHaveBeenCalled()
  })

  it("rejects bad statuses", async () => {
    // Mirrors the script: the event is read first, then the patch validated.
    mockSql(() => [neonEventRow])
    await expect(
      updateEventNeon("EVT-001", { status: "Exploding" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" })
  })

  it("throws EVENT_NOT_FOUND when patching a missing event", async () => {
    mockSql(() => [])
    await expect(updateEventNeon("EVT-999", { name: "X" })).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    })
  })

  it("applies a patch and returns the updated event", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("update events")) return [{ ...neonEventRow, location: "Hall" }]
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(
      updateEventNeon("EVT-001", { location: "Hall" })
    ).resolves.toMatchObject({ location: "Hall" })
  })

  it("opens an Upcoming event and no-ops an Active one", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events"))
        return [{ ...neonEventRow, status: "Upcoming" }]
      if (q.includes("update events"))
        return [{ ...neonEventRow, status: "Active" }]
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(openEventNeon("EVT-001")).resolves.toMatchObject({
      status: "Active",
    })
    mockSql(() => [neonEventRow])
    await expect(openEventNeon("EVT-001")).resolves.toMatchObject({
      status: "Active",
    })
  })

  it("refuses to reopen a Closed event", async () => {
    mockSql(() => [{ ...neonEventRow, status: "Closed" }])
    await expect(openEventNeon("EVT-001")).rejects.toMatchObject({
      code: "EVENT_NOT_ACTIVE",
    })
  })

  it("closes an Active event and no-ops a Closed one", async () => {
    const sql = mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("update events"))
        return [{ ...neonEventRow, status: "Closed" }]
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(closeEventNeon("EVT-001")).resolves.toMatchObject({
      status: "Closed",
    })
    expect(String(sql.mock.calls[1])).toContain("update events")
    mockSql(() => [{ ...neonEventRow, status: "Closed" }])
    await expect(closeEventNeon("EVT-001")).resolves.toMatchObject({
      status: "Closed",
    })
  })
})

const neonStudentRow = {
  srcode: "26-12345",
  full_name: "Juan Dela Cruz",
  college: "CICS",
  program: "BSIT",
  year_level: "First Year",
  gender: "Male",
}

function mockAttendanceDb() {
  return mockSql((strings) => {
    const q = queryText(strings)
    if (q.includes("from events")) return [neonEventRow]
    if (q.includes("from students") && q.includes("where"))
      return [neonStudentRow]
    if (q.includes("insert into attendance"))
      return [{ scanned_at: new Date("2026-09-20T00:01:23.000Z") }]
    if (q.includes("from attendance")) return []
    throw new Error(`unexpected query: ${q}`)
  })
}

describe("neon attendance", () => {
  it("records a scan and returns the timestamp with the student", async () => {
    mockAttendanceDb()
    const result = await recordAttendanceNeon("EVT-001", "26-12345")
    expect(result.student).toMatchObject({ srcode: "26-12345" })
    expect(result.timestamp).toBe("2026-09-20T00:01:23.000Z")
  })

  it("rejects recording for unknown events, inactive events, and unknown students", async () => {
    mockSql(() => [])
    await expect(recordAttendanceNeon("EVT-999", "26-12345")).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    })
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [{ ...neonEventRow, status: "Closed" }]
      // Fires concurrently with the event read; the closed status still wins.
      if (q.includes("from students")) return [neonStudentRow]
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(recordAttendanceNeon("EVT-001", "26-12345")).rejects.toMatchObject({
      code: "EVENT_NOT_ACTIVE",
    })
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("from students")) return []
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(recordAttendanceNeon("EVT-001", "00-00000")).rejects.toMatchObject({
      code: "SRCODE_NOT_FOUND",
    })
  })

  it("reports a duplicate scan instead of writing twice", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("insert into attendance")) return []
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(recordAttendanceNeon("EVT-001", "26-12345")).rejects.toMatchObject({
      code: "DUPLICATE_ATTENDANCE",
    })
  })

  it("checks presence with timestamp and student", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("from attendance"))
        return [{ scanned_at: new Date("2026-09-20T00:01:23.000Z") }]
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(checkAttendanceNeon("EVT-001", "26-12345")).resolves.toEqual({
      present: true,
      timestamp: "2026-09-20T00:01:23.000Z",
      student: expect.objectContaining({ srcode: "26-12345" }),
    })
  })

  it("checks absence without a timestamp", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("from attendance")) return []
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(checkAttendanceNeon("EVT-001", "26-12345")).resolves.toEqual({
      present: false,
      student: expect.objectContaining({ srcode: "26-12345" }),
    })
  })

  it("lists joined records in one query", async () => {
    const sql = mockSql(() => [
      {
        srcode: "26-12345",
        scanned_at: new Date("2026-09-20T00:01:23.000Z"),
        full_name: "Juan Dela Cruz",
        college: "CICS",
        program: "BSIT",
        year_level: "First Year",
        gender: "Male",
      },
    ])
    await expect(listAttendanceNeon("EVT-001")).resolves.toEqual([
      {
        timestamp: "2026-09-20T00:01:23.000Z",
        srcode: "26-12345",
        name: "Juan Dela Cruz",
        college: "CICS",
        program: "BSIT",
        yearLevel: "First Year",
        gender: "Male",
      },
    ])
    expect(String(sql.mock.calls[1])).toContain("join students")
  })

  it("builds the report with totals, rate, and groups", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("count(")) return [{ n: 4 }]
      if (q.includes("from attendance"))
        return [
          { srcode: "a", scanned_at: "2026-09-20T00:01:23.000Z", full_name: "A", college: "CICS", program: "BSIT", year_level: "First Year", gender: "Male" },
          { srcode: "b", scanned_at: "2026-09-20T00:02:23.000Z", full_name: "B", college: "CICS", program: "BSCS", year_level: "First Year", gender: "Female" },
        ]
      throw new Error(`unexpected query: ${q}`)
    })
    const report = await getAttendanceReportNeon("EVT-001")
    expect(report).toMatchObject({
      totalStudents: 4,
      totalPresent: 2,
      totalAbsent: 2,
      attendanceRate: 50,
      byCollege: { CICS: 2 },
      byProgram: { BSIT: 1, BSCS: 1 },
    })
  })
})

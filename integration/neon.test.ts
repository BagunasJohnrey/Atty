import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppsScriptError } from "./errors"
import { manilaDayKey } from "@/lib/format"
import {
  checkAttendanceNeon,
  closeEventNeon,
  createEventNeon,
  deleteEventNeon,
  fetchAttendanceNeon,
  fetchEventsNeon,
  getAttendanceReportNeon,
  getEventNeon,
  listAttendanceNeon,
  lookupStudentNeon,
  normalizeEventDateTS,
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
    const event = await createEventNeon({
      name: "New",
      date: "2026-10-20",
      description: "Welcome.",
    })
    expect(event).toMatchObject({ id: "EVT-008", status: "Upcoming" })
    expect(String(sql.mock.calls[1])).toContain("insert into events")
  })

  it("rejects an empty name and a bad date without querying", async () => {
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(
      createEventNeon({
        name: "  ",
        date: "2026-10-20",
        description: "Welcome.",
      })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    await expect(
      createEventNeon({ name: "New", date: "not-a-date", description: "W." })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    expect(sql).not.toHaveBeenCalled()
  })

  it("rejects a missing description without querying", async () => {
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(
      createEventNeon({ name: "New", date: "2026-10-20" })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    await expect(
      createEventNeon({ name: "New", date: "2026-10-20", description: "  " })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    expect(sql).not.toHaveBeenCalled()
  })

  it("normalizes single dates to zero-padded MM/DD/YYYY", () => {
    expect(normalizeEventDateTS("2026-11-01")).toBe("11/01/2026")
    expect(normalizeEventDateTS("11/1/2026")).toBe("11/01/2026")
  })

  it("normalizes a pretty range to a canonical range", () => {
    expect(normalizeEventDateTS("November 15, 2026 - November 16, 2026")).toBe(
      "11/15/2026 - 11/16/2026"
    )
    expect(normalizeEventDateTS("2026-11-15 - 2026-11-16")).toBe(
      "11/15/2026 - 11/16/2026"
    )
  })

  it("rejects an end date before the start date without querying", async () => {
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(
      createEventNeon({
        name: "New",
        date: "11/16/2026 - 11/15/2026",
        description: "Welcome.",
      })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    expect(sql).not.toHaveBeenCalled()
  })

  it("stores a ranged date in canonical form", async () => {
    mockSql((strings, ...values) => {
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
    const event = await createEventNeon({
      name: "New",
      date: "November 15, 2026 - November 16, 2026",
      description: "Welcome.",
    })
    expect(event.date).toBe("11/15/2026 - 11/16/2026")
  })

  it("accepts a ranged date on update", async () => {
    let params: unknown[] = []
    mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("update events")) {
        params = values[0] as unknown[]
        return [{ ...neonEventRow, event_date: params[0] }]
      }
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(
      updateEventNeon("EVT-001", { date: "11/15/2026 - 11/16/2026" })
    ).resolves.toMatchObject({ date: "11/15/2026 - 11/16/2026" })
    expect(params[0]).toBe("11/15/2026 - 11/16/2026")
  })

  it("rejects an unknown org without querying events", async () => {
    orgMock.mockRejectedValue(
      new AppsScriptError("ORG_NOT_FOUND", "Organization not found.", "getOrganization")
    )
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(
      createEventNeon({
        name: "New",
        date: "2026-10-20",
        description: "Welcome.",
        orgId: "ORG-404",
      })
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

  it("deletes an event and returns it", async () => {
    const sql = mockSql((strings) => {
      const q = queryText(strings)
      // "delete from events" also contains "from events" — check delete first.
      if (q.includes("delete from events")) return [neonEventRow]
      if (q.includes("from events")) return [neonEventRow]
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(deleteEventNeon("EVT-001")).resolves.toMatchObject({
      id: "EVT-001",
    })
    expect(
      sql.mock.calls.some((call) => String(call).includes("delete from events"))
    ).toBe(true)
  })

  it("throws EVENT_NOT_FOUND when deleting a missing event", async () => {
    const sql = mockSql(() => [])
    await expect(deleteEventNeon("EVT-999")).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    })
    expect(
      sql.mock.calls.some((call) => String(call).includes("delete from events"))
    ).toBe(false)
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
    if (q.includes("from events")) return [eventRowOn(new Date())]
    if (q.includes("from students") && q.includes("where"))
      return [neonStudentRow]
    if (q.includes("insert into attendance"))
      return [{ scanned_at: new Date("2026-09-20T00:01:23.000Z") }]
    if (q.includes("from attendance")) return []
    throw new Error(`unexpected query: ${q}`)
  })
}

/**
 * Event fixture whose dates cover the given instant's Manila day, as
 * `MM/DD/YYYY`. Record/check tests pin "today" this way so the date gate
 * passes without coupling the suite to the calendar date it runs on.
 */
function eventRowOn(at: number | Date = new Date()) {
  const [year, month, day] = manilaDayKey(at).split("-")
  return { ...neonEventRow, event_date: `${month}/${day}/${year}` }
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
      if (q.includes("from events")) return [eventRowOn(new Date())]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("insert into attendance")) return []
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(recordAttendanceNeon("EVT-001", "26-12345")).rejects.toMatchObject({
      code: "DUPLICATE_ATTENDANCE",
    })
  })

  it("scopes the duplicate guard to the Manila day", async () => {
    const days: unknown[] = []
    const seen = new Set<string>()
    const sql = mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [eventRowOn(new Date())]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("insert into attendance")) {
        // Emulate the (event_id, srcode, day) primary key.
        const key = `${values[0]}|${values[1]}|${values[2]}`
        if (seen.has(key)) return []
        seen.add(key)
        days.push(values[2])
        return [{ scanned_at: values[3] }]
      }
      throw new Error(`unexpected query: ${q}`)
    })
    await recordAttendanceNeon("EVT-001", "26-12345")
    await expect(
      recordAttendanceNeon("EVT-001", "26-12345")
    ).rejects.toMatchObject({ code: "DUPLICATE_ATTENDANCE" })
    expect(days).toHaveLength(1)
    expect(days[0]).toBe(manilaDayKey(new Date()))
    const insertCall = sql.mock.calls.find((call) =>
      String(call).includes("insert into attendance")
    )
    expect(String(insertCall)).toContain("on conflict (event_id, srcode, day)")
  })

  it("stores scans straddling Manila midnight on different days", async () => {
    vi.useFakeTimers()
    try {
      const days: unknown[] = []
      mockSql((strings, ...values) => {
        const q = queryText(strings)
        if (q.includes("from events"))
          return [
            { ...neonEventRow, event_date: "10/11/2026 - 10/12/2026" },
          ]
        if (q.includes("from students")) return [neonStudentRow]
        if (q.includes("insert into attendance")) {
          days.push(values[2])
          return [{ scanned_at: values[3] }]
        }
        throw new Error(`unexpected query: ${q}`)
      })
      vi.setSystemTime(new Date("2026-10-11T15:59:00Z")) // 23:59 Manila
      await recordAttendanceNeon("EVT-001", "26-12345")
      vi.setSystemTime(new Date("2026-10-11T16:01:00Z")) // 00:01 Manila
      await recordAttendanceNeon("EVT-001", "26-12345")
      expect(days).toEqual(["2026-10-11", "2026-10-12"])
    } finally {
      vi.useRealTimers()
    }
  })

  it("stores an explicit scan timestamp on its Manila day", async () => {
    const seen: unknown[][] = []
    const yesterday = Date.now() - 86400000
    mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [eventRowOn(yesterday)]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("insert into attendance")) {
        seen.push(values)
        return [{ scanned_at: values[3] }]
      }
      throw new Error(`unexpected query: ${q}`)
    })
    await recordAttendanceNeon("EVT-001", "26-12345", yesterday)
    expect(seen).toHaveLength(1)
    expect(seen[0][2]).toBe(manilaDayKey(yesterday))
    expect((seen[0][3] as Date).getTime()).toBe(yesterday)
  })

  it("refuses a scan outside the event's dates", async () => {
    vi.useFakeTimers()
    try {
      const sql = mockSql((strings) => {
        const q = queryText(strings)
        if (q.includes("from events"))
          return [
            { ...neonEventRow, event_date: "10/11/2026 - 10/12/2026" },
          ]
        if (q.includes("from students")) return [neonStudentRow]
        throw new Error(`unexpected query: ${q}`)
      })
      // 08:00 Manila on Oct 13: the day after the event ended.
      vi.setSystemTime(new Date("2026-10-13T00:00:00.000Z"))
      await expect(
        recordAttendanceNeon("EVT-001", "26-12345")
      ).rejects.toMatchObject({ code: "EVENT_DATE_CLOSED" })
      expect(
        sql.mock.calls.some((call) =>
          String(call).includes("insert into attendance")
        )
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it("judges a replay by its scan day, not the sync day", async () => {
    vi.useFakeTimers()
    try {
      mockSql((strings, ...values) => {
        const q = queryText(strings)
        if (q.includes("from events"))
          return [
            { ...neonEventRow, event_date: "10/11/2026 - 10/12/2026" },
          ]
        if (q.includes("from students")) return [neonStudentRow]
        if (q.includes("insert into attendance"))
          return [{ scanned_at: values[3] }]
        throw new Error(`unexpected query: ${q}`)
      })
      // Synced Oct 13, but scanned Oct 12 while the event was open.
      vi.setSystemTime(new Date("2026-10-13T00:00:00.000Z"))
      const scannedAt = new Date("2026-10-12T15:00:00.000Z").getTime()
      const result = await recordAttendanceNeon(
        "EVT-001",
        "26-12345",
        scannedAt
      )
      expect(result.student).toMatchObject({ srcode: "26-12345" })
      // A replay scanned after the event ended is still refused.
      await expect(
        recordAttendanceNeon(
          "EVT-001",
          "26-12345",
          new Date("2026-10-13T00:00:00.000Z").getTime()
        )
      ).rejects.toMatchObject({ code: "EVENT_DATE_CLOSED" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("fails open when the event date is unparseable", async () => {
    mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("from events"))
        return [{ ...neonEventRow, event_date: "someday" }]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("insert into attendance"))
        return [{ scanned_at: values[3] }]
      throw new Error(`unexpected query: ${q}`)
    })
    const result = await recordAttendanceNeon("EVT-001", "26-12345")
    expect(result.student).toMatchObject({ srcode: "26-12345" })
  })

  it("refuses validation outside the event's dates", async () => {
    vi.useFakeTimers()
    try {
      mockSql((strings) => {
        const q = queryText(strings)
        if (q.includes("from events"))
          return [
            { ...neonEventRow, event_date: "10/11/2026 - 10/12/2026" },
          ]
        if (q.includes("from students")) return [neonStudentRow]
        throw new Error(`unexpected query: ${q}`)
      })
      vi.setSystemTime(new Date("2026-10-13T00:00:00.000Z"))
      await expect(
        checkAttendanceNeon("EVT-001", "26-12345")
      ).rejects.toMatchObject({ code: "EVENT_DATE_CLOSED" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("collapses simultaneous same-day scans to one row", async () => {    let inserts = 0
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [eventRowOn(new Date())]
      if (q.includes("from students")) return [neonStudentRow]
      if (q.includes("insert into attendance")) {
        inserts += 1
        return inserts === 1
          ? [{ scanned_at: new Date("2026-09-20T00:01:23.000Z") }]
          : []
      }
      throw new Error(`unexpected query: ${q}`)
    })
    const [a, b] = await Promise.allSettled([
      recordAttendanceNeon("EVT-001", "26-12345"),
      recordAttendanceNeon("EVT-001", "26-12345"),
    ])
    const fulfilled = [a, b].filter((r) => r.status === "fulfilled")
    const dupes = [a, b].filter(
      (r) =>
        r.status === "rejected" &&
        (r.reason as { code?: string })?.code === "DUPLICATE_ATTENDANCE"
    )
    expect(fulfilled).toHaveLength(1)
    expect(dupes).toHaveLength(1)
  })

  it("checks presence for today only", async () => {
    const sql = mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [eventRowOn(new Date())]
      if (q.includes("from students")) return [neonStudentRow]
      // Day filter excluded the yesterday-only scan.
      if (q.includes("from attendance")) return []
      throw new Error(`unexpected query: ${q}`)
    })
    await expect(
      checkAttendanceNeon("EVT-001", "26-12345")
    ).resolves.toMatchObject({ present: false })
    const checkCall = sql.mock.calls.find((call) =>
      String(call).includes("from attendance")
    )
    expect(String(checkCall)).toContain("day")
  })

  it("checks presence with timestamp and student", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [eventRowOn(new Date())]
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
      if (q.includes("from events")) return [eventRowOn(new Date())]
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

  it("breaks the report down by day with distinct-student totals", async () => {
    mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("from events")) return [neonEventRow]
      if (q.includes("count(")) return [{ n: 4 }]
      if (q.includes("from attendance"))
        return [
          { srcode: "a", scanned_at: "2026-09-20T00:01:23.000Z", full_name: "A", college: "CICS", program: "BSIT", year_level: "First Year", gender: "Male" },
          { srcode: "b", scanned_at: "2026-09-20T00:02:23.000Z", full_name: "B", college: "CICS", program: "BSCS", year_level: "First Year", gender: "Female" },
          { srcode: "a", scanned_at: "2026-09-21T00:01:23.000Z", full_name: "A", college: "CICS", program: "BSIT", year_level: "First Year", gender: "Male" },
        ]
      throw new Error(`unexpected query: ${q}`)
    })
    const report = await getAttendanceReportNeon("EVT-001")
    expect(report.totalScans).toBe(3)
    expect(report.totalPresent).toBe(2)
    expect(report.totalAbsent).toBe(2)
    expect(report.attendanceRate).toBe(50)
    expect(report.days).toHaveLength(2)
    expect(report.days[0]).toMatchObject({ day: "2026-09-20", present: 2 })
    expect(report.days[1]).toMatchObject({ day: "2026-09-21", present: 1 })
    // Overall groups dedupe by student: A scanned twice but counts once.
    expect(report.byCollege).toEqual({ CICS: 2 })
    expect(report.byProgram).toEqual({ BSIT: 1, BSCS: 1 })
  })
})

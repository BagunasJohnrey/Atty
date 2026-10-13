import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "./route"
import { requireAdmin } from "@/lib/auth/dal"
import { getAttendanceCachedFor, getEventCachedFor } from "@/integration/cached"
import { recordAttendance } from "@/integration/attendance"
import { expireAttendance } from "@/integration/invalidate"
import type { AttendanceRecord } from "@/models/attendance"

vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/integration/cached", () => ({
  getAttendanceCachedFor: vi.fn(),
  getEventCachedFor: vi.fn(),
}))
vi.mock("@/integration/attendance", () => ({ recordAttendance: vi.fn() }))
vi.mock("@/integration/invalidate", () => ({ expireAttendance: vi.fn() }))

const adminMock = vi.mocked(requireAdmin)
const cachedMock = vi.mocked(getAttendanceCachedFor)
const eventMock = vi.mocked(getEventCachedFor)
const recordMock = vi.mocked(recordAttendance)
const expireMock = vi.mocked(expireAttendance)

const rows: AttendanceRecord[] = [
  {
    timestamp: "2026-10-12T15:54:36.688Z",
    srcode: "23-16300",
    name: "BAGUNAS, JOHN REY V.",
    college: "COLLEGE OF INFORMATICS AND COMPUTING SCIENCES",
    program: "BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY",
    yearLevel: "FOURTH YEAR",
    gender: "MALE",
  },
  {
    timestamp: "2026-10-11T15:56:00.000Z",
    srcode: "23-16300",
    name: "BAGUNAS, JOHN REY V.",
    college: "COLLEGE OF INFORMATICS AND COMPUTING SCIENCES",
    program: "BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY",
    yearLevel: "FOURTH YEAR",
    gender: "MALE",
  },
]

function context(eventId: string) {
  return { params: Promise.resolve({ eventId }) }
}

describe("attendance route GET", () => {
  beforeEach(() => {
    adminMock.mockReset()
    cachedMock.mockReset()
    adminMock.mockResolvedValue({ role: "admin" } as never)
    cachedMock.mockResolvedValue(rows)
  })

  it("narrows rows to the requested day", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/events/EVT-001/attendance?day=2026-10-11"
      ),
      context("EVT-001")
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      attendance: AttendanceRecord[]
      total: number
    }
    expect(body.total).toBe(1)
    expect(body.attendance.map((r) => r.timestamp)).toEqual([
      "2026-10-11T15:56:00.000Z",
    ])
  })

  it("returns all rows without a day", async () => {
    const res = await GET(
      new Request("http://localhost/api/events/EVT-001/attendance"),
      context("EVT-001")
    )
    const body = (await res.json()) as { total: number }
    expect(body.total).toBe(2)
  })
})

describe("attendance route POST", () => {
  const openEvent = {
    id: "EVT-001",
    name: "Ascend 2026",
    date: "10/11/2026 - 10/12/2026",
    status: "Active",
    sheetName: "EVT-001",
    location: "Gym",
    description: "",
    orgId: "",
    time: "",
  } as const
  // 23:00 Manila on Oct 11: inside the event's dates.
  const IN_RANGE_NOW = new Date("2026-10-11T15:00:00.000Z").getTime()

  beforeEach(() => {
    adminMock.mockReset()
    recordMock.mockReset()
    expireMock.mockReset()
    eventMock.mockReset()
    adminMock.mockResolvedValue({ role: "admin" } as never)
    eventMock.mockResolvedValue(openEvent as never)
    recordMock.mockResolvedValue({
      timestamp: "2026-09-20T00:01:23.000Z",
      student: { srcode: "26-12345" },
    } as never)
    vi.useFakeTimers()
    vi.setSystemTime(IN_RANGE_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function post(body: object) {
    return POST(
      new Request("http://localhost/api/events/EVT-001/attendance", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context("EVT-001")
    )
  }

  it("records a kiosk scan without a timestamp override", async () => {
    const res = await post({ srcode: "26-12345" })
    expect(res.status).toBe(201)
    expect(recordMock).toHaveBeenCalledWith("EVT-001", "26-12345", undefined)
    expect(expireMock).toHaveBeenCalledWith("EVT-001")
  })

  it("forwards a replay timestamp override", async () => {
    // Noon Manila on Oct 12: inside the event's dates.
    const scannedAt = new Date("2026-10-12T04:00:00.000Z").getTime()
    const res = await post({ srcode: "26-12345", scannedAt })
    expect(res.status).toBe(201)
    expect(recordMock).toHaveBeenCalledWith("EVT-001", "26-12345", scannedAt)
  })

  it("rejects a non-numeric timestamp without recording", async () => {
    const res = await post({ srcode: "26-12345", scannedAt: "yesterday" })
    expect(res.status).toBe(400)
    expect(recordMock).not.toHaveBeenCalled()
  })

  it("refuses a live scan outside the event's dates", async () => {
    // 08:00 Manila on Oct 13: the day after the event ended.
    vi.setSystemTime(new Date("2026-10-13T00:00:00.000Z").getTime())
    const res = await post({ srcode: "26-12345" })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string; message: string }
    expect(body.code).toBe("EVENT_DATE_CLOSED")
    expect(body.message).toContain("Ascend 2026")
    expect(recordMock).not.toHaveBeenCalled()
    expect(expireMock).not.toHaveBeenCalled()
  })

  it("judges a replay by its scan day, not the sync day", async () => {
    // Synced Oct 13, but scanned Oct 12 while the event was open.
    vi.setSystemTime(new Date("2026-10-13T00:00:00.000Z").getTime())
    const scannedAt = new Date("2026-10-12T15:00:00.000Z").getTime()
    const res = await post({ srcode: "26-12345", scannedAt })
    expect(res.status).toBe(201)
    expect(recordMock).toHaveBeenCalledWith("EVT-001", "26-12345", scannedAt)
  })

  it("refuses a replay scanned outside the event's dates", async () => {
    const scannedAt = new Date("2026-10-13T00:00:00.000Z").getTime()
    const res = await post({ srcode: "26-12345", scannedAt })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("EVENT_DATE_CLOSED")
    expect(recordMock).not.toHaveBeenCalled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"
import { requireAdmin } from "@/lib/auth/dal"
import { getEventCachedFor } from "@/integration/cached"
import { checkAttendance } from "@/integration/attendance"

vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/integration/cached", () => ({ getEventCachedFor: vi.fn() }))
vi.mock("@/integration/attendance", () => ({ checkAttendance: vi.fn() }))

const adminMock = vi.mocked(requireAdmin)
const eventMock = vi.mocked(getEventCachedFor)
const checkMock = vi.mocked(checkAttendance)

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

function post(body: object) {
  return POST(
    new Request("http://localhost/api/events/EVT-001/attendance/check", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ eventId: "EVT-001" }) }
  )
}

describe("attendance check route POST", () => {
  beforeEach(() => {
    adminMock.mockReset()
    eventMock.mockReset()
    checkMock.mockReset()
    adminMock.mockResolvedValue({ role: "admin" } as never)
    eventMock.mockResolvedValue(openEvent as never)
    checkMock.mockResolvedValue({ present: false } as never)
    vi.useFakeTimers()
    // 23:00 Manila on Oct 11: inside the event's dates.
    vi.setSystemTime(new Date("2026-10-11T15:00:00.000Z").getTime())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("validates a scan on an event day", async () => {
    const res = await post({ srcode: "26-12345" })
    expect(res.status).toBe(200)
    expect(checkMock).toHaveBeenCalledWith("EVT-001", "26-12345")
  })

  it("refuses validation outside the event's dates", async () => {
    // 08:00 Manila on Oct 13: the day after the event ended.
    vi.setSystemTime(new Date("2026-10-13T00:00:00.000Z").getTime())
    const res = await post({ srcode: "26-12345" })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string; message: string }
    expect(body.code).toBe("EVENT_DATE_CLOSED")
    expect(body.message).toContain("Ascend 2026")
    expect(checkMock).not.toHaveBeenCalled()
  })
})

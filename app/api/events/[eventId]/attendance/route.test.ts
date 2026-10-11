import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"
import { requireAdmin } from "@/lib/auth/dal"
import { recordAttendance } from "@/integration/attendance"
import { expireAttendance } from "@/integration/invalidate"

vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/integration/attendance", () => ({ recordAttendance: vi.fn() }))
vi.mock("@/integration/cached", () => ({ getAttendanceCachedFor: vi.fn() }))
vi.mock("@/integration/invalidate", () => ({ expireAttendance: vi.fn() }))

const adminMock = vi.mocked(requireAdmin)
const recordMock = vi.mocked(recordAttendance)
const expireMock = vi.mocked(expireAttendance)

function context(eventId: string) {
  return { params: Promise.resolve({ eventId }) }
}

function post(body: object) {
  return POST(
    new Request("http://localhost/api/events/EVT-001/attendance", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    context("EVT-001")
  )
}

describe("attendance route POST", () => {
  beforeEach(() => {
    adminMock.mockReset()
    recordMock.mockReset()
    adminMock.mockResolvedValue({ role: "admin" } as never)
    recordMock.mockResolvedValue({
      timestamp: "2026-09-20T00:01:23.000Z",
      student: { srcode: "26-12345" },
    } as never)
  })

  it("records a kiosk scan without a timestamp override", async () => {
    const res = await post({ srcode: "26-12345" })
    expect(res.status).toBe(201)
    expect(recordMock).toHaveBeenCalledWith("EVT-001", "26-12345", undefined)
    expect(expireMock).toHaveBeenCalledWith("EVT-001")
  })

  it("forwards a replay timestamp override", async () => {
    const res = await post({ srcode: "26-12345", scannedAt: 1000 })
    expect(res.status).toBe(201)
    expect(recordMock).toHaveBeenCalledWith("EVT-001", "26-12345", 1000)
  })

  it("rejects a non-numeric timestamp without recording", async () => {
    const res = await post({ srcode: "26-12345", scannedAt: "yesterday" })
    expect(res.status).toBe(400)
    expect(recordMock).not.toHaveBeenCalled()
  })
})

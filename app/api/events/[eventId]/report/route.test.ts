import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"
import { requireAdmin } from "@/lib/auth/dal"
import { getAttendanceReportCachedFor } from "@/integration/cached"

vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/integration/cached", () => ({
  getAttendanceReportCachedFor: vi.fn(),
}))

const adminMock = vi.mocked(requireAdmin)
const reportMock = vi.mocked(getAttendanceReportCachedFor)

function context(eventId: string) {
  return { params: Promise.resolve({ eventId }) }
}

beforeEach(() => {
  adminMock.mockReset()
  reportMock.mockReset()
  adminMock.mockResolvedValue({ role: "admin" } as never)
  reportMock.mockResolvedValue({ totalPresent: 2 } as never)
})

describe("report route GET", () => {
  it("passes parsed facet filters to the cached read", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/events/EVT-001/report?college=CICS&program=BSIT&q=juan&day=2026-10-11"
      ),
      context("EVT-001")
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(reportMock).toHaveBeenCalledWith("EVT-001", {
      college: "cics",
      program: "bsit",
    })
  })

  it("reads the unfiltered report without params", async () => {
    await GET(
      new Request("http://localhost/api/events/EVT-001/report"),
      context("EVT-001")
    )
    expect(reportMock).toHaveBeenCalledWith("EVT-001", {})
  })
})

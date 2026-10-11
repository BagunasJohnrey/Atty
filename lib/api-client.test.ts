import { afterEach, describe, expect, it, vi } from "vitest"
import { exportUrl, listAttendance } from "./api-client"

describe("listAttendance", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch() {
    const urls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            attendance: [],
            total: 0,
            page: 1,
            pageSize: 50,
            pages: 1,
          }),
        }
      })
    )
    return urls
  }

  it("sends the day filter to the API", async () => {
    const urls = stubFetch()
    await listAttendance("EVT-1", { day: "2026-10-11" })
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain("day=2026-10-11")
  })

  it("omits day when unset", async () => {
    const urls = stubFetch()
    await listAttendance("EVT-1", { college: "CICS" })
    expect(urls[0]).not.toContain("day=")
  })
})

describe("exportUrl", () => {
  it("carries the day filter", () => {
    expect(exportUrl("EVT-1", { day: "2026-10-11" })).toContain(
      "day=2026-10-11"
    )
  })

  it("omits day when unset", () => {
    expect(exportUrl("EVT-1", {})).not.toContain("day=")
  })
})

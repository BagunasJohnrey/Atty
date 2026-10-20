import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getAttendanceReport } from "./reports"
import { requestAppsScript } from "./http"
import { getAttendanceReportNeon } from "./neon"

vi.mock("./http", () => ({ requestAppsScript: vi.fn() }))
vi.mock("./neon", () => ({ getAttendanceReportNeon: vi.fn() }))

const requestMock = vi.mocked(requestAppsScript)
const reportMock = vi.mocked(getAttendanceReportNeon)

const report = { totalPresent: 2 }

beforeEach(() => {
  requestMock.mockReset()
  reportMock.mockReset()
  delete process.env.NEON_ATTENDANCE
  requestMock.mockResolvedValue({ success: true, report } as never)
  reportMock.mockResolvedValue(report as never)
})

afterEach(() => {
  delete process.env.NEON_ATTENDANCE
})

describe("report cutover", () => {
  it("reads the report via Apps Script by default", async () => {
    await expect(getAttendanceReport("EVT-001")).resolves.toEqual(report)
    expect(requestMock).toHaveBeenCalledWith("getAttendanceReport", {
      eventId: "EVT-001",
    })
    expect(reportMock).not.toHaveBeenCalled()
  })

  it("reads the report via Neon when flagged", async () => {
    process.env.NEON_ATTENDANCE = "neon"
    await expect(getAttendanceReport("EVT-001")).resolves.toEqual(report)
    expect(reportMock).toHaveBeenCalledWith("EVT-001", {})
    expect(requestMock).not.toHaveBeenCalled()
  })
})

describe("report facet filters", () => {
  it("forwards normalized facets to Apps Script", async () => {
    await getAttendanceReport("EVT-001", {
      college: " CICS ",
      program: "BSIT",
      yearLevel: "",
      gender: "Male",
    })
    expect(requestMock).toHaveBeenCalledWith("getAttendanceReport", {
      eventId: "EVT-001",
      college: "cics",
      program: "bsit",
      gender: "male",
    })
  })

  it("forwards normalized facets to Neon", async () => {
    process.env.NEON_ATTENDANCE = "neon"
    await getAttendanceReport("EVT-001", { college: "CICS" })
    expect(reportMock).toHaveBeenCalledWith("EVT-001", { college: "cics" })
  })
})

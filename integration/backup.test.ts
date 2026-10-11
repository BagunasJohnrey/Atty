import { beforeEach, describe, expect, it, vi } from "vitest"
import { backupAllToSheets, backupAttendanceToSheets } from "./backup"
import { requestAppsScript } from "./http"
import { fetchAttendanceNeon, fetchEventsNeon } from "./neon"

vi.mock("./http", () => ({ requestAppsScript: vi.fn() }))
vi.mock("./neon", () => ({
  fetchAttendanceNeon: vi.fn(),
  fetchEventsNeon: vi.fn(),
}))

const requestMock = vi.mocked(requestAppsScript)
const eventsMock = vi.mocked(fetchEventsNeon)
const attendanceMock = vi.mocked(fetchAttendanceNeon)

const neonEvents = [
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
]

const tableReport = { inserted: 1, updated: 0, untouched: 0, sheetOnly: 0 }

beforeEach(() => {
  requestMock.mockReset()
  eventsMock.mockReset()
  attendanceMock.mockReset()
  requestMock.mockResolvedValue({ success: true, report: tableReport } as never)
})

describe("backup orchestrator", () => {
  it("backs every event's attendance after the events table", async () => {
    eventsMock.mockResolvedValue(neonEvents)
    attendanceMock.mockResolvedValue([
      { srcode: "26-12345", scannedAt: "2026-09-20T00:01:23.000Z" },
    ])
    const summary = await backupAllToSheets()
    expect(requestMock).toHaveBeenCalledWith(
      "backupEvents",
      expect.objectContaining({ events: expect.any(Array) })
    )
    expect(attendanceMock).toHaveBeenCalledWith("EVT-001")
    expect(requestMock).toHaveBeenCalledWith(
      "backupAttendance",
      expect.objectContaining({ eventId: "EVT-001" })
    )
    expect(summary.events).toEqual(tableReport)
    expect(summary.perEvent["EVT-001"]).toEqual(tableReport)
    expect(summary.errors).toEqual([])
  })

  it("collects one event's failure and continues with the rest", async () => {
    eventsMock.mockResolvedValue([
      ...neonEvents,
      { ...neonEvents[0], id: "EVT-002", sheet_name: "EVT-002" },
    ])
    attendanceMock.mockRejectedValueOnce(new Error("boom"))
    attendanceMock.mockResolvedValueOnce([])
    requestMock.mockResolvedValueOnce({
      success: true,
      report: tableReport,
    } as never)
    requestMock.mockResolvedValueOnce({
      success: true,
      report: { ...tableReport, skipped: true },
    } as never)
    const summary = await backupAllToSheets()
    expect(summary.perEvent["EVT-001"]).toBeUndefined()
    expect(summary.errors).toEqual([{ eventId: "EVT-001", message: "boom" }])
    expect(summary.perEvent["EVT-002"]).toEqual(
      expect.objectContaining({ skipped: true })
    )
  })

  it("sends a single event's rows on demand", async () => {
    const report = await backupAttendanceToSheets("EVT-009", [
      { srcode: "26-1", scannedAt: "2026-01-01T00:00:00.000Z" },
    ])
    expect(requestMock).toHaveBeenCalledWith("backupAttendance", {
      eventId: "EVT-009",
      rows: [{ srcode: "26-1", scannedAt: "2026-01-01T00:00:00.000Z" }],
    })
    expect(report).toEqual(tableReport)
  })
})

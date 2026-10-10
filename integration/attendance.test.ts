import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkAttendance, getAttendance, recordAttendance } from "./attendance"
import { requestAppsScript } from "./http"
import {
  checkAttendanceNeon,
  listAttendanceNeon,
  recordAttendanceNeon,
} from "./neon"

vi.mock("./http", () => ({ requestAppsScript: vi.fn() }))
vi.mock("./neon", () => ({
  checkAttendanceNeon: vi.fn(),
  listAttendanceNeon: vi.fn(),
  recordAttendanceNeon: vi.fn(),
}))

const requestMock = vi.mocked(requestAppsScript)
const neonMocks = {
  record: vi.mocked(recordAttendanceNeon),
  check: vi.mocked(checkAttendanceNeon),
  list: vi.mocked(listAttendanceNeon),
}

const recorded = {
  timestamp: "2026-09-20T00:01:23.000Z",
  student: { srcode: "26-12345" },
}

beforeEach(() => {
  requestMock.mockReset()
  Object.values(neonMocks).forEach((m) => m.mockReset())
  delete process.env.NEON_ATTENDANCE
  requestMock.mockResolvedValue({ success: true, ...recorded } as never)
})

afterEach(() => {
  delete process.env.NEON_ATTENDANCE
})

describe("attendance script path", () => {
  it("records via Apps Script by default", async () => {
    await recordAttendance("EVT-001", "26-12345")
    expect(requestMock).toHaveBeenCalledWith("recordAttendance", {
      eventId: "EVT-001",
      srcode: "26-12345",
    })
    expect(neonMocks.record).not.toHaveBeenCalled()
  })
})

describe("attendance cutover", () => {
  beforeEach(() => {
    process.env.NEON_ATTENDANCE = "neon"
    neonMocks.record.mockResolvedValue(recorded as never)
    neonMocks.check.mockResolvedValue({ present: true } as never)
    neonMocks.list.mockResolvedValue([])
  })

  it("records via Neon when flagged", async () => {
    await expect(
      recordAttendance("EVT-001", "26-12345")
    ).resolves.toEqual(recorded)
    expect(neonMocks.record).toHaveBeenCalledWith("EVT-001", "26-12345")
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("checks via Neon when flagged", async () => {
    await checkAttendance("EVT-001", "26-12345")
    expect(neonMocks.check).toHaveBeenCalledWith("EVT-001", "26-12345")
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("lists via Neon when flagged", async () => {
    await getAttendance("EVT-001")
    expect(neonMocks.list).toHaveBeenCalledWith("EVT-001")
    expect(requestMock).not.toHaveBeenCalled()
  })
})

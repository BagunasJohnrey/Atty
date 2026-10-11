/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AttendanceTable } from "./AttendanceTable"
import { useAttendance } from "@/hooks/useQueries"
import type { AttendanceRecord } from "@/models/attendance"

vi.mock("@/hooks/useQueries", () => ({ useAttendance: vi.fn() }))

let searchQuery = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchQuery),
}))

const attendanceMock = vi.mocked(useAttendance)

function record(srcode: string, name: string): AttendanceRecord {
  return {
    timestamp: "2026-10-12T15:54:36.688Z",
    srcode,
    name,
    college: "CICS",
    program: "BSIT",
    yearLevel: "First Year",
    gender: "Male",
  }
}

function mockPage(
  records: AttendanceRecord[],
  overrides?: { page?: number; pages?: number; total?: number }
) {
  const page = overrides?.page ?? 1
  const pages = overrides?.pages ?? 1
  attendanceMock.mockReturnValue({
    data: {
      success: true,
      attendance: records,
      total: overrides?.total ?? records.length,
      page,
      pageSize: 50,
      pages,
    },
    error: null,
    loading: false,
    fromSnapshot: false,
    savedAt: null,
  } as never)
}

describe("AttendanceTable", () => {
  afterEach(() => {
    cleanup()
    searchQuery = ""
    vi.clearAllMocks()
  })

  it("renders a row per fetched record", () => {
    mockPage([
      record("26-10001", "Student One"),
      record("26-10002", "Student Two"),
    ])
    render(<AttendanceTable eventId="EVT-1" filters={{}} />)
    expect(screen.getByRole("row", { name: /Student One/ })).toBeTruthy()
    expect(screen.getByRole("row", { name: /Student Two/ })).toBeTruthy()
  })

  it("shows the empty state when the page is empty", () => {
    mockPage([])
    render(<AttendanceTable eventId="EVT-1" filters={{}} />)
    expect(screen.getByText("No attendance records yet.")).toBeTruthy()
  })

  it("sends the live URL day filter even when the server prop is empty", () => {
    searchQuery = "day=2026-10-12"
    mockPage([record("26-10001", "Student One")])
    render(<AttendanceTable eventId="EVT-1" filters={{}} />)
    const sent = attendanceMock.mock.calls[0][1] as { day?: string }
    expect(sent.day).toBe("2026-10-12")
  })

  it("drops a cleared day filter instead of reusing the stale server prop", () => {
    searchQuery = ""
    mockPage([record("26-10001", "Student One")])
    render(
      <AttendanceTable eventId="EVT-1" filters={{ day: "2026-10-12" }} />
    )
    const sent = attendanceMock.mock.calls[0][1] as { day?: string }
    expect(sent.day).toBeUndefined()
  })

  it("requests the next page when Next is pressed", () => {
    mockPage([record("26-10001", "Student One")], { pages: 2, total: 51 })
    render(<AttendanceTable eventId="EVT-1" filters={{}} />)
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    const last = attendanceMock.mock.calls[attendanceMock.mock.calls.length - 1]
    expect(last[2]).toBe(2)
  })
})

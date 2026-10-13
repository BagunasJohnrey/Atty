/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReportSummary } from "./ReportSummary"
import { useReport } from "@/hooks/useQueries"
import type { AttendanceReport } from "@/models/report"

vi.mock("@/hooks/useQueries", () => ({ useReport: vi.fn() }))

let searchQuery = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchQuery),
}))

const day = (
  day: string,
  present: number,
  absent: number
): AttendanceReport["days"][number] => ({
  day,
  present,
  absent,
  rate: 50,
  byCollege: {},
  byProgram: {},
  byYearLevel: {},
  byGender: {},
})

const report: AttendanceReport = {
  event: {
    id: "EVT-001",
    name: "Orientation",
    date: "10/10/2026 - 10/11/2026",
    status: "Active",
    sheetName: "EVT-001",
    location: "Gym",
    description: "Welcome.",
    orgId: "ORG-001",
    time: "",
  },
  totalStudents: 3,
  totalPresent: 2,
  totalAbsent: 1,
  attendanceRate: 66.7,
  totalScans: 3,
  byCollege: { CICS: 3 },
  byProgram: {},
  byYearLevel: {},
  byGender: {},
  days: [day("2026-10-10", 2, 1), day("2026-10-11", 1, 2)],
}

function mockReport(value: AttendanceReport) {
  vi.mocked(useReport).mockReturnValue({
    data: { report: value },
    error: null,
    loading: false,
  } as never)
}

describe("ReportSummary", () => {
  afterEach(() => {
    cleanup()
    searchQuery = ""
    vi.clearAllMocks()
  })

  it("renders one section per day plus the overall summary", () => {
    mockReport(report)
    render(<ReportSummary eventId="EVT-001" />)
    expect(screen.getByText("2026-10-10")).toBeTruthy()
    expect(screen.getByText("2026-10-11")).toBeTruthy()
    expect(screen.getByText("Scans")).toBeTruthy()
  })

  it("renders a single section exactly like today for one-day events", () => {
    mockReport({ ...report, totalScans: 2, days: [day("2026-10-10", 2, 1)] })
    render(<ReportSummary eventId="EVT-001" />)
    expect(screen.getByText("2026-10-10")).toBeTruthy()
    expect(screen.queryByText("2026-10-11")).toBeNull()
  })

  it("survives a cached pre-upgrade report with no day sections", () => {
    const legacy = { ...report, days: undefined, totalScans: undefined }
    mockReport(legacy as unknown as AttendanceReport)
    render(<ReportSummary eventId="EVT-001" />)
    expect(screen.getByText("Present")).toBeTruthy()
    expect(screen.queryByText("2026-10-10")).toBeNull()
  })
})

describe("ReportSummary day filter", () => {
  afterEach(() => {
    cleanup()
    searchQuery = ""
    vi.clearAllMocks()
  })

  it("narrows tiles and sections to the picked day", () => {
    searchQuery = "day=2026-10-11"
    mockReport(report)
    render(<ReportSummary eventId="EVT-001" />)
    // The other day's section is gone (the picked day also shows in the
    // header picker, so only absence is asserted by text).
    expect(screen.queryByText("2026-10-10")).toBeNull()
    expect(screen.getAllByText("2026-10-11").length).toBeGreaterThan(0)
  })

  it("explains an unknown day instead of showing stale totals", () => {
    searchQuery = "day=2026-10-12"
    mockReport(report)
    render(<ReportSummary eventId="EVT-001" />)
    expect(screen.getByText(/no attendance recorded on/i)).toBeTruthy()
  })
})

/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CheckInForm } from "./CheckInForm"
import { checkAttendance, recordAttendance } from "@/lib/api-client"
import { resetSharedOfflineForTests } from "@/lib/offline/shared"

vi.mock("@/lib/api-client", () => ({
  checkAttendance: vi.fn(),
  recordAttendance: vi.fn(),
  ApiError: class ApiError extends Error {
    code: string
    status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.name = "ApiError"
      this.code = code
      this.status = status
    }
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const STUDENT = {
  srcode: "26-00001",
  name: "Juan Dela Cruz",
  college: "Engineering",
  program: "BS Computer Engineering",
  yearLevel: "3rd Year",
  gender: "Male",
}

function mockSuccessfulCheck() {
  vi.mocked(checkAttendance).mockResolvedValue({
    success: true,
    check: { present: false, student: STUDENT },
  })
}

function mockSuccessfulRecord() {
  vi.mocked(recordAttendance).mockResolvedValue({
    success: true,
    student: STUDENT,
    timestamp: "2026-10-11T08:00:00+08:00",
  })
}

async function validateScan() {
  fireEvent.change(screen.getByLabelText("Enter SR Code"), {
    target: { value: "26-00001" },
  })
  fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe("CheckInForm auto-dismiss", () => {
  beforeEach(() => {
    resetSharedOfflineForTests()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("fades out and clears the confirmed card within 5 seconds", async () => {
    mockSuccessfulCheck()
    mockSuccessfulRecord()
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    await validateScan()
    expect(screen.getByText("Attendance Confirmed.")).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5300)
    })
    expect(screen.queryByText("Attendance Confirmed.")).toBeNull()
  })

  it("fades out and clears the duplicate card within 5 seconds", async () => {
    vi.mocked(checkAttendance).mockResolvedValue({
      success: true,
      check: {
        present: true,
        student: STUDENT,
        timestamp: "2026-10-11T08:00:00+08:00",
      },
    })
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    await validateScan()
    expect(screen.getByText("Attendance already recorded today.")).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5300)
    })
    expect(screen.queryByText("Attendance already recorded today.")).toBeNull()
  })

  it("fades out and clears the queued card within 5 seconds", async () => {
    vi.mocked(checkAttendance).mockRejectedValue(new TypeError("offline"))
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    await validateScan()
    expect(screen.getByText(/recorded successfully/i).textContent).toContain(
      "It will sync automatically"
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5300)
    })
    expect(screen.queryByText(/recorded successfully/i)).toBeNull()
  })

  it("restarts the clock when a new scan lands before dismissal", async () => {
    mockSuccessfulCheck()
    mockSuccessfulRecord()
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    await validateScan()
    expect(screen.getByText("Attendance Confirmed.")).toBeTruthy()
    // 3s in, a new scan replaces the result with a fresh done card.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await validateScan()
    expect(screen.getByText("Attendance Confirmed.")).toBeTruthy()
    // The fresh card gets its own full 5s before clearing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(screen.getByText("Attendance Confirmed.")).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2300)
    })
    expect(screen.queryByText("Attendance Confirmed.")).toBeNull()
  })
})

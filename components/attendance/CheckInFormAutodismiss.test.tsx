/**
 * @vitest-environment jsdom
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
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
  fireEvent.click(screen.getByRole("button", { name: /validate sr code/i }))
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
    fireEvent.click(screen.getByRole("button", { name: /confirm attendance/i }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
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
    expect(
      screen.getByText("Attendance already recorded for this event.")
    ).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5300)
    })
    expect(
      screen.queryByText("Attendance already recorded for this event.")
    ).toBeNull()
  })

  it("fades out and clears the queued card within 5 seconds", async () => {
    vi.mocked(checkAttendance).mockRejectedValue(new TypeError("offline"))
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    await validateScan()
    expect(screen.getByText(/queued/i).textContent).toContain("Queued")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5300)
    })
    expect(screen.queryByText(/queued/i)).toBeNull()
  })

  it("leaves the pre-confirm card up until the user acts", async () => {
    mockSuccessfulCheck()
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    await validateScan()
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
    })
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /confirm attendance/i })
    ).toBeTruthy()
  })

  it("restarts the clock when a new scan lands before dismissal", async () => {
    mockSuccessfulCheck()
    mockSuccessfulRecord()
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    await validateScan()
    fireEvent.click(screen.getByRole("button", { name: /confirm attendance/i }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText("Attendance Confirmed.")).toBeTruthy()
    // 3s in, a new scan replaces the result with a fresh confirm card.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await validateScan()
    expect(screen.queryByText("Attendance Confirmed.")).toBeNull()
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy()
    // The fresh confirm card also waits on the user, not the timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
    })
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy()
  })
})

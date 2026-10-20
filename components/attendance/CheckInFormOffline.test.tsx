/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CheckInForm } from "./CheckInForm"
import { ApiError, checkAttendance, recordAttendance } from "@/lib/api-client"
import {
  getSharedQueue,
  resetSharedOfflineForTests,
} from "@/lib/offline/shared"

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

describe("CheckInForm offline", () => {
  beforeEach(() => {
    resetSharedOfflineForTests()
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it("queues a valid scan instead of erroring on network failure", async () => {
    vi.mocked(checkAttendance).mockRejectedValue(new TypeError("offline"))
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    fireEvent.change(screen.getByLabelText("Enter SR Code"), {
      target: { value: "26-00001" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }))
    await waitFor(() => {
      expect(screen.getByText(/recorded successfully/i).textContent).toContain(
        "It will sync automatically"
      )
    })
    expect(checkAttendance).toHaveBeenCalledTimes(1)
    expect(recordAttendance).not.toHaveBeenCalled()
  })

  it("records immediately after successful verification", async () => {
    vi.mocked(checkAttendance).mockResolvedValue({
      success: true,
      check: {
        present: false,
        student: {
          srcode: "26-00001",
          name: "Juan Dela Cruz",
          college: "Engineering",
          program: "BS Computer Engineering",
          yearLevel: "3rd Year",
          gender: "Male",
        },
      },
    })
    vi.mocked(recordAttendance).mockResolvedValue({
      success: true,
      student: {
        srcode: "26-00001",
        name: "Juan Dela Cruz",
        college: "Engineering",
        program: "BS Computer Engineering",
        yearLevel: "3rd Year",
        gender: "Male",
      },
      timestamp: "2026-10-11T08:00:00+08:00",
    })
    render(
      <CheckInForm eventId="EVT-ONLINE-1" eventName="E" eventActive={true} />
    )
    fireEvent.change(screen.getByLabelText("Enter SR Code"), {
      target: { value: "26-00001" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }))
    await waitFor(() => {
      expect(screen.getByText("Attendance Confirmed.")).toBeTruthy()
    })
    expect(recordAttendance).toHaveBeenCalledTimes(1)
    expect(recordAttendance).toHaveBeenCalledWith("EVT-ONLINE-1", "26-00001")
    expect(screen.queryByText(/queued/i)).toBeNull()
    await expect(getSharedQueue().pendingCount("EVT-ONLINE-1")).resolves.toBe(0)
  })

  it("shows the error alert and queues nothing on SRCODE_NOT_FOUND", async () => {
    vi.mocked(checkAttendance).mockRejectedValue(
      new ApiError("SRCODE_NOT_FOUND", "Student not found.", 404)
    )
    render(
      <CheckInForm eventId="EVT-ONLINE-2" eventName="E" eventActive={true} />
    )
    fireEvent.change(screen.getByLabelText("Enter SR Code"), {
      target: { value: "26-00001" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }))
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Invalid SR Code")
    })
    expect(screen.queryByText(/queued/i)).toBeNull()
    expect(recordAttendance).not.toHaveBeenCalled()
    await expect(getSharedQueue().pendingCount("EVT-ONLINE-2")).resolves.toBe(0)
  })

  it("queues the scan when recording fails offline", async () => {
    vi.mocked(checkAttendance).mockResolvedValue({
      success: true,
      check: {
        present: false,
        student: {
          srcode: "26-00001",
          name: "Juan Dela Cruz",
          college: "Engineering",
          program: "BS Computer Engineering",
          yearLevel: "3rd Year",
          gender: "Male",
        },
      },
    })
    vi.mocked(recordAttendance).mockRejectedValue(new TypeError("offline"))
    render(
      <CheckInForm eventId="EVT-CONF-1" eventName="E" eventActive={true} />
    )
    fireEvent.change(screen.getByLabelText("Enter SR Code"), {
      target: { value: "26-00001" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }))
    await waitFor(() => {
      expect(screen.getByText(/recorded successfully/i).textContent).toContain(
        "It will sync automatically"
      )
    })
    // Verify passed, so the single tap recorded: the server call was
    // attempted once and failed; the scan is queued.
    expect(recordAttendance).toHaveBeenCalledTimes(1)
    await expect(getSharedQueue().pendingCount("EVT-CONF-1")).resolves.toBe(1)
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

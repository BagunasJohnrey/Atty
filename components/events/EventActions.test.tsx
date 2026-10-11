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
import { EventActions } from "./EventActions"
import { closeEvent, deleteEvent, openEvent } from "@/lib/api-client"
import type { SchoolEvent } from "@/models/event"

vi.mock("@/lib/api-client", () => ({
  closeEvent: vi.fn(),
  deleteEvent: vi.fn(),
  openEvent: vi.fn(),
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

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}))

const successMock = vi.fn()
const errorMock = vi.fn()
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: successMock, error: errorMock }),
}))
vi.mock("@/hooks/useCached", () => ({ invalidatePrefix: vi.fn() }))

const event: SchoolEvent = {
  id: "EVT-001",
  name: "Orientation",
  date: "09/20/2026",
  status: "Upcoming",
  sheetName: "EVT-001",
  location: "Gym",
  description: "Welcome.",
  orgId: "ORG-001",
  time: "",
}

describe("EventActions delete", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it("asks in a modal, then deletes and leaves for the list", async () => {
    vi.mocked(deleteEvent).mockResolvedValue({ success: true } as never)
    render(<EventActions event={event} />)
    fireEvent.click(screen.getByRole("button", { name: /^delete event$/i }))
    // The trigger only opens the modal — nothing is deleted yet.
    expect(deleteEvent).not.toHaveBeenCalled()
    expect(
      screen.getByRole("heading", { name: "Delete event?" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(() => {
      expect(deleteEvent).toHaveBeenCalledWith("EVT-001")
    })
    expect(successMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith("/events")
    expect(refreshMock).not.toHaveBeenCalled()
    expect(openEvent).not.toHaveBeenCalled()
    expect(closeEvent).not.toHaveBeenCalled()
  })

  it("cancels the modal without deleting", async () => {
    render(<EventActions event={event} />)
    fireEvent.click(screen.getByRole("button", { name: /^delete event$/i }))
    fireEvent.click(screen.getByRole("button", { name: "Keep" }))
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Delete event?" })
      ).toBeNull()
    })
    expect(deleteEvent).not.toHaveBeenCalled()
  })

  it("surfaces a delete failure without leaving the page", async () => {
    vi.mocked(deleteEvent).mockRejectedValue(new Error("nope"))
    render(<EventActions event={event} />)
    fireEvent.click(screen.getByRole("button", { name: /^delete event$/i }))
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledTimes(1)
    })
    expect(pushMock).not.toHaveBeenCalled()
  })
})

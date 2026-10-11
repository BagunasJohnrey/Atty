import { beforeEach, describe, expect, it, vi } from "vitest"
import { DELETE } from "./route"
import { requireAdmin } from "@/lib/auth/dal"
import { deleteEvent } from "@/integration/events"
import { expireEvent } from "@/integration/invalidate"
import { HttpError } from "@/lib/api"
import type { SchoolEvent } from "@/models/event"

vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/integration/events", () => ({
  closeEvent: vi.fn(),
  deleteEvent: vi.fn(),
  updateEvent: vi.fn(),
}))
vi.mock("@/integration/cached", () => ({ getEventCachedFor: vi.fn() }))
vi.mock("@/integration/invalidate", () => ({ expireEvent: vi.fn() }))

const adminMock = vi.mocked(requireAdmin)
const deleteMock = vi.mocked(deleteEvent)
const expireMock = vi.mocked(expireEvent)

const removed: SchoolEvent = {
  id: "EVT-001",
  name: "Orientation",
  date: "09/20/2026",
  status: "Closed",
  sheetName: "EVT-001",
  location: "Gym",
  description: "Done.",
  orgId: "ORG-001",
  time: "",
}

function context(eventId: string) {
  return { params: Promise.resolve({ eventId }) }
}

describe("event route DELETE", () => {
  beforeEach(() => {
    adminMock.mockReset()
    deleteMock.mockReset()
    expireMock.mockReset()
    adminMock.mockResolvedValue({ role: "admin" } as never)
    deleteMock.mockResolvedValue(removed)
  })

  it("deletes the event and expires its cache", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/events/EVT-001", { method: "DELETE" }),
      context("EVT-001")
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(deleteMock).toHaveBeenCalledWith("EVT-001")
    expect(expireMock).toHaveBeenCalledWith("EVT-001")
  })

  it("rejects a non-admin DELETE with 401 without deleting", async () => {
    adminMock.mockRejectedValue(
      new HttpError(401, "UNAUTHORIZED", "Authentication required.")
    )
    const res = await DELETE(
      new Request("http://localhost/api/events/EVT-001", { method: "DELETE" }),
      context("EVT-001")
    )
    expect(res.status).toBe(401)
    expect(deleteMock).not.toHaveBeenCalled()
  })
})

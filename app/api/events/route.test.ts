import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"
import { requireAdmin } from "@/lib/auth/dal"
import { createEvent } from "@/integration/events"

vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/integration/events", () => ({ createEvent: vi.fn() }))
vi.mock("@/integration/cached", () => ({ getEventsCached: vi.fn() }))
vi.mock("@/integration/invalidate", () => ({ expireEvents: vi.fn() }))

const adminMock = vi.mocked(requireAdmin)
const createMock = vi.mocked(createEvent)

function post(body: object): Promise<Response> {
  return POST(
    new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify(body),
    })
  )
}

describe("events route", () => {
  beforeEach(() => {
    adminMock.mockReset()
    createMock.mockReset()
    adminMock.mockResolvedValue({ role: "admin" } as never)
  })

  it("creates an event carrying the description", async () => {
    createMock.mockResolvedValue({ id: "EVT-001" } as never)
    const res = await post({
      name: "Science Fair",
      date: "2026-11-15",
      description: "Annual fair.",
    })
    expect(res.status).toBe(201)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0][0]).toMatchObject({
      description: "Annual fair.",
    })
  })

  it("rejects a create with no description without writing", async () => {
    const res = await post({ name: "Science Fair", date: "2026-11-15" })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("rejects a blank description without writing", async () => {
    const res = await post({
      name: "Science Fair",
      date: "2026-11-15",
      description: "   ",
    })
    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "./route"
import { requireAdmin } from "@/lib/auth/dal"
import { backupAllToSheets } from "@/integration/backup"
import { HttpError } from "@/lib/api"

vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/integration/backup", () => ({ backupAllToSheets: vi.fn() }))

const adminMock = vi.mocked(requireAdmin)
const backupMock = vi.mocked(backupAllToSheets)

const summary = {
  events: { inserted: 0, updated: 0, untouched: 7, sheetOnly: 0 },
  perEvent: {},
  errors: [],
}

const OLD_CRON = process.env.CRON_SECRET

beforeEach(() => {
  adminMock.mockReset()
  backupMock.mockReset()
  backupMock.mockResolvedValue(summary)
  process.env.CRON_SECRET = "test-cron-secret"
})

describe("admin backup route", () => {
  it("runs the backup for an admin POST", async () => {
    adminMock.mockResolvedValue({ role: "admin" } as never)
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, summary })
    expect(adminMock).toHaveBeenCalledTimes(1)
  })

  it("rejects a non-admin POST with 401", async () => {
    adminMock.mockRejectedValue(
      new HttpError(401, "UNAUTHORIZED", "Authentication required.")
    )
    const res = await POST()
    expect(res.status).toBe(401)
    expect(backupMock).not.toHaveBeenCalled()
  })

  it("runs the backup for a correct cron GET", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/backup", {
        headers: { authorization: "Bearer test-cron-secret" },
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(adminMock).not.toHaveBeenCalled()
  })

  it("rejects a wrong cron secret with 401", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/backup", {
        headers: { authorization: "Bearer wrong" },
      })
    )
    expect(res.status).toBe(401)
    expect(backupMock).not.toHaveBeenCalled()
  })

  it("fails closed when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET
    try {
      const res = await GET(
        new Request("http://localhost/api/admin/backup", {
          headers: { authorization: "Bearer anything" },
        })
      )
      expect(res.status).toBe(401)
      expect(backupMock).not.toHaveBeenCalled()
    } finally {
      process.env.CRON_SECRET = OLD_CRON
    }
  })
})

import { describe, expect, it } from "vitest"
import { EVENT_HEADERS, loadScripts, ORG_HEADERS } from "./script-harness"

/**
 * Exercises the real `.gs` sources through the shared fake Sheets harness.
 *
 * Covers the Organizations registry — sequencing, partial updates, the
 * not-found path — and the two event fields that reference it.
 */

describe("organizations registry", () => {
  it("lists every organization row", () => {
    const all = loadScripts().api.Organizations.all()
    expect(all).toHaveLength(2)
    expect(all[0].id).toBe("ORG-001")
    expect(all[0].name).toBe("Batangas State University")
  })

  it("maps every contact column", () => {
    const org = loadScripts().api.Organizations.getById("ORG-001")
    expect(org.email).toBe("sscbalayan@g.batstate-u.edu.ph")
    expect(org.address).toBe("Caloocan, Balayan, Batangas, Philippines 4213")
    expect(org.phone).toBe("(+63 43) 980-0385 local 6101")
    expect(org.website).toBe("http://www.batstate-u.edu.ph")
  })

  it("returns an empty list when the sheet does not exist yet", () => {
    // A fresh spreadsheet has no Organizations tab; a read must not throw.
    const h = loadScripts({ organizations: [] })
    h.api.SpreadsheetApp.getActiveSpreadsheet = () => ({
      getSheetByName: () => null,
      insertSheet: () => {
        throw new Error("insertSheet must not be called on a read")
      },
    })
    expect(h.api.Organizations.all()).toEqual([])
  })

  it("creates an organization with the next sequential ID", () => {
    const h = loadScripts()
    const org = createOrg(h, "Nueva Eatry", "nueva@example.edu")
    expect(org.id).toBe("ORG-003")
    expect(org.name).toBe("Nueva Eatry")
    expect(h.rows("Organizations")).toHaveLength(4)
  })

  it("defaults missing optional contact fields to empty strings", () => {
    const org = createOrg(loadScripts(), "Bare Org")
    expect(org.email).toBe("")
    expect(org.address).toBe("")
    expect(org.phone).toBe("")
    expect(org.website).toBe("")
  })

  it("pads the first organization ID to three digits", () => {
    const h = loadScripts({ organizations: [ORG_HEADERS] })
    expect(createOrg(h, "First Org").id).toBe("ORG-001")
  })

  it("rejects a name longer than the configured maximum", () => {
    expect(codeOf(() =>
      loadScripts().api.Organizations.handleCreate({ name: "x".repeat(151) })
    )).toBe("INVALID_REQUEST")
  })

  it("patches only the fields present in the update", () => {
    const org = loadScripts().api.Organizations.update("ORG-001", {
      email: "new@example.edu",
    })
    expect(org.email).toBe("new@example.edu")
    // Untouched fields keep their values.
    expect(org.name).toBe("Batangas State University")
    expect(org.website).toBe("http://www.batstate-u.edu.ph")
  })

  it("writes the update to the sheet, not just the returned object", () => {
    const h = loadScripts()
    h.api.Organizations.update("ORG-001", { phone: "+63 43 555 0100" })
    expect(h.rows("Organizations")[1][4]).toBe("+63 43 555 0100")
  })

  it("throws ORG_NOT_FOUND for an unknown ID", () => {
    expect(
      codeOf(() => loadScripts().api.Organizations.assertById("ORG-999"))
    ).toBe("ORG_NOT_FOUND")
  })

  it("wraps list and get results in the standard success envelope", () => {
    const api = loadScripts().api
    const list = api.Organizations.handleList()
    expect(list.success).toBe(true)
    expect(list.organizations).toHaveLength(2)

    const one = api.Organizations.handleGet({ orgId: "ORG-002" })
    expect(one.success).toBe(true)
    expect(one.organization.id).toBe("ORG-002")
  })
})

describe("events carry an organization and a time range", () => {
  it("reads orgId and time off the event row", () => {
    const event = loadScripts().api.Events.getById("EVT-001")
    expect(event.orgId).toBe("ORG-001")
    expect(event.time).toBe("12:00 pm - 5:00 pm")
  })

  it("yields empty strings for a pre-migration event row", () => {
    // A sheet written before the two columns were appended has shorter rows.
    const h = loadScripts({
      events: [
        EVENT_HEADERS.slice(0, 7),
        ["EVT-001", "Legacy", "09/20/2026", "Active", "EVT-001", "Gym", ""],
      ],
    })
    const event = h.api.Events.getById("EVT-001")
    expect(event.orgId).toBe("")
    expect(event.time).toBe("")
  })

  it("stores the time range verbatim", () => {
    const created = loadScripts().api.Events.create(
      "Council Night",
      "10/05/2026",
      "Hall",
      "",
      "ORG-002",
      "5:30 pm - 8:00 pm"
    )
    expect(created.time).toBe("5:30 pm - 8:00 pm")
    expect(created.orgId).toBe("ORG-002")
  })

  it("accepts a create with no organization at all", () => {
    const created = loadScripts().api.Events.create(
      "Open House",
      "10/06/2026",
      "",
      "",
      "",
      ""
    )
    expect(created.orgId).toBe("")
  })

  it("rejects a create naming an organization that does not exist", () => {
    const h = loadScripts()
    expect(
      codeOf(() =>
        h.api.Events.create("Bad Org", "10/07/2026", "", "", "ORG-999", "")
      )
    ).toBe("ORG_NOT_FOUND")
    // Rejected before anything was written, so no orphan attendance sheet.
    expect(h.api.Events.all()).toHaveLength(1)
    expect(h.api.Sheets.sheetByName("EVT-002")).toBeNull()
  })

  it("patches orgId and time on an existing event", () => {
    const event = loadScripts().api.Events.update("EVT-001", {
      time: "1:00 pm - 4:00 pm",
      orgId: "ORG-002",
    })
    expect(event.time).toBe("1:00 pm - 4:00 pm")
    expect(event.orgId).toBe("ORG-002")
  })

  it("rejects a patch naming an organization that does not exist", () => {
    expect(
      codeOf(() =>
        loadScripts().api.Events.update("EVT-001", { orgId: "ORG-999" })
      )
    ).toBe("ORG_NOT_FOUND")
  })

  it("rejects unknown fields on an update", () => {
    expect(
      codeOf(() =>
        loadScripts().api.Events.handleUpdate({
          eventId: "EVT-001",
          nonsense: "x",
        })
      )
    ).toBe("INVALID_REQUEST")
  })
})

describe("organizations soft delete", () => {
  /** Seeds a third organization that is already soft-deleted. */
  function withDeleted(): ReturnType<typeof loadScripts> {
    return loadScripts({
      organizations: [
        ORG_HEADERS,
        ["ORG-001", "Batangas State University", "a@b.edu", "1 St", "+63 43", "https://b.edu", ""],
        ["ORG-002", "Nueva Eatry", "", "", "", "", "10/01/2026 09:15:00"],
        ["ORG-003", "Still Open", "", "", "", "", ""],
      ],
    })
  }

  it("excludes soft-deleted organizations from the list", () => {
    const ids = withDeleted().api.Organizations.all().map((o: { id: string }) => o.id)
    expect(ids).toEqual(["ORG-001", "ORG-003"])
  })

  it("treats any non-empty Deleted cell as deleted", () => {
    // Sheets may coerce a timestamp to a number; truthiness is the test, not
    // the type.
    const h = loadScripts({
      organizations: [
        ORG_HEADERS,
        ["ORG-001", "Coerced", "", "", "", "", 45123],
      ],
    })
    expect(h.api.Organizations.all()).toEqual([])
  })

  it("still resolves a soft-deleted organization by id", () => {
    // The report letterhead reads by id. If a deleted org stopped resolving,
    // every past report for its events would silently fall back to the
    // default letterhead, rewriting history.
    const org = withDeleted().api.Organizations.getById("ORG-002")
    expect(org.id).toBe("ORG-002")
    expect(org.deletedAt).toBe("10/01/2026 09:15:00")
  })

  it("stamps the deletion time and returns it", () => {
    const h = withDeleted()
    const org = h.api.Organizations.delete("ORG-003")
    expect(org.deletedAt).not.toBe("")
    expect(h.rows("Organizations")[3][6]).toBe(org.deletedAt)
  })

  it("removes the organization from the list once deleted", () => {
    const h = withDeleted()
    h.api.Organizations.delete("ORG-003")
    const ids = h.api.Organizations.all().map((o: { id: string }) => o.id)
    expect(ids).toEqual(["ORG-001"])
  })

  it("keeps the original stamp when deleting twice", () => {
    const h = withDeleted()
    const first = h.api.Organizations.delete("ORG-002")
    const second = h.api.Organizations.delete("ORG-002")
    expect(second.deletedAt).toBe(first.deletedAt)
  })

  it("clears the stamp on restore", () => {
    const h = withDeleted()
    const org = h.api.Organizations.restore("ORG-002")
    expect(org.deletedAt).toBe("")
    expect(h.rows("Organizations")[2][6]).toBe("")
  })

  it("returns the organization to the list on restore", () => {
    const h = withDeleted()
    h.api.Organizations.restore("ORG-002")
    const ids = h.api.Organizations.all().map((o: { id: string }) => o.id)
    expect(ids).toEqual(["ORG-001", "ORG-002", "ORG-003"])
  })

  it("leaves an active organization untouched on restore", () => {
    const org = withDeleted().api.Organizations.restore("ORG-001")
    expect(org.deletedAt).toBe("")
  })

  it("keeps events attached to a deleted organization valid", () => {
    // Otherwise an event whose org was deleted could never be edited again —
    // not even to change its time — because every patch revalidates the ref.
    const h = withDeleted()
    const event = h.api.Events.update("EVT-001", { time: "1:00 pm - 4:00 pm" })
    expect(event.orgId).toBe("ORG-001")
    expect(h.api.Organizations.assertOptional("ORG-002")).toBe("ORG-002")
  })

  it("rejects deleting an unknown organization", () => {
    expect(codeOf(() => loadScripts().api.Organizations.handleDelete({ orgId: "ORG-999" }))).toBe(
      "ORG_NOT_FOUND"
    )
  })

  it("rejects restoring an unknown organization", () => {
    expect(codeOf(() => loadScripts().api.Organizations.handleRestore({ orgId: "ORG-999" }))).toBe(
      "ORG_NOT_FOUND"
    )
  })

  it("wraps delete and restore in the standard success envelope", () => {
    const h = withDeleted()
    const removed = h.api.Organizations.handleDelete({ orgId: "ORG-003" })
    expect(removed.success).toBe(true)
    expect(removed.organization.id).toBe("ORG-003")

    const restored = h.api.Organizations.handleRestore({ orgId: "ORG-003" })
    expect(restored.success).toBe(true)
    expect(restored.organization.deletedAt).toBe("")
  })
})

/** Creates an organization through the handler, unwrapping the envelope. */
function createOrg(h: ReturnType<typeof loadScripts>, name: string, email = "") {
  return h.api.Organizations.handleCreate({
    name,
    email,
    address: "",
    phone: "",
    website: "",
  }).organization
}

/** Returns the AppError code a call throws, or "" when it does not throw. */
function codeOf(run: () => unknown): string {
  try {
    run()
    return ""
  } catch (error) {
    return (error as { code?: string }).code ?? ""
  }
}

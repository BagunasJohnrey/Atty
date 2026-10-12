import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createOrganizationNeon,
  deleteOrganizationNeon,
  getOrganizationNeon,
  getOrganizationsNeon,
  nextOrgIdTS,
  updateOrganizationNeon,
} from "./neon-organizations"
import { neon } from "@neondatabase/serverless"

vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }))

const neonMock = vi.mocked(neon)

function queryText(strings: TemplateStringsArray | string): string {
  return typeof strings === "string" ? strings : strings.join(" ")
}

function mockSql(
  impl: (strings: TemplateStringsArray | string, ...values: unknown[]) => unknown
) {
  const sql = vi.fn(
    (strings: TemplateStringsArray | string, ...values: unknown[]) =>
      Promise.resolve(impl(strings, ...values)) as never
  ) as unknown as {
    (...args: unknown[]): Promise<unknown>
    query: (text: string, params: unknown[]) => Promise<unknown>
    mock: { calls: unknown[][] }
  }
  sql.query = (text: string, params: unknown[]) => sql(text, params)
  neonMock.mockReturnValue(sql as never)
  return sql
}

beforeEach(() => {
  neonMock.mockReset()
  process.env.NEON_DATABASE_URL = "postgresql://test/test"
})

const neonOrgRow = {
  id: "ORG-001",
  name: "Batangas State University",
  email: "sscbalayan@g.batstate-u.edu.ph",
}

describe("neon organizations", () => {
  it("lists organizers ordered by id", async () => {
    const sql = mockSql(() => [neonOrgRow])
    await expect(getOrganizationsNeon()).resolves.toEqual([
      {
        id: "ORG-001",
        name: "Batangas State University",
        email: "sscbalayan@g.batstate-u.edu.ph",
      },
    ])
    const q = String(sql.mock.calls[0])
    expect(q).toContain("from organizations")
    expect(q).toContain("order by id")
  })

  it("maps one organizer row to the app shape", async () => {
    mockSql(() => [neonOrgRow])
    await expect(getOrganizationNeon("ORG-001")).resolves.toEqual({
      id: "ORG-001",
      name: "Batangas State University",
      email: "sscbalayan@g.batstate-u.edu.ph",
    })
  })

  it("throws ORG_NOT_FOUND for an unknown organizer", async () => {
    mockSql(() => [])
    await expect(getOrganizationNeon("ORG-999")).rejects.toMatchObject({
      code: "ORG_NOT_FOUND",
    })
  })

  it("creates with the next sequence id and a lowercased email", async () => {
    const sql = mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("insert into organizations")) {
        const v = values as string[]
        return [{ id: v[0], name: v[1], email: v[2] }]
      }
      if (q.includes("from organizations")) {
        return [{ id: "ORG-001" }, { id: "ORG-002" }]
      }
      throw new Error(`unexpected query: ${q}`)
    })
    const org = await createOrganizationNeon({
      name: "New Org",
      email: "CONTACT@EXAMPLE.EDU",
    })
    expect(org).toMatchObject({
      id: "ORG-003",
      name: "New Org",
      email: "contact@example.edu",
    })
    expect(String(sql.mock.calls[1])).toContain("insert into organizations")
  })

  it("defaults a missing email to an empty string on create", async () => {
    mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("insert into organizations")) {
        const v = values as string[]
        return [{ id: v[0], name: v[1], email: v[2] }]
      }
      return []
    })
    await expect(createOrganizationNeon({ name: "Minimal" })).resolves.toMatchObject({
      id: "ORG-001",
      email: "",
    })
  })

  it("rejects a blank name without querying", async () => {
    const sql = mockSql(() => {
      throw new Error("must not query")
    })
    await expect(createOrganizationNeon({ name: "  " })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    })
    expect(sql).not.toHaveBeenCalled()
  })

  it("updates name and clears email with a blank string", async () => {
    const sql = mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("update organizations")) {
        const params = values[0] as string[]
        return [{ id: "ORG-001", name: params[0], email: params[1] }]
      }
      return [neonOrgRow]
    })
    await expect(
      updateOrganizationNeon("ORG-001", { name: "Renamed", email: "" })
    ).resolves.toMatchObject({ id: "ORG-001", name: "Renamed", email: "" })
    expect(String(sql.mock.calls[0])).toContain("from organizations")
  })

  it("lowercases the email on update", async () => {
    mockSql((strings, ...values) => {
      const q = queryText(strings)
      if (q.includes("update organizations")) {
        const params = values[0] as string[]
        return [{ id: "ORG-001", name: params[0], email: params[1] }]
      }
      return [neonOrgRow]
    })
    await expect(
      updateOrganizationNeon("ORG-001", {
        name: "Batangas State University",
        email: "NEW@EXAMPLE.EDU",
      })
    ).resolves.toMatchObject({ email: "new@example.edu" })
  })

  it("rejects unknown fields on update", async () => {
    const sql = mockSql(() => [neonOrgRow])
    await expect(
      updateOrganizationNeon("ORG-001", { bogus: "x" } as never)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" })
    // The key check runs before any read.
    expect(sql).not.toHaveBeenCalled()
  })

  it("rejects a blank name on update", async () => {
    const sql = mockSql(() => [neonOrgRow])
    await expect(
      updateOrganizationNeon("ORG-001", { name: "  " })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" })
    expect(sql).toHaveBeenCalledTimes(1)
  })

  it("deletes and returns the removed row", async () => {
    const sql = mockSql((strings) => {
      const q = queryText(strings)
      if (q.includes("delete from organizations")) return [neonOrgRow]
      return [neonOrgRow]
    })
    await expect(deleteOrganizationNeon("ORG-001")).resolves.toMatchObject({
      id: "ORG-001",
    })
    expect(String(sql.mock.calls[1])).toContain("delete from organizations")
  })

  it("reports ORG_NOT_FOUND when deleting an unknown organizer", async () => {
    mockSql(() => [])
    await expect(deleteOrganizationNeon("ORG-999")).rejects.toMatchObject({
      code: "ORG_NOT_FOUND",
    })
  })

  it("sequences ORG ids from the highest numeric suffix", () => {
    expect(nextOrgIdTS([])).toBe("ORG-001")
    expect(nextOrgIdTS(["ORG-001", "ORG-002"])).toBe("ORG-003")
    expect(nextOrgIdTS(["ORG-009"])).toBe("ORG-010")
    expect(nextOrgIdTS(["ORG-001", "WHATEVER"])).toBe("ORG-002")
  })
})

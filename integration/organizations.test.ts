import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Organization } from "@/models/organization"
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  getOrganizations,
  restoreOrganization,
  updateOrganization,
} from "./organizations"
import { requestAppsScript } from "./http"

vi.mock("./http", () => ({
  requestAppsScript: vi.fn(),
}))

const requestMock = vi.mocked(requestAppsScript)

const sampleOrg: Organization = {
  id: "ORG-001",
  name: "Batangas State University",
  email: "sscbalayan@g.batstate-u.edu.ph",
  address: "Caloocan, Balayan, Batangas, Philippines 4213",
  phone: "(+63 43) 980-0385 local 6101",
  website: "http://www.batstate-u.edu.ph",
  deletedAt: "",
}

beforeEach(() => {
  requestMock.mockReset()
})

function mockSuccess(payload: object): void {
  requestMock.mockResolvedValue({ success: true, ...payload } as never)
}

describe("organizations integration", () => {
  it("lists organizations via getOrganizations", async () => {
    mockSuccess({ organizations: [sampleOrg] })
    await expect(getOrganizations()).resolves.toEqual([sampleOrg])
    expect(requestMock).toHaveBeenCalledWith("getOrganizations")
  })

  it("fetches a single organization via getOrganization", async () => {
    mockSuccess({ organization: sampleOrg })
    await expect(getOrganization("ORG-001")).resolves.toEqual(sampleOrg)
    expect(requestMock).toHaveBeenCalledWith("getOrganization", {
      orgId: "ORG-001",
    })
  })

  it("defaults missing contact fields to empty strings on create", async () => {
    mockSuccess({ organization: sampleOrg })
    await createOrganization({ name: sampleOrg.name })
    expect(requestMock).toHaveBeenCalledWith("createOrganization", {
      name: sampleOrg.name,
      email: "",
      address: "",
      phone: "",
      website: "",
    })
  })

  it("forwards every contact field supplied on create", async () => {
    mockSuccess({ organization: sampleOrg })
    await createOrganization(sampleOrg)
    expect(requestMock).toHaveBeenCalledWith("createOrganization", {
      name: sampleOrg.name,
      email: sampleOrg.email,
      address: sampleOrg.address,
      phone: sampleOrg.phone,
      website: sampleOrg.website,
    })
  })

  it("updates an organization via updateOrganization", async () => {
    mockSuccess({ organization: { ...sampleOrg, email: "new@example.edu" } })
    await expect(
      updateOrganization("ORG-001", { email: "new@example.edu" })
    ).resolves.toMatchObject({ email: "new@example.edu" })
    expect(requestMock).toHaveBeenCalledWith("updateOrganization", {
      orgId: "ORG-001",
      email: "new@example.edu",
    })
  })

  it("propagates upstream errors", async () => {
    requestMock.mockRejectedValue(new Error("ORG_NOT_FOUND"))
    await expect(getOrganization("ORG-999")).rejects.toThrow("ORG_NOT_FOUND")
  })

  it("soft deletes via deleteOrganization", async () => {
    mockSuccess({ organization: { ...sampleOrg, deletedAt: "10/01/2026 09:15:00" } })
    await expect(deleteOrganization("ORG-001")).resolves.toMatchObject({
      deletedAt: "10/01/2026 09:15:00",
    })
    expect(requestMock).toHaveBeenCalledWith("deleteOrganization", {
      orgId: "ORG-001",
    })
  })

  it("undoes a soft delete via restoreOrganization", async () => {
    mockSuccess({ organization: sampleOrg })
    await expect(restoreOrganization("ORG-001")).resolves.toMatchObject({
      deletedAt: "",
    })
    expect(requestMock).toHaveBeenCalledWith("restoreOrganization", {
      orgId: "ORG-001",
    })
  })
})

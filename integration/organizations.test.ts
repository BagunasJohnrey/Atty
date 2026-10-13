import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Organization } from "@/models/organization"
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  getOrganizations,
  updateOrganization,
} from "./organizations"
import { requestAppsScript } from "./http"
import {
  createOrganizationNeon,
  deleteOrganizationNeon,
  getOrganizationNeon,
  getOrganizationsNeon,
  updateOrganizationNeon,
} from "./neon-organizations"

vi.mock("./http", () => ({
  requestAppsScript: vi.fn(),
}))
vi.mock("./neon-organizations", () => ({
  createOrganizationNeon: vi.fn(),
  deleteOrganizationNeon: vi.fn(),
  getOrganizationNeon: vi.fn(),
  getOrganizationsNeon: vi.fn(),
  updateOrganizationNeon: vi.fn(),
}))

const requestMock = vi.mocked(requestAppsScript)
const neonMocks = {
  getAll: vi.mocked(getOrganizationsNeon),
  getOne: vi.mocked(getOrganizationNeon),
  create: vi.mocked(createOrganizationNeon),
  update: vi.mocked(updateOrganizationNeon),
  remove: vi.mocked(deleteOrganizationNeon),
}

const sampleOrg: Organization = {
  id: "ORG-001",
  name: "Batangas State University",
  email: "sscbalayan@g.batstate-u.edu.ph",
}

beforeEach(() => {
  requestMock.mockReset()
  Object.values(neonMocks).forEach((m) => m.mockReset())
  delete process.env.NEON_ORGANIZATIONS
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

  it("defaults a missing email to an empty string on create", async () => {
    mockSuccess({ organization: sampleOrg })
    await createOrganization({ name: sampleOrg.name })
    expect(requestMock).toHaveBeenCalledWith("createOrganization", {
      name: sampleOrg.name,
      email: "",
    })
  })

  it("forwards name and email supplied on create", async () => {
    mockSuccess({ organization: sampleOrg })
    await createOrganization(sampleOrg)
    expect(requestMock).toHaveBeenCalledWith("createOrganization", {
      name: sampleOrg.name,
      email: sampleOrg.email,
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

  it("hard deletes via deleteOrganization", async () => {
    mockSuccess({ organization: sampleOrg })
    await expect(deleteOrganization("ORG-001")).resolves.toEqual(sampleOrg)
    expect(requestMock).toHaveBeenCalledWith("deleteOrganization", {
      orgId: "ORG-001",
    })
  })
})

describe("organizations cutover", () => {
  beforeEach(() => {
    process.env.NEON_ORGANIZATIONS = "neon"
    neonMocks.getAll.mockResolvedValue([sampleOrg])
    neonMocks.getOne.mockResolvedValue(sampleOrg)
    neonMocks.create.mockResolvedValue(sampleOrg)
    neonMocks.update.mockResolvedValue(sampleOrg)
  })

  afterEach(() => {
    delete process.env.NEON_ORGANIZATIONS
  })

  it("lists organizers from Neon when flagged", async () => {
    await expect(getOrganizations()).resolves.toEqual([sampleOrg])
    expect(neonMocks.getAll).toHaveBeenCalledTimes(1)
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("reads one organizer from Neon when flagged", async () => {
    await expect(getOrganization("ORG-001")).resolves.toEqual(sampleOrg)
    expect(neonMocks.getOne).toHaveBeenCalledWith("ORG-001")
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("creates via Neon with a defaulted email when flagged", async () => {
    await createOrganization({ name: sampleOrg.name })
    expect(neonMocks.create).toHaveBeenCalledWith({
      name: sampleOrg.name,
      email: "",
    })
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("updates and deletes via Neon when flagged", async () => {
    await updateOrganization("ORG-001", { email: "new@example.edu" })
    expect(neonMocks.update).toHaveBeenCalledWith("ORG-001", {
      email: "new@example.edu",
    })
    neonMocks.remove.mockResolvedValue(sampleOrg)
    await expect(deleteOrganization("ORG-001")).resolves.toEqual(sampleOrg)
    expect(neonMocks.remove).toHaveBeenCalledWith("ORG-001")
    expect(requestMock).not.toHaveBeenCalled()
  })
})

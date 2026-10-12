import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from "@/models/organization"
import { requestAppsScript } from "./http"
import {
  createOrganizationNeon,
  deleteOrganizationNeon,
  getOrganizationNeon,
  getOrganizationsNeon,
  updateOrganizationNeon,
} from "./neon-organizations"

/** Cutover flag: `neon` serves organizers from Neon; anything else (or unset)
 *  keeps the Apps Script path. Fail-safe defaults to the legacy backend. */
function isNeonOrganizationsEnabled(): boolean {
  return process.env.NEON_ORGANIZATIONS === "neon"
}

export async function getOrganizations(): Promise<Organization[]> {
  if (isNeonOrganizationsEnabled()) return getOrganizationsNeon()
  const response = await requestAppsScript<{ organizations: Organization[] }>(
    "getOrganizations"
  )
  return response.organizations
}

export async function getOrganization(
  orgId: string
): Promise<Organization> {
  if (isNeonOrganizationsEnabled()) return getOrganizationNeon(orgId)
  const response = await requestAppsScript<{ organization: Organization }>(
    "getOrganization",
    { orgId }
  )
  return response.organization
}

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<Organization> {
  if (isNeonOrganizationsEnabled()) {
    return createOrganizationNeon({
      name: input.name,
      email: input.email ?? "",
    })
  }
  const response = await requestAppsScript<{ organization: Organization }>(
    "createOrganization",
    {
      name: input.name,
      // The backend treats a missing field as "", so sending the explicit
      // default keeps the request body and the sheet row in agreement.
      email: input.email ?? "",
    }
  )
  return response.organization
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  if (isNeonOrganizationsEnabled()) return updateOrganizationNeon(orgId, input)
  const response = await requestAppsScript<{ organization: Organization }>(
    "updateOrganization",
    { orgId, ...input }
  )
  return response.organization
}

/**
 * Hard deletes. The row is removed permanently, so only delete organizations
 * with no events attached — events keep their stored orgId, which stops
 * resolving afterwards.
 */
export async function deleteOrganization(
  orgId: string
): Promise<Organization> {
  if (isNeonOrganizationsEnabled()) return deleteOrganizationNeon(orgId)
  const response = await requestAppsScript<{ organization: Organization }>(
    "deleteOrganization",
    { orgId }
  )
  return response.organization
}

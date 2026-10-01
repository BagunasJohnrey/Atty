import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from "@/models/organization"
import { requestAppsScript } from "./http"

export async function getOrganizations(): Promise<Organization[]> {
  const response = await requestAppsScript<{ organizations: Organization[] }>(
    "getOrganizations"
  )
  return response.organizations
}

export async function getOrganization(
  orgId: string
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "getOrganization",
    { orgId }
  )
  return response.organization
}

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "createOrganization",
    {
      name: input.name,
      // The backend treats a missing field as "", so sending the explicit
      // default keeps the request body and the sheet row in agreement.
      email: input.email ?? "",
      address: input.address ?? "",
      phone: input.phone ?? "",
      website: input.website ?? "",
    }
  )
  return response.organization
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "updateOrganization",
    { orgId, ...input }
  )
  return response.organization
}

/**
 * Soft deletes. The row is kept so its events keep resolving; it simply drops
 * out of the list and the picker.
 */
export async function deleteOrganization(
  orgId: string
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "deleteOrganization",
    { orgId }
  )
  return response.organization
}

/** Undoes a soft delete, returning the organization to the active list. */
export async function restoreOrganization(
  orgId: string
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "restoreOrganization",
    { orgId }
  )
  return response.organization
}

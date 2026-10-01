/**
 * An organization is an entity that uses the attendance tracker. It owns the
 * identity a report letterhead needs, so a new customer is a data change
 * rather than a code change.
 *
 * Only `name` is required. The contact fields default to "" so a minimal
 * record is still valid, and every one of them is free text: the report prints
 * them as typed.
 */
export interface Organization {
  id: string
  name: string
  email: string
  address: string
  phone: string
  website: string
  /**
   * Soft delete stamp, or "" when active. Lists exclude deleted rows, but a
   * lookup by id still returns one: the report letterhead must keep resolving
   * a deleted organization so past reports are never silently rewritten.
   */
  deletedAt: string
}

export interface CreateOrganizationInput {
  name: string
  email?: string
  address?: string
  phone?: string
  website?: string
}

export interface UpdateOrganizationInput {
  name?: string
  email?: string
  address?: string
  phone?: string
  website?: string
}

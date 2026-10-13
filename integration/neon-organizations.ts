import "server-only"

import { neon } from "@neondatabase/serverless"
import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from "@/models/organization"
import { AppsScriptError } from "./errors"

/**
 * Neon organizers registry (cut over behind NEON_ORGANIZATIONS).
 *
 * Lives in its own module rather than `neon.ts` so neither direction
 * creates an import cycle: `neon.ts` (org validation) and
 * `organizations.ts` (flag branch) both import from here, and this module
 * imports from neither.
 *
 * Rules mirror `apps-script/organizations.gs` exactly: ORG-XXX sequencing
 * (highest numeric suffix + 1, minimum 3 digits), name required (≤150),
 * email optional (≤150, always stored lowercase, blank clears), unknown
 * update keys rejected, missing ids report ORG_NOT_FOUND. Error codes and
 * action names match the script path so HTTP mapping is unchanged.
 */

export interface NeonOrganizationRow {
  id: string
  name: string
  email: string
}

const ORG_ID_PATTERN = /^ORG-(\d+)$/i

const ORG_UPDATE_FIELDS = ["name", "email"] as const

function getSql() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL is not configured. See .env.example."
    )
  }
  return neon(url)
}

function invalidRequest(message: string, action: string): AppsScriptError {
  return new AppsScriptError("INVALID_REQUEST", message, action)
}

function requiredOrgString(
  value: unknown,
  label: string,
  maxLength: number,
  action: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidRequest(`${label} is required.`, action)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw invalidRequest(`${label} is too long.`, action)
  }
  return trimmed
}

function optionalOrgString(
  value: unknown,
  label: string,
  maxLength: number,
  action: string
): string {
  if (value === undefined || value === null) return ""
  if (typeof value !== "string") {
    throw invalidRequest(`${label} must be a string.`, action)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw invalidRequest(`${label} is too long.`, action)
  }
  return trimmed
}

/** Mirrors Organizations.nextId: highest ORG-<n> suffix + 1, minimum 3 digits. */
export function nextOrgIdTS(ids: string[]): string {
  let maxSequence = 0
  for (const id of ids) {
    const match = ORG_ID_PATTERN.exec(id)
    if (match) maxSequence = Math.max(maxSequence, Number(match[1]))
  }
  let next = String(maxSequence + 1)
  while (next.length < 3) next = "0" + next
  return `ORG-${next}`
}

function mapOrganizationRow(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
  }
}

export async function getOrganizationsNeon(): Promise<Organization[]> {
  const sql = getSql()
  const rows = await sql`
    select id, name, email
    from organizations
    order by id
  `
  return (rows as Record<string, unknown>[]).map(mapOrganizationRow)
}

export async function getOrganizationNeon(orgId: string): Promise<Organization> {
  const sql = getSql()
  const rows = await sql`
    select id, name, email
    from organizations where id = ${orgId} limit 1
  `
  const row = (rows as Record<string, unknown>[])[0]
  if (!row) {
    throw new AppsScriptError(
      "ORG_NOT_FOUND",
      "Organization not found.",
      "getOrganization"
    )
  }
  return mapOrganizationRow(row)
}

export async function createOrganizationNeon(
  input: CreateOrganizationInput
): Promise<Organization> {
  const action = "createOrganization"
  const name = requiredOrgString(input.name, "Organization name", 150, action)
  // Organizer emails are always stored lowercase.
  const email = optionalOrgString(
    input.email,
    "Organization email",
    150,
    action
  ).toLowerCase()

  const insertOnce = async (): Promise<Organization> => {
    const sql = getSql()
    const existing = (await sql`select id from organizations`) as {
      id: string
    }[]
    const id = nextOrgIdTS(existing.map((row) => String(row.id)))
    const rows = await sql`
      insert into organizations (id, name, email)
      values (${id}, ${name}, ${email})
      returning *
    `
    return mapOrganizationRow((rows as Record<string, unknown>[])[0])
  }

  try {
    return await insertOnce()
  } catch (error) {
    // Two simultaneous creates can claim the same id; recompute once.
    if ((error as { code?: string })?.code === "23505") return insertOnce()
    throw error
  }
}

export async function updateOrganizationNeon(
  orgId: string,
  patch: UpdateOrganizationInput
): Promise<Organization> {
  const action = "updateOrganization"
  for (const key of Object.keys(patch)) {
    if (!(ORG_UPDATE_FIELDS as readonly string[]).includes(key)) {
      throw invalidRequest(`Unknown field: ${key}`, action)
    }
  }
  const current = await getOrganizationNeon(orgId)
  const columns: Record<string, string> = {}
  if (patch.name !== undefined) {
    columns.name = requiredOrgString(patch.name, "Organization name", 150, action)
  }
  if (patch.email !== undefined) {
    // A blank email clears the stored value; anything kept is lowercase.
    columns.email = optionalOrgString(
      patch.email,
      "Organization email",
      150,
      action
    ).toLowerCase()
  }
  const entries = Object.entries(columns)
  if (entries.length === 0) return current
  const sql = getSql()
  const sets = entries.map(([column], i) => `${column} = $${i + 1}`)
  const values = entries.map(([, value]) => value)
  values.push(orgId)
  const rows = (await sql.query(
    `update organizations set ${sets.join(", ")} where id = $${values.length} returning *`,
    values
  )) as Record<string, unknown>[]
  return rows[0] ? mapOrganizationRow(rows[0]) : current
}

export async function deleteOrganizationNeon(
  orgId: string
): Promise<Organization> {
  // Read first so a missing id reports ORG_NOT_FOUND instead of a silent
  // no-op. Returns the removed row, mirroring the script hard delete.
  const organization = await getOrganizationNeon(orgId)
  const sql = getSql()
  const rows = (await sql`
    delete from organizations where id = ${orgId} returning *
  `) as Record<string, unknown>[]
  return rows[0] ? mapOrganizationRow(rows[0]) : organization
}

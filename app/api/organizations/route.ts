import { NextResponse } from "next/server"
import { createOrganization } from "@/integration/organizations"
import { getOrganizationsCached } from "@/integration/cached"
import { expireOrganizations } from "@/integration/invalidate"
import { requireAdmin } from "@/lib/auth/dal"
import {
  cachedJson,
  optionalString,
  parseJsonBody,
  requireString,
  respondWith,
} from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET() {
  return respondWith(async () => {
    await requireAdmin()
    // Active organizations only. A soft-deleted row is deliberately absent
    // here; it is still reachable by id, which is what the report letterhead
    // needs.
    const organizations = await getOrganizationsCached()
    return cachedJson({ success: true, organizations }, 30)
  })
}

export async function POST(request: Request) {
  return respondWith(async () => {
    await requireAdmin()
    const body = await parseJsonBody(request)
    const name = requireString(body, "name", 150)
    const email = optionalString(body, "email", 150)
    const address = optionalString(body, "address", 200)
    const phone = optionalString(body, "phone", 60)
    const website = optionalString(body, "website", 200)
    const organization = await createOrganization({
      name,
      email,
      address,
      phone,
      website,
    })
    expireOrganizations()
    return NextResponse.json(
      { success: true, message: "Organization created successfully.", organization },
      { status: 201 }
    )
  })
}

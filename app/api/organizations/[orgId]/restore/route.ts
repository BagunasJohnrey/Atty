import { NextResponse } from "next/server"
import { restoreOrganization } from "@/integration/organizations"
import { expireOrganization } from "@/integration/invalidate"
import { requireAdmin } from "@/lib/auth/dal"
import { respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type RestoreParams = { params: Promise<{ orgId: string }> }

/**
 * Undoes a soft delete, returning the organization to the active list.
 *
 * A named subroute rather than a second verb on the item, matching how
 * `openEvent` is `POST /api/events/[eventId]/open`: a state transition gets
 * its own name, so the call site reads as what it does.
 */
export async function POST(_request: Request, context: RestoreParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { orgId } = await context.params
    const organization = await restoreOrganization(orgId)
    expireOrganization(orgId)
    return NextResponse.json({
      success: true,
      message: "Organization restored successfully.",
      organization,
    })
  })
}

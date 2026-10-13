import { getOrganizationsCached } from "@/integration/cached"
import { OrganizationList } from "@/components/organizations/OrganizationList"
import { requireAdminPage } from "@/lib/auth/dal"

export const metadata = { title: "Organizers" }

/**
 * Request-time rendered: the list must reflect creates without a redeploy,
 * and the cached read keeps repeat views off the Apps Script roundtrip.
 */
export const dynamic = "force-dynamic"

export default async function OrganizationsPage() {
  await requireAdminPage()

  let organizations: Awaited<ReturnType<typeof getOrganizationsCached>> = []
  let error: string | null = null
  try {
    organizations = await getOrganizationsCached()
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load organizers."
  }

  return <OrganizationList initial={organizations} error={error} />
}

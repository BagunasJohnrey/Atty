"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { OrganizationFormDialog } from "./OrganizationFormDialog"
import { ApiError, deleteOrganization } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { invalidatePrefix } from "@/hooks/useCached"
import type { Organization } from "@/models/organization"

export function OrganizationCard({
  organization: org,
  onDeleted,
  onUpdated,
}: {
  organization: Organization
  /**
   * Instant list updates: the owner removes/replaces the card from the
   * mutation response instead of waiting for the post-save re-read
   * (organizers live in Apps Script, where a roundtrip takes seconds).
   */
  onDeleted?: (orgId: string) => void
  onUpdated?: (organization: Organization) => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function onDelete() {
    // The modal stays open on failure so the operator can retry or back
    // out; success closes it and refreshes the list.
    setBusy(true)
    try {
      await deleteOrganization(org.id)
      invalidatePrefix("organizations:")
      onDeleted?.(org.id)
      setDeleteOpen(false)
      toast.success("Organizer deleted.")
      router.refresh()
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Could not delete organizer."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="clay-topglow flex h-full flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{org.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {org.id}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {org.email ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden /> {org.email}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <OrganizationFormDialog organization={org} onSaved={onUpdated} />
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => setDeleteOpen(true)}
            className="clay-btn"
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete organizer?"
        message={`This permanently removes ${org.name}. Events using it will fall back to the default letterhead. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={() => void onDelete()}
        busy={busy}
        destructive
      />
    </Card>
  )
}

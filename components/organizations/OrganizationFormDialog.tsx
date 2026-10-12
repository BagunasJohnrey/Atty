"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input, Label } from "@/components/ui/input"
import {
  ApiError,
  createOrganization,
  updateOrganization,
} from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { invalidatePrefix } from "@/hooks/useCached"
import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from "@/models/organization"

/**
 * Create dialog by default; pass `organization` for edit mode, which
 * prefills name + email from stored values and saves through
 * updateOrganization. Mirrors EventFormDialog's create/edit split.
 */
export function OrganizationFormDialog({
  organization,
}: {
  organization?: Organization
}) {
  const isEdit = organization != null
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Suffix keeps label/input ids unique when many edit dialogs share the
  // page (one per card). The create dialog is singular, so "new" is stable.
  const idSuffix = organization?.id ?? "new"

  function close() {
    setError(null)
    setOpen(false)
  }

  async function onSubmit(form: FormData) {
    const name = String(form.get("name") ?? "").trim()
    if (!name) {
      setError("Enter an organizer name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      // PATCH rejects unknown keys and requires a non-empty name; a blank
      // email is sent as "" so the server clears it rather than keeping
      // the old value. Emails are always stored lowercase.
      const email = String(form.get("email") ?? "").trim().toLowerCase()
      if (isEdit && organization) {
        const input: UpdateOrganizationInput = { name, email }
        await updateOrganization(organization.id, input)
      } else {
        const input: CreateOrganizationInput = { name, email }
        await createOrganization(input)
      }
      invalidatePrefix("organizations:")
      close()
      toast.success(isEdit ? "Organizer updated." : "Organizer added.")
      router.refresh()
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : isEdit
            ? "Could not update organizer."
            : "Could not create organizer."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        // Same guard as the event dialog: backdrop clicks must never
        // discard a half-filled form.
        if (!next && details?.reason === "outside-press") return
        if (!next) setError(null)
        setOpen(next)
      }}
    >
      <DialogTrigger
        render={
          <Button
            className={isEdit ? "clay-btn" : "clay-btn clay-btn-primary"}
            size={isEdit ? "sm" : undefined}
          >
            {isEdit ? (
              <Pencil className="size-4" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}{" "}
            {isEdit ? "Edit" : "Add organizer"}
          </Button>
        }
      />
      <DialogContent>
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close dialog"
              className="absolute top-3 right-3"
            >
              <X className="size-4" aria-hidden />
            </Button>
          }
        />
        <DialogTitle>{isEdit ? "Edit organizer" : "Add organizer"}</DialogTitle>
        <DialogDescription>
          {isEdit && organization
            ? `Updating ${organization.id}. The new name and email will appear on printed attendance reports.`
            : "The name and email will appear on printed attendance reports."}
        </DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          action={(form) => void onSubmit(form)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`org-name-${idSuffix}`}>Organizer name</Label>
            <Input
              id={`org-name-${idSuffix}`}
              name="name"
              required
              maxLength={150}
              placeholder="Batangas State University"
              defaultValue={organization?.name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`org-email-${idSuffix}`}>Email</Label>
            <Input
              id={`org-email-${idSuffix}`}
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={150}
              placeholder="sscbalayan@g.batstate-u.edu.ph"
              defaultValue={organization?.email}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving} className="clay-btn mt-1">
            {saving
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create organizer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

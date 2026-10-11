"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input, Label } from "@/components/ui/input"
import Link from "next/link"
import { ApiError, createEvent, updateEvent } from "@/lib/api-client"
import {
  formatEventDate,
  formatTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/format"
import { useOrganizations } from "@/hooks/useQueries"
import { useToast } from "@/components/ui/toast"
import { ClaySelect } from "@/components/ui/select"
import { invalidatePrefix } from "@/hooks/useCached"
import type { SchoolEvent } from "@/models/event"

/**
 * Create dialog by default; pass `event` for edit mode, which prefills
 * every field from stored values and saves through updateEvent. Status is
 * intentionally not editable here — open/close stays on EventActions so
 * the dialog can never violate the closed-can't-reopen rule.
 */
export function EventFormDialog({ event }: { event?: SchoolEvent }) {
  const isEdit = event != null
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const {
    data: orgData,
    loading: orgsLoading,
    error: orgsError,
    refresh: refreshOrgs,
  } = useOrganizations()
  const orgs = orgData?.organizations ?? []
  const [orgId, setOrgId] = React.useState(event?.orgId ?? "")
  const loadFailed = !orgsLoading && orgsError != null

  // Stored halves back into picker values. Content unmounts on close, so
  // these defaults are fresh on every open.
  const dateParts = (event?.date ?? "").split(" - ")
  const initialDateStart = isEdit ? toDateInputValue(dateParts[0]) : undefined
  const initialDateEnd =
    isEdit && dateParts.length > 1
      ? toDateInputValue(dateParts.slice(1).join(" - "))
      : undefined
  const timeParts = (event?.time ?? "").split(" - ")
  const initialTimeStart = isEdit ? toTimeInputValue(timeParts[0]) : undefined
  const initialTimeEnd =
    isEdit && timeParts.length > 1
      ? toTimeInputValue(timeParts.slice(1).join(" - "))
      : undefined

  function close() {
    setOrgId(event?.orgId ?? "")
    setError(null)
    setOpen(false)
  }

  async function onSubmit(form: FormData) {
    if (!orgId) {
      setError("Select an organizer.")
      return
    }
    // A range serializes into the single backend date string. One date
    // stays ISO so every existing display keeps working; a range stores
    // the pretty form, which formatEventDate renders verbatim.
    const start = String(form.get("dateStart") ?? "")
    const end = String(form.get("dateEnd") ?? "").trim()
    if (end && end < start) {
      setError("End date must be on or after the start date.")
      return
    }
    const date =
      end && end !== start
        ? `${formatEventDate(start)} - ${formatEventDate(end)}`
        : start
    // Times serialize into the single backend string, formatted to the
    // 12-hour display style every existing event uses. An end without a
    // start is refused; a start without an end stands alone. Overnight
    // ranges are legitimate (e.g. "12:00 pm - 1:00 am"), so end-before-start
    // is allowed, unlike dates.
    const timeStart = String(form.get("timeStart") ?? "")
    const timeEnd = String(form.get("timeEnd") ?? "").trim()
    if (timeEnd && !timeStart) {
      setError("Select a start time first.")
      return
    }
    let time = ""
    if (timeStart) {
      time = formatTimeInput(timeStart)
      if (timeEnd) time += ` - ${formatTimeInput(timeEnd)}`
    }
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        // PATCH rejects blank strings, so blank optionals are omitted
        // (server keeps its values) rather than sent as "". Description is
        // required by the form, so it is always present here.
        const location = String(form.get("location") ?? "").trim()
        const description = String(form.get("description") ?? "").trim()
        await updateEvent(event.id, {
          name: String(form.get("name") ?? ""),
          date,
          ...(location ? { location } : null),
          ...(description ? { description } : null),
          orgId,
          ...(time ? { time } : null),
        })
      } else {
        await createEvent({
          name: String(form.get("name") ?? ""),
          date,
          location: String(form.get("location") ?? ""),
          description: String(form.get("description") ?? ""),
          orgId,
          time,
        })
      }
      invalidatePrefix("events:")
      invalidatePrefix("dashboard:")
      close()
      toast.success(isEdit ? "Event updated." : "Event created.")
      router.refresh()
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : isEdit
            ? "Could not update event."
            : "Could not create event."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOrgId(event?.orgId ?? "")
          setError(null)
        }
        setOpen(next)
      }}
    >
      <DialogTrigger
        render={
          <Button className={isEdit ? "clay-btn" : "clay-btn clay-btn-primary"}>
            {isEdit ? (
              <Pencil className="size-4" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}{" "}
            {isEdit ? "Edit" : "New Event"}
          </Button>
        }
      />
      <DialogContent>
        <DialogTitle>{isEdit ? "Edit event" : "Create event"}</DialogTitle>
        <DialogDescription>
          {isEdit ? (
            <>Updating {event.id}. Status changes stay on the event page.</>
          ) : (
            <>Sheet tab is auto-created as the Event ID (e.g. EVT-001).</>
          )}
        </DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          action={(form) => void onSubmit(form)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Event name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={150}
              placeholder="Freshmen Orientation"
              defaultValue={event?.name}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateStart">Start date</Label>
              <Input
                id="dateStart"
                name="dateStart"
                type="date"
                required
                defaultValue={initialDateStart}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateEnd">End date</Label>
              <Input
                id="dateEnd"
                name="dateEnd"
                type="date"
                aria-describedby="dateEnd-hint"
                defaultValue={initialDateEnd}
              />
              <p id="dateEnd-hint" className="text-xs text-muted-foreground">
                Optional — leave blank for one-day events.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              maxLength={150}
              placeholder="Gym"
              defaultValue={event?.location}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org">Organizer</Label>
            {orgs.length === 0 && !orgsLoading ? (
              <p role="alert" className="text-sm text-destructive">
                No organizers yet. Add one on the{" "}
                <Link
                  href="/organizations"
                  className="underline underline-offset-4"
                >
                  Organizers page
                </Link>{" "}
                first.
              </p>
            ) : (
              <ClaySelect
                id="org"
                value={orgs.find((o) => o.id === orgId)?.name ?? ""}
                onChange={(name) =>
                  setOrgId(orgs.find((o) => o.name === name)?.id ?? "")
                }
                placeholder="Select an organizer"
                options={orgs.map((o) => o.name)}
                allLabel="Select an organizer"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timeStart">Start time</Label>
              <Input
                id="timeStart"
                name="timeStart"
                type="time"
                defaultValue={initialTimeStart}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timeEnd">End time</Label>
              <Input
                id="timeEnd"
                name="timeEnd"
                type="time"
                defaultValue={initialTimeEnd}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              required
              maxLength={500}
              placeholder="What is this event about?"
              defaultValue={event?.description}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={saving || (!orgsLoading && orgs.length === 0)}
            className="clay-btn mt-1"
          >
            {saving
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create event"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

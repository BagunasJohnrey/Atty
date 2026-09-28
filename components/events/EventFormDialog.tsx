"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input, Label } from "@/components/ui/input"
import { ApiError, createEvent } from "@/lib/api-client"
import { invalidatePrefix } from "@/hooks/useCached"

export function EventFormDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function onSubmit(form: FormData) {
    setSaving(true)
    setError(null)
    try {
      await createEvent({
        name: String(form.get("name") ?? ""),
        date: String(form.get("date") ?? ""),
        location: String(form.get("location") ?? ""),
        description: String(form.get("description") ?? ""),
      })
      invalidatePrefix("events:")
      invalidatePrefix("dashboard:")
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create event.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="clay-btn"><Plus className="size-4" aria-hidden /> New Event</Button>}
      />
      <DialogContent>
        <DialogTitle>Create event</DialogTitle>
        <DialogDescription>Sheet tab is auto-created as the Event ID (e.g. EVT-001).</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          action={(form) => void onSubmit(form)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Event name</Label>
            <Input id="name" name="name" required maxLength={150} placeholder="Freshmen Orientation" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Event date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" maxLength={150} placeholder="Gym" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" maxLength={500} placeholder="Optional notes" />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={saving} className="clay-btn mt-1">
            {saving ? "Creating…" : "Create event"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

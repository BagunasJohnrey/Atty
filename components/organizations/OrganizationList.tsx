"use client"

import * as React from "react"
import { OrganizationCard } from "./OrganizationCard"
import { OrganizationFormDialog } from "./OrganizationFormDialog"
import type { Organization } from "@/models/organization"

/**
 * Client-owned organizer list with instant updates.
 *
 * Organizers live in Apps Script, where every roundtrip takes seconds:
 * waiting for the post-save re-read left the list visibly stale. Each
 * mutation response already carries the fresh record, so the list applies
 * it to local state immediately; the `router.refresh()` each dialog still
 * fires reconciles with server truth afterwards.
 */
export function OrganizationList({
  initial,
  error,
}: {
  initial: Organization[]
  error: string | null
}) {
  const [orgs, setOrgs] = React.useState(initial)
  const [prevInitial, setPrevInitial] = React.useState(initial)

  // Server truth wins whenever a refresh lands a new list (a new array
  // identity arrives with every server render). Adjusted during render —
  // not in an effect — per the synced-props pattern, so a refresh can
  // never strand the list. Between a save and its refresh, the handlers
  // below keep the UI ahead of the re-read.
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setOrgs(initial)
  }

  function handleCreated(org: Organization) {
    setOrgs((prev) =>
      prev.some((o) => o.id === org.id)
        ? prev.map((o) => (o.id === org.id ? org : o))
        : [...prev, org]
    )
  }

  function handleUpdated(org: Organization) {
    setOrgs((prev) => prev.map((o) => (o.id === org.id ? org : o)))
  }

  function handleDeleted(orgId: string) {
    setOrgs((prev) => prev.filter((o) => o.id !== orgId))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizers</h1>
          <p className="text-sm text-muted-foreground">
            The offices and schools using this tracker.
          </p>
        </div>
        <OrganizationFormDialog onSaved={handleCreated} />
      </div>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">
          {error}
        </p>
      ) : orgs.length === 0 ? (
        <p className="clay p-4 text-sm text-muted-foreground">
          No organizers yet. Add the first one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orgs.map((org) => (
            <OrganizationCard
              key={org.id}
              organization={org}
              onDeleted={handleDeleted}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}

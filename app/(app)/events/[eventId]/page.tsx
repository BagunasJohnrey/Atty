import Link from "next/link"
import { notFound } from "next/navigation"
import * as React from "react"
import { Building2, CalendarDays, Clock, MapPin, ScanLine } from "lucide-react"
import {
  getAttendanceCachedFor,
  getEventCachedFor,
  getOrganizationCachedFor,
} from "@/integration/cached"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { EventActions } from "@/components/events/EventActions"
import { DayFilter } from "@/components/reports/DayFilter"
import { EventFormDialog } from "@/components/events/EventFormDialog"
import { EventStatusBadge } from "@/components/events/EventStatusBadge"
import { AttendanceFilters } from "@/components/attendance/AttendanceFilters"
import { AttendanceTable } from "@/components/attendance/AttendanceTable"
import { RefreshButton } from "@/components/attendance/RefreshButton"
import { QueueSyncPanel } from "@/components/offline/QueueSyncPanel"
import { ExportButton } from "@/components/attendance/ExportButton"
import { ReportSummary } from "@/components/reports/ReportSummary"
import { FilterSkeleton } from "@/components/attendance/FilterSkeleton"
import { requireAdminPage } from "@/lib/auth/dal"
import { formatEventDate } from "@/lib/format"
import { eventDays } from "@/lib/events"
import { distinctFilterOptions, parseAttendanceFilters } from "@/lib/attendance"
import type { AttendanceRecord } from "@/models/attendance"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const event = await getEventCachedFor(eventId).catch(() => null)
  return { title: event ? event.name : "Event" }
}

/**
 * Day options come strictly from the event's date range in its details —
 * never from whatever scans happen to exist. A multi-day event offers its
 * full range from day one; a one-day event offers nothing (no picker).
 */
function dayOptions(eventDate: string): string[] {
  return eventDays(eventDate)
}

/**
 * Streams in after the header: resolves the shared attendance promise
 * (started alongside the event fetch) into dropdown facet options.
 * Failure degrades to empty facets, never a broken page.
 */
async function FilterSection({
  eventId,
  eventDate,
  data,
}: {
  eventId: string
  eventDate: string
  data: Promise<AttendanceRecord[]>
}) {
  let records: AttendanceRecord[] = []
  try {
    records = await data
  } catch {
    records = []
  }
  const options = distinctFilterOptions(records)
  return (
    <AttendanceFilters
      eventId={eventId}
      options={{ ...options, days: dayOptions(eventDate) }}
    />
  )
}

/**
 * Header-card day picker. Synchronous — options come from the event's
 * date range alone, so it renders with the header instead of streaming.
 */
function HeaderDayFilter({
  eventId,
  eventDate,
}: {
  eventId: string
  eventDate: string
}) {
  return (
    <DayFilter
      days={dayOptions(eventDate)}
      basePath={`/events/${eventId}`}
      layout="inline"
    />
  )
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage()

  const { eventId } = await params
  const raw = await searchParams
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v
  }
  const filters = parseAttendanceFilters(new URLSearchParams(flat))

  // Both reads start concurrently and the promise is created once, so the
  // header renders as soon as the event resolves while the filter facets
  // stream in via Suspense below. Both go through the persistent read
  // cache, so repeat views cost zero upstream roundtrips.
  const attendanceData = getAttendanceCachedFor(eventId)
  let event: Awaited<ReturnType<typeof getEventCachedFor>> | null = null
  try {
    event = await getEventCachedFor(eventId)
  } catch {
    notFound()
  }
  if (!event) notFound()
  // Keep the streaming child alive even if the options fetch fails later.
  void attendanceData.catch(() => [])

  const org = event.orgId
    ? await getOrganizationCachedFor(event.orgId).catch(() => null)
    : null

  return (
    <div className="flex flex-col gap-4">
      <Card className="clay-topglow">
        <CardContent className="gap-4">
          <div className="flex flex-wrap items-start gap-2">
            <EventStatusBadge status={event.status} />
            <span className="clay-pressed inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
              {event.id}
            </span>
            <span className="ml-auto">
              <HeaderDayFilter eventId={event.id} eventDate={event.date} />
            </span>
          </div>
          <div className="-mt-4">
            <CardTitle className="display">{event.name}</CardTitle>
            {event.description ? (
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                {event.description}
              </p>
            ) : null}
          </div>
          <dl className="flex flex-col gap-2">
            {org?.name ? (
              <div className="flex items-center gap-1.5 text-sm">
                <Building2
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <dd className="font-semibold">{org.name}</dd>
              </div>
            ) : null}
            <div className="clay-pressed grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-3">
              <div className="flex items-center gap-1.5 text-sm">
                <CalendarDays
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <dd className="font-semibold">{formatEventDate(event.date)}</dd>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <dd className="font-semibold">{event.time || "—"}</dd>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <MapPin
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <dd className="font-semibold">{event.location || "—"}</dd>
              </div>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {event.status === "Active" ? (
              <Link
                href={`/events/${event!.id}/check-in`}
                className={buttonVariants({
                  className: "clay-btn clay-btn-primary",
                })}
              >
                <ScanLine className="size-4" aria-hidden /> Take Attendance
              </Link>
            ) : null}
            <ExportButton eventId={event.id} filters={filters} />
            <RefreshButton />
            <QueueSyncPanel eventId={event.id} />
            <EventFormDialog event={event} />
            <span className="sm:ml-auto">
              <EventActions event={event} />
            </span>
          </div>
        </CardContent>
      </Card>
      <ReportSummary eventId={event.id} />
      <React.Suspense fallback={<FilterSkeleton />}>
        <FilterSection eventId={event.id} eventDate={event.date} data={attendanceData} />
      </React.Suspense>
      <AttendanceTable eventId={event.id} filters={filters} />
    </div>
  )
}

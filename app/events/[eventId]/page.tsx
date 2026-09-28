import Link from "next/link"
import { notFound } from "next/navigation"
import { ScanLine } from "lucide-react"
import { getEvent } from "@/integration/events"
import { getAttendance } from "@/integration/attendance"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EventActions } from "@/components/events/EventActions"
import { EventStatusBadge } from "@/components/events/EventStatusBadge"
import { AttendanceFilters } from "@/components/attendance/AttendanceFilters"
import { AttendanceTable } from "@/components/attendance/AttendanceTable"
import { ExportButton } from "@/components/attendance/ExportButton"
import { ReportSummary } from "@/components/reports/ReportSummary"
import { formatEventDate } from "@/lib/format"
import {
  distinctFilterOptions,
  parseAttendanceFilters,
  type FilterOptions,
} from "@/lib/attendance"

export const revalidate = 10

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { eventId } = await params
  const raw = await searchParams
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v
  }
  const filters = parseAttendanceFilters(new URLSearchParams(flat))

  let event: Awaited<ReturnType<typeof getEvent>> | null = null
  try {
    event = await getEvent(eventId)
  } catch {
    notFound()
  }
  if (!event) notFound()

  // Dropdown options come from the full attendance list (never the filtered
  // view). Failure here must not break the page — fall back to empty facets.
  let options: FilterOptions = { colleges: [], programs: [], yearLevels: [], genders: [] }
  try {
    options = distinctFilterOptions(await getAttendance(eventId))
  } catch {
    // keep empty options; search box and table handle their own states
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{event.name}</CardTitle>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {event.id} · {formatEventDate(event.date)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </CardHeader>
        <CardContent>
          {event.description ? <p className="text-sm">{event.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            <EventActions event={event} />
            {event.status === "Active" ? (
              <Link
                href={`/events/${event!.id}/check-in`}
                className={buttonVariants({ size: "sm", className: "clay-btn" })}
              >
                <ScanLine className="size-4" aria-hidden /> Take Attendance
              </Link>
            ) : null}
            <ExportButton eventId={event.id} filters={filters} />
          </div>
        </CardContent>
      </Card>
      <ReportSummary eventId={event.id} />
      <AttendanceFilters eventId={event.id} options={options} />
      <AttendanceTable eventId={event.id} filters={filters} />
    </div>
  )
}

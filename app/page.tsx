import Link from "next/link"
import { ScanLine, CalendarPlus } from "lucide-react"
import { getEvents } from "@/integration/events"
import { buttonVariants } from "@/components/ui/button"
import { EventSection } from "@/components/dashboard/EventSection"
import { StatCards } from "@/components/dashboard/StatCards"

export const revalidate = 30

export default async function DashboardPage() {
  let events: Awaited<ReturnType<typeof getEvents>> = []
  let error: string | null = null
  try {
    events = await getEvents()
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load events."
  }

  const active = events.filter((e) => e.status === "Active")
  const upcoming = events.filter((e) => e.status === "Upcoming")
  const closed = events.filter((e) => e.status === "Closed")

  return (
    <div className="flex flex-col gap-6">
      <div className="clay-hero flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="overline opacity-80">School Event Attendance</p>
          <h1 className="display mt-1">
            {active.length > 0
              ? `${active.length} live check-in${active.length === 1 ? "" : "s"} right now`
              : "Ready for check-ins"}
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {active.length > 0
              ? "Students can scan their SR Code at any active event kiosk."
              : "Mark an event Active to open its kiosk, or create a new event."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {active.length > 0 ? (
            <Link
              href={`/events/${active[0].id}/check-in`}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/95 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition-transform hover:-translate-y-px"
            >
              <ScanLine className="size-4" aria-hidden /> Open kiosk
            </Link>
          ) : null}
          <Link
            href="/events"
            className={buttonVariants({ variant: "outline", className: "min-h-11 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white" })}
          >
            <CalendarPlus className="size-4" aria-hidden /> Manage events
          </Link>
        </div>
      </div>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">
          {error} Check <span className="font-mono">APPS_SCRIPT_URL</span> configuration.
        </p>
      ) : null}
      <StatCards active={active.length} upcoming={upcoming.length} closed={closed.length} />
      <EventSection title="Active events" events={active} empty="No active events. Mark an upcoming event Active to start check-ins." />
      <EventSection title="Upcoming events" events={upcoming} empty="No upcoming events." />
      <EventSection title="Closed events" events={closed} empty="No closed events." />
    </div>
  )
}

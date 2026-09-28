import Link from "next/link"
import { ArrowRight } from "lucide-react"
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
  const total = events.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="overline text-muted-foreground">
            Overview{total > 0 ? ` · ${total} event${total === 1 ? "" : "s"} total` : ""}
          </p>
          <h1 className="display mt-1">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Active, upcoming, and closed school events at a glance.
          </p>
        </div>
        <Link
          href="/events"
          className={buttonVariants({ variant: "outline", className: "clay-btn min-h-11" })}
        >
          Manage events <ArrowRight className="size-4" aria-hidden />
        </Link>
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

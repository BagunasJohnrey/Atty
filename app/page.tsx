import { getEvents } from "@/integration/events"
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
      <div>
        <h1 className="display">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active, upcoming, and closed school events at a glance.
        </p>
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

import { getEvents } from "@/integration/events"
import { EventCard } from "@/components/events/EventCard"
import { EventFormDialog } from "@/components/events/EventFormDialog"

export const revalidate = 30

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const status = params.status ?? "All"
  const q = (params.q ?? "").toLowerCase()

  let events: Awaited<ReturnType<typeof getEvents>> = []
  let error: string | null = null
  try {
    events = await getEvents()
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load events."
  }

  const filtered = events.filter((e) => {
    if (status !== "All" && e.status !== status) return false
    if (q && !`${e.name} ${e.id} ${e.location}`.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">Create, open, and track school events.</p>
        </div>
        <EventFormDialog />
      </div>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="clay p-4 text-sm text-muted-foreground">No events match. Create the first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

import { EventCard } from "@/components/events/EventCard"
import type { SchoolEvent } from "@/models/event"

export function EventSection({ title, events, empty }: { title: string; events: SchoolEvent[]; empty: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-bold tracking-wide uppercase">{title}</h2>
      {events.length === 0 ? (
        <p className="clay px-4 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  )
}

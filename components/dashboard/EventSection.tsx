import { CalendarX2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EventCard } from "@/components/events/EventCard"
import type { SchoolEvent } from "@/models/event"

export function EventSection({ title, events, empty }: { title: string; events: SchoolEvent[]; empty: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="overline">{title}</h2>
        <Badge variant="neutral">{events.length}</Badge>
      </div>
      {events.length === 0 ? (
        <p className="clay clay-dashed flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
          <CalendarX2 className="size-4 shrink-0" aria-hidden /> {empty}
        </p>
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

import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatEventDate } from "@/lib/format"
import type { SchoolEvent } from "@/models/event"
import { EventStatusBadge } from "./EventStatusBadge"

export function EventCard({ event }: { event: SchoolEvent }) {
  return (
    <Card className="clay-topglow transition-transform hover:-translate-y-0.5">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{event.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {event.id} · {formatEventDate(event.date)}
          </p>
        </div>
        <EventStatusBadge status={event.status} />
      </CardHeader>
      <CardContent>
        {event.location ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> {event.location}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link href={`/events/${event.id}`} className={buttonVariants({ size: "sm" })}>
            Open <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          {event.status === "Active" ? (
            <Link
              href={`/events/${event.id}/check-in`}
              className={buttonVariants({ size: "sm", variant: "secondary" })}
            >
              Take Attendance
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

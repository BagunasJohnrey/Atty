import { Badge } from "@/components/ui/badge"
import type { EventStatus } from "@/models/event"

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const variant =
    status === "Active" ? "active" : status === "Upcoming" ? "upcoming" : "closed"
  return <Badge variant={variant}>{status}</Badge>
}

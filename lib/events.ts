import type { EventStatus, SchoolEvent } from "@/models/event"
import { EVENT_STATUSES } from "@/models/event"
import { manilaDayKey, toDateInputValue } from "@/lib/format"

/** Status tabs shown on the events listing, in display order. */
export const EVENT_FILTER_TABS = [
  "All",
  "Active",
  "Upcoming",
  "Closed",
] as const

export type EventFilterTab = (typeof EVENT_FILTER_TABS)[number]

/**
 * Reads ?status= with a safe fallback. Hand-edited junk degrades to "All"
 * instead of an empty listing.
 */
export function parseEventStatusParam(
  value: string | undefined
): EventFilterTab {
  return (EVENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as EventStatus)
    : "All"
}

/**
 * Every Manila day an event spans, as `YYYY-MM-DD` in order. Single dates
 * yield one day; stored ranges (numeric or pretty) enumerate inclusively.
 * Unparseable input yields nothing, so day pickers stay hidden instead of
 * offering junk. Iteration rides UTC noon to stay DST-proof everywhere.
 */
export function eventDays(date: string): string[] {
  const halves = date.split(" - ")
  if (halves.length > 2) return []
  const starts = halves.map((half) => toDateInputValue(half))
  if (starts.some((iso) => !iso)) return []
  const [y1, m1, d1] = starts[0].split("-").map(Number)
  const last = starts.length > 1 ? starts[1] : starts[0]
  const [y2, m2, d2] = last.split("-").map(Number)
  let cursor = Date.UTC(y1, m1 - 1, d1, 12)
  const end = Date.UTC(y2, m2 - 1, d2, 12)
  if (end < cursor) return [manilaDayKey(new Date(cursor))]
  const days: string[] = []
  while (cursor <= end) {
    days.push(manilaDayKey(new Date(cursor)))
    cursor += 86400000
  }
  return days
}

/**
 * Start of an event as epoch millis. Handles both stored shapes: a single
 * ISO date and the pretty range "November 1, 2026 - November 3, 2026".
 * Unparseable dates sink (POSITIVE_INFINITY) so broken rows never lead.
 */
export function eventStartTime(event: SchoolEvent): number {
  const first = event.date.split(" - ")[0]?.trim() ?? ""
  const time = new Date(first).getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

const STATUS_RANK: Record<EventStatus, number> = {
  Active: 0,
  Upcoming: 1,
  Closed: 2,
}

/**
 * Listing order for the events page: actionable groups first
 * (Active → Upcoming → Closed), soonest upcoming first (ascending) and
 * most recently closed first (descending). Unknown statuses sink to the
 * end in backend order.
 */
export function sortEventsForListing(events: SchoolEvent[]): SchoolEvent[] {
  return [...events].sort((a, b) => {
    const rankA = STATUS_RANK[a.status] ?? 99
    const rankB = STATUS_RANK[b.status] ?? 99
    if (rankA !== rankB) return rankA - rankB
    const startA = eventStartTime(a)
    const startB = eventStartTime(b)
    // Closed reads as history (most recent first); everything else reads
    // as a schedule (soonest first).
    return a.status === "Closed" ? startB - startA : startA - startB
  })
}

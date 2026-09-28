import { CalendarCheck, CalendarClock, Archive } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export function StatCards({ active, upcoming, closed }: { active: number; upcoming: number; closed: number }) {
  const stats = [
    { label: "Active events", value: active, icon: CalendarCheck, tile: "clay-tile-mint", tag: "Live", variant: "active" as const },
    { label: "Upcoming events", value: upcoming, icon: CalendarClock, tile: "clay-tile-peach", tag: "Soon", variant: "upcoming" as const },
    { label: "Closed events", value: closed, icon: Archive, tile: "clay-tile-frost", tag: "Done", variant: "closed" as const },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon, tile, tag, variant }) => (
        <Card key={label} className="clay-topglow">
          <CardContent className="flex-row items-center gap-3">
            <span className={`${tile} flex size-11 items-center justify-center rounded-2xl`} aria-hidden>
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-2xl font-extrabold tabular-nums">{value}</span>
              <span className="block text-xs font-medium text-muted-foreground">{label}</span>
            </span>
            <Badge variant={variant}>{tag}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

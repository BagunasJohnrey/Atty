import { CalendarCheck, CalendarClock, Archive } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function StatCards({ active, upcoming, closed }: { active: number; upcoming: number; closed: number }) {
  const stats = [
    { label: "Active events", value: active, icon: CalendarCheck, tile: "clay-tile-mint" },
    { label: "Upcoming events", value: upcoming, icon: CalendarClock, tile: "clay-tile-peach" },
    { label: "Closed events", value: closed, icon: Archive, tile: "clay-tile-frost" },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon, tile }) => (
        <Card key={label} className="clay-topglow">
          <CardContent className="flex-row items-center gap-3">
            <span className={`${tile} flex size-11 items-center justify-center rounded-2xl`} aria-hidden>
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-2xl font-bold tabular-nums">{value}</span>
              <span className="block text-xs text-muted-foreground">{label}</span>
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

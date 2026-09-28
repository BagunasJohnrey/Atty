import { CalendarCheck, CalendarClock, Archive } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function StatCards({ active, upcoming, closed }: { active: number; upcoming: number; closed: number }) {
  const stats = [
    { label: "Active events", value: active, icon: CalendarCheck },
    { label: "Upcoming events", value: upcoming, icon: CalendarClock },
    { label: "Closed events", value: closed, icon: Archive },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex-row items-center gap-3">
            <span className="clay-pressed flex size-10 items-center justify-center" aria-hidden>
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

import { Download } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { exportUrl } from "@/lib/api-client"
import type { AttendanceFilters } from "@/lib/attendance"

export function ExportButton({ eventId, filters }: { eventId: string; filters: AttendanceFilters }) {
  return (
    <a
      href={exportUrl(eventId, filters)}
      download
      className={buttonVariants({ variant: "outline", size: "sm", className: "clay-btn" })}
    >
      <Download className="size-3.5" aria-hidden /> Export CSV
    </a>
  )
}

import { FileText } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { printUrl } from "@/lib/api-client"
import type { AttendanceFilters } from "@/lib/attendance"

export function ExportButton({ eventId, filters }: { eventId: string; filters: AttendanceFilters }) {
  return (
    <a
      href={printUrl(eventId, filters)}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant: "outline", size: "sm", className: "clay-btn" })}
    >
      <FileText className="size-3.5" aria-hidden /> Export PDF
    </a>
  )
}

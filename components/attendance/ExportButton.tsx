"use client"

import { useSearchParams } from "next/navigation"
import { FileText } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { printUrl } from "@/lib/api-client"
import { parseAttendanceFilters } from "@/lib/attendance"
import type { AttendanceFilters } from "@/lib/attendance"

export function ExportButton({
  eventId,
}: {
  eventId: string
  /**
   * SSR snapshot of the URL filters, kept so the server can keep passing
   * what it parses. The live URL below wins on the client.
   */
  filters: AttendanceFilters
}) {
  const params = useSearchParams()
  // Same live-URL pattern as the table: the print link must carry the
  // picked day the moment it is chosen, not after the server re-renders.
  const filters = parseAttendanceFilters(
    new URLSearchParams(params.toString())
  )
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

"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildAttendanceReportPdf, blobToDataUrl, reportPdfFilename } from "@/lib/reports/pdf"
import type {
  ReportEventMeta,
  ReportRow,
} from "@/components/reports/PaginatedReport"

/** One-click PDF download: builds the attendance report client-side
    (legal landscape, same content as the print preview) and saves it as
    `YYYY-MM-DD_AttendanceReport_EventName.pdf` without opening the print
    dialog. */
export function DownloadPdfButton({
  eventMeta,
  orgName,
  orgEmail,
  rows,
}: {
  eventMeta: ReportEventMeta
  orgName: string
  orgEmail: string
  rows: ReportRow[]
}) {
  const [busy, setBusy] = React.useState(false)

  async function download() {
    if (busy) return
    setBusy(true)
    try {
      // Same seal the print preview shows. Never blocks the download:
      // offline or missing asset falls back to the text-only letterhead.
      let logoDataUrl: string | undefined
      try {
        const res = await fetch("/bsu-tneu-logo.png", { cache: "force-cache" })
        if (res.ok) logoDataUrl = await blobToDataUrl(await res.blob())
      } catch {
        logoDataUrl = undefined
      }
      const bytes = buildAttendanceReportPdf({
        eventMeta,
        orgName,
        orgEmail,
        rows,
        logoDataUrl,
      })
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: "application/pdf",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = reportPdfFilename(eventMeta)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button className="clay-btn" disabled={busy} onClick={download}>
      <Download className="size-4" aria-hidden />{" "}
      {busy ? "Generating…" : "Download PDF"}
    </Button>
  )
}

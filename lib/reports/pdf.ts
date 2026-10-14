import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatReportDate, toDateInputValue } from "@/lib/format"
import type {
  ReportEventMeta,
  ReportRow,
} from "@/components/reports/PaginatedReport"

const FOOTER_TEXT =
  "Leading Innovations, Transforming Lives, Building the Nation"

/**
 * Mirrors the `<colgroup>` in `PaginatedReport` (12% / 30% / 14% / 44% for
 * SR-CODE / FULL NAME / YEAR / PROGRAM), so the downloaded PDF preserves the
 * preview's table design instead of using autotable defaults.
 */
export const REPORT_TABLE_COLUMN_WIDTHS_PCT = [12, 30, 14, 44] as const

/** Body rows match the print preview `cell` exactly (Times 10pt, 3pt/6pt
    padding). Header stays 10pt bold to keep hierarchy. Do not restyle here —
    the PDF must mirror what print shows. */
export const REPORT_TABLE_BODY_FONT_SIZE_PT = 10
export const REPORT_TABLE_BODY_CELL_PADDING_PT = {
  top: 3,
  right: 6,
  bottom: 3,
  left: 6,
} as const

/** `@page` narrow margin (1.27cm = 0.5in = 36pt) on each side. */
const PAGE_MARGIN_PT = 36

/**
 * Vertical space the repeated header occupies. Continuation pages reserve
 * this via the table's top margin so rows never print over the header.
 * Matches the header block drawn below (letterhead + rule + org/event
 * lines ending near y=225).
 */
const HEADER_RESERVED_PT = 232

/** Gap between the seal and the letterhead text, mirroring the preview. */
export const LETTERHEAD_LOGO_GAP_PT = 14

/** Seal height in the PDF: a touch larger than the preview's 92px (69pt). */
export const LETTERHEAD_LOGO_HEIGHT_PT = 80

/** Nudge lifting the seal above vertical center (~4mm). */
export const LETTERHEAD_LOGO_LIFT_PT = 12

/**
 * Seal top edge: vertically centered in the letterhead block, then lifted
 * slightly toward the top.
 */
export function letterheadLogoY(
  top: number,
  bottom: number,
  logoHeight: number,
  lift: number = LETTERHEAD_LOGO_LIFT_PT
): number {
  return top + Math.max(0, (bottom - top - logoHeight) / 2) - lift
}

/**
 * Mirrors the preview's letterhead flex row (`justify-content: center`):
 * seal + text lay out as one centered unit, so the text block sits right of
 * page center to make room for the seal. Without a seal the text centers on
 * the page exactly as before.
 */
export function letterheadLayout(
  pageWidth: number,
  textBlockWidth: number,
  logoWidth: number | null,
  gap: number = LETTERHEAD_LOGO_GAP_PT
): { logoX: number | null; textCenterX: number } {
  if (logoWidth == null) return { logoX: null, textCenterX: pageWidth / 2 }
  const logoX = (pageWidth - (logoWidth + gap + textBlockWidth)) / 2
  return {
    logoX,
    textCenterX: logoX + logoWidth + gap + textBlockWidth / 2,
  }
}

/**
 * Download filename in `YYYY-MM-DD_AttendanceReport_EventName` form. A
 * selected day files under itself; otherwise the date takes the start of
 * the stored value (ranges file under day one); the name is dasherized and
 * stripped of filesystem-unsafe characters.
 */
export function reportPdfFilename(eventMeta: {
  name: string
  date: string
  day?: string
}): string {
  const day =
    eventMeta.day?.trim() || toDateInputValue(eventMeta.date) || "undated"
  const name =
    eventMeta.name
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-.]+/g, "") || "event"
  return `${day}_AttendanceReport_${name}.pdf`
}

/** Blob → `data:` URL (for embedding the letterhead seal into the PDF). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error("Read failed."))
    reader.readAsDataURL(blob)
  })
}

interface ReportHeaderArgs {
  doc: jsPDF
  pageWidth: number
  eventMeta: ReportEventMeta
  orgName: string
  logoDataUrl?: string
  logoWidth: number | null
  logoX: number | null
  textCenterX: number
  letterheadLines: {
    text: string
    size: number
    bold: boolean
    accent?: boolean
  }[]
}

/**
 * Draws the letterhead, rule, and org/event lines from the top of the
 * page. Returns the y below the block for the table to start at. Used
 * once for page 1 and again for every continuation page so the header
 * (like the footer) is present on all of them.
 */
function drawReportHeader(args: ReportHeaderArgs): number {
  const {
    doc,
    pageWidth,
    eventMeta,
    orgName,
    logoDataUrl,
    logoWidth,
    logoX,
    textCenterX,
    letterheadLines,
  } = args
  let y = 48
  const letterheadTop = y
  for (const line of letterheadLines) {
    doc.setFont("times", line.bold ? "bold" : "normal")
    doc.setFontSize(line.size)
    if (line.accent) doc.setTextColor(210, 54, 59)
    else doc.setTextColor(0, 0, 0)
    doc.text(line.text, textCenterX, y, { align: "center" })
    y += line.size * 1.25
  }
  doc.setTextColor(0, 0, 0)
  const letterheadBottom = y

  // A bad asset must never break the download, so failures fall back to
  // the text-only letterhead drawn above.
  if (logoDataUrl && logoWidth != null && logoX != null) {
    try {
      doc.addImage(
        logoDataUrl,
        "PNG",
        logoX,
        letterheadLogoY(
          letterheadTop,
          letterheadBottom,
          LETTERHEAD_LOGO_HEIGHT_PT
        ),
        logoWidth,
        LETTERHEAD_LOGO_HEIGHT_PT
      )
    } catch {
      // Keep the text-only letterhead.
    }
  }

  y += 2
  // Preview `hr`: 4pt solid black.
  doc.setLineWidth(4)
  doc.line(48, y, pageWidth - 48, y)
  y += 14

  doc.setFont("times", "bold")
  doc.setFontSize(12)
  doc.text(orgName, 48, y)
  y += 18

  doc.setFont("times", "normal")
  doc.setFontSize(11)
  doc.text(`Event: ${eventMeta.name}`, pageWidth / 2, y, { align: "center" })
  y += 16
  doc.text(
    `Date: ${formatReportDate(eventMeta.date, eventMeta.day)}  |  Time: ${eventMeta.time || " "}  |  Venue: ${eventMeta.location || " "}`,
    pageWidth / 2,
    y,
    { align: "center" }
  )
  y += 16
  y += 8
  return y
}

function drawReportFooter(doc: jsPDF, pageWidth: number): void {
  doc.setFont("helvetica", "bolditalic")
  doc.setFontSize(12)
  doc.setTextColor(210, 54, 59)
  doc.text(FOOTER_TEXT, pageWidth / 2, doc.internal.pageSize.getHeight() - 30, {
    align: "center",
  })
  doc.setTextColor(0, 0, 0)
}

export function buildAttendanceReportPdf(args: {
  eventMeta: ReportEventMeta
  orgName: string
  orgEmail: string
  rows: ReportRow[]
  /** PNG data URL for the letterhead seal. Omitted/unreadable → text-only. */
  logoDataUrl?: string
}): Uint8Array {
  const { eventMeta, orgName, orgEmail, rows, logoDataUrl } = args
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "legal",
  })
  const pageWidth = doc.internal.pageSize.getWidth()

  const letterheadLines: {
    text: string
    size: number
    bold: boolean
    accent?: boolean
  }[] = [
    { text: "Republic of the Philippines", size: 12, bold: true },
    { text: "BATANGAS STATE UNIVERSITY", size: 16, bold: true },
    {
      text: "The National Engineering University",
      size: 12,
      bold: true,
      accent: true,
    },
    { text: "Balayan Campus", size: 12, bold: true },
    {
      text: "Caloocan, Balayan, Batangas, Philippines 4213",
      size: 10,
      bold: true,
    },
    { text: "Tel Nos.: (+63 43) 980-0385 local 6101", size: 10, bold: false },
    {
      text: `E-mail Address: ${orgEmail} | Website Address: http://www.batstate-u.edu.ph`,
      size: 10,
      bold: false,
    },
  ]

  // Seal width from the image aspect; unreadable asset → text-only row.
  let logoWidth: number | null = null
  if (logoDataUrl) {
    try {
      const props = doc.getImageProperties(logoDataUrl)
      logoWidth = (props.width * LETTERHEAD_LOGO_HEIGHT_PT) / props.height
    } catch {
      logoWidth = null
    }
  }

  // Measure with the same font settings used for drawing, so the row the
  // layout centers is the row that actually prints.
  let textBlockWidth = 0
  for (const line of letterheadLines) {
    doc.setFont("times", line.bold ? "bold" : "normal")
    doc.setFontSize(line.size)
    textBlockWidth = Math.max(textBlockWidth, doc.getTextWidth(line.text))
  }
  const { logoX, textCenterX } = letterheadLayout(
    pageWidth,
    textBlockWidth,
    logoWidth
  )

  const y = drawReportHeader({
    doc,
    pageWidth,
    eventMeta,
    orgName,
    logoDataUrl,
    logoWidth,
    logoX,
    textCenterX,
    letterheadLines,
  })

  autoTable(doc, {
    startY: y,
    margin: {
      top: HEADER_RESERVED_PT,
      left: PAGE_MARGIN_PT,
      right: PAGE_MARGIN_PT,
    },
    theme: "grid",
    head: [["SR-CODE", "FULL NAME", "YEAR", "PROGRAM"]],
    body:
      rows.length > 0
        ? rows.map((r) => [r.srcode, r.name, r.yearLevel, r.program])
        : [["No attendance records.", "", "", ""]],
    // Preview `cell`: 1pt black border, 3pt/6pt padding, Times 10pt.
    // Header below reuses the same cell with bold + white fill.
    styles: {
      font: "times",
      fontSize: REPORT_TABLE_BODY_FONT_SIZE_PT,
      textColor: 0,
      fillColor: [255, 255, 255],
      lineColor: 0,
      lineWidth: 1,
      cellPadding: { ...REPORT_TABLE_BODY_CELL_PADDING_PT },
      halign: "left",
      valign: "middle",
    },
    // Preview header: same cell, bold uppercase on white.
    headStyles: {
      font: "times",
      fontStyle: "bold",
      fontSize: 10,
      textColor: 0,
      fillColor: [255, 255, 255],
      halign: "left",
      valign: "middle",
    },
    columnStyles: Object.fromEntries(
      REPORT_TABLE_COLUMN_WIDTHS_PCT.map((pct, i) => [
        i,
        {
          cellWidth: ((pageWidth - PAGE_MARGIN_PT * 2) * pct) / 100,
        },
      ])
    ),
    didDrawPage: (data: { pageNumber: number }) => {
      if (data.pageNumber > 1) {
        drawReportHeader({
          doc,
          pageWidth,
          eventMeta,
          orgName,
          logoDataUrl,
          logoWidth,
          logoX,
          textCenterX,
          letterheadLines,
        })
      }
      drawReportFooter(doc, pageWidth)
    },
  })

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer)
}

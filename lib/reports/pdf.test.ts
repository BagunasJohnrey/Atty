import { describe, expect, it } from "vitest"
import {
  LETTERHEAD_LOGO_HEIGHT_PT,
  LETTERHEAD_LOGO_LIFT_PT,
  REPORT_TABLE_BODY_CELL_PADDING_PT,
  REPORT_TABLE_BODY_FONT_SIZE_PT,
  REPORT_TABLE_COLUMN_WIDTHS_PCT,
  buildAttendanceReportPdf,
  letterheadLayout,
  letterheadLogoY,
  reportPdfFilename,
} from "./pdf"

const meta = {
  name: "Phase2 Verify",
  date: "2026-10-02",
  time: "12:00 pm - 1:00 am",
  location: "sa gate",
}

// 1x1 transparent PNG.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

describe("reportPdfFilename", () => {
  it("builds YYYY-MM-DD_AttendanceReport_EventName", () => {
    expect(
      reportPdfFilename({ name: "Phase2 Verify", date: "2026-10-02" })
    ).toBe("2026-10-02_AttendanceReport_Phase2-Verify.pdf")
  })

  it("normalizes stored dates and sanitizes the name", () => {
    expect(
      reportPdfFilename({ name: "Science Fair!", date: "11/15/2026" })
    ).toBe("2026-11-15_AttendanceReport_Science-Fair.pdf")
    expect(
      reportPdfFilename({
        name: "Fair",
        date: "November 15, 2026 - November 16, 2026",
      })
    ).toBe("2026-11-15_AttendanceReport_Fair.pdf")
  })

  it("falls back for blank meta", () => {
    expect(reportPdfFilename({ name: "  ", date: "" })).toBe(
      "undated_AttendanceReport_event.pdf"
    )
  })

  it("files a selected day under itself", () => {
    expect(
      reportPdfFilename({
        name: "Fair",
        date: "November 15, 2026 - November 16, 2026",
        day: "2026-11-16",
      })
    ).toBe("2026-11-16_AttendanceReport_Fair.pdf")
  })
})

describe("letterheadLayout", () => {
  it("renders the seal slightly larger than the preview's 92px", () => {
    expect(LETTERHEAD_LOGO_HEIGHT_PT).toBe(80)
  })

  it("nudges the seal slightly above vertical center", () => {
    expect(LETTERHEAD_LOGO_LIFT_PT).toBe(12)
    // Block 48–158 (110pt), seal 80pt: centered at 63, lifted to 51.
    expect(letterheadLogoY(48, 158, 80)).toBe(51)
  })

  it("centers the logo+text row as one unit like the preview flex row", () => {
    const pageWidth = 1008
    const textW = 400
    const logoW = 69
    const { logoX, textCenterX } = letterheadLayout(pageWidth, textW, logoW)
    expect(logoX).not.toBeNull()
    // Text block shifts right of page center to make room for the seal.
    expect(textCenterX).toBeGreaterThan(pageWidth / 2)
    // The whole row (seal + gap + text) is centered on the page.
    const rowRight = textCenterX + textW / 2
    expect(((logoX as number) + rowRight) / 2).toBeCloseTo(pageWidth / 2, 5)
    // 14pt gap between seal and text, mirroring the preview.
    expect(textCenterX - textW / 2 - ((logoX as number) + logoW)).toBeCloseTo(
      14,
      5
    )
  })

  it("centers text on the page when there is no logo", () => {
    const { logoX, textCenterX } = letterheadLayout(1008, 400, null)
    expect(logoX).toBeNull()
    expect(textCenterX).toBe(504)
  })
})

describe("buildAttendanceReportPdf", () => {
  it("mirrors the preview table column widths (12/30/14/44)", () => {
    expect(REPORT_TABLE_COLUMN_WIDTHS_PCT).toEqual([12, 30, 14, 44])
  })

  it("matches the print preview body rows exactly (10pt, 3pt/6pt padding)", () => {
    expect(REPORT_TABLE_BODY_FONT_SIZE_PT).toBe(10)
    expect(REPORT_TABLE_BODY_CELL_PADDING_PT).toEqual({
      top: 3,
      right: 6,
      bottom: 3,
      left: 6,
    })
  })

  it("returns PDF bytes containing the event name and one row per record", () => {
    const bytes = buildAttendanceReportPdf({
      eventMeta: meta,
      orgName: "Org",
      orgEmail: "org@example.edu",
      rows: [
        {
          key: "a",
          srcode: "23-16300",
          name: "BAGUNAS, JOHN REY V.",
          yearLevel: "FOURTH YEAR",
          program: "BSIT",
        },
      ],
    })
    expect(bytes.length).toBeGreaterThan(0)
    const text = Buffer.from(bytes).toString("latin1")
    expect(text.startsWith("%PDF")).toBe(true)
    expect(text).toContain("Phase2 Verify")
    expect(text).toContain("23-16300")
  })

  it("stays text-only when no logo is provided", () => {
    const bytes = buildAttendanceReportPdf({
      eventMeta: meta,
      orgName: "Org",
      orgEmail: "org@example.edu",
      rows: [],
    })
    expect(Buffer.from(bytes).toString("latin1")).not.toContain(
      "/Subtype /Image"
    )
  })

  it("embeds the letterhead logo when provided", () => {
    const bytes = buildAttendanceReportPdf({
      eventMeta: meta,
      orgName: "Org",
      orgEmail: "org@example.edu",
      rows: [],
      logoDataUrl: `data:image/png;base64,${TINY_PNG_BASE64}`,
    })
    const text = Buffer.from(bytes).toString("latin1")
    expect(text.startsWith("%PDF")).toBe(true)
    expect(text).toContain("/Subtype /Image")
  })

  it("still produces a valid PDF when there are no rows", () => {
    const bytes = buildAttendanceReportPdf({
      eventMeta: meta,
      orgName: "Org",
      orgEmail: "org@example.edu",
      rows: [],
    })
    const text = Buffer.from(bytes).toString("latin1")
    expect(text.startsWith("%PDF")).toBe(true)
    expect(text).toContain("No attendance records.")
  })

  it("repeats the header and footer on every page", () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      key: String(i),
      srcode: `26-${String(i).padStart(5, "0")}`,
      name: `Student ${i}`,
      yearLevel: "FIRST YEAR",
      program: "BSIT",
    }))
    const text = Buffer.from(
      buildAttendanceReportPdf({
        eventMeta: meta,
        orgName: "Org",
        orgEmail: "org@example.edu",
        rows,
      })
    ).toString("latin1")
    const pages = (text.match(/\/Type \/Page(?!s)/g) ?? []).length
    expect(pages).toBeGreaterThan(1)
    const headerHits = text.split("BATANGAS STATE UNIVERSITY").length - 1
    expect(headerHits).toBe(pages)
    const footerHits =
      text.split("Leading Innovations, Transforming Lives, Building the Nation")
        .length - 1
    expect(footerHits).toBe(pages)
  })
})

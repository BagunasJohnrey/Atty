# Reports

On-page summaries and the official print view for an event.

## Pages and routes

| Route | Purpose |
|---|---|
| (embedded in `/events/[eventId]`) | `ReportSummary` with charts |
| `/events/[eventId]/report/print` | Official paginated report, print-optimized (Legal landscape) |
| `GET /api/events/[eventId]/report` | Report data (cached 15s) |

## How it works

- **Day picker** (`DayFilter`, shared `?day=` param): options come from the
  event's date range in its details (`eventDays`), never from existing
  scans — a multi-day event offers its full range from day one; a one-day
  event shows no picker. `ReportSummary` narrows its tiles, sections, and
  charts to the picked day client-side from the URL; the table, filters,
  and Export PDF link read the same param (see attendance-records.md), so
  every consumer stays in sync.
- `ReportSummary` fetches via `useReport` and renders chart breakdowns
  (donut, category bars) with skeleton fallbacks while loading.
- The **print view** chunks rows into strict Legal-landscape sheets
  (`PaginatedReport` measure/chunk): repeated header/footer on every page,
  centered event details with Date/Time/Venue on one line, and a footer
  pinned to each page bottom. A single explicit Print button opens the
  dialog.
- The **Download PDF button** beside it is a true one-click file download
  (no print dialog): `DownloadPdfButton` builds the report in the browser
  with `lib/reports/pdf.ts` (jsPDF + jspdf-autotable) from the same rows
  the preview renders, then saves `{eventId}-attendance-report.pdf`.
- The PDF mirrors the print design — Legal landscape, 1.27cm margins, 1pt
  black grid, Times 10pt with 3pt/6pt padding, 12/30/14/44 columns, seal +
  letterhead as one centered row, red footer motto on every page. Shared
  constants (`REPORT_TABLE_COLUMN_WIDTHS_PCT`, body font/padding,
  `letterheadLayout`, `letterheadLogoY`) keep the two from drifting apart;
  print itself is untouched.
- The seal is fetched from `/bsu-tneu-logo.png` at click time (80pt tall,
  aspect-preserved, lifted ~4mm above vertical center). Offline or missing
  asset falls back to the text-only letterhead without blocking the
  download.
- The letterhead shows the owning organizer's name and email, falling back
  to the default council name/address when the event has none.
- Time and date print verbatim as stored; the tab reads
  `<name> · Attendance Report · Atty`.

## Key files

| File | Role |
|---|---|
| `components/reports/ReportSummary.tsx` | On-page charts (donut, bars) |
| `components/reports/PaginatedReport.tsx` | Sheet chunking for print |
| `components/reports/PrintButton.tsx`, `DownloadPdfButton.tsx` | Toolbar actions |
| `lib/reports/pdf.ts` | Client-side PDF builder (mirrors print design) |
| `lib/reports/pdf.test.ts`, `components/reports/DownloadPdfButton.test.tsx` | PDF builder + download coverage |
| `app/(app)/events/[eventId]/report/print/page.tsx` | Print page (server data, letterhead) |

## Related docs

- [organizers.md](organizers.md) — where the letterhead comes from
- [attendance-records.md](attendance-records.md) — the underlying rows

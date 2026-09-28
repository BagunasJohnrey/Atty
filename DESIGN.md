# DESIGN.md — School Event Attendance System (Frontend MVP)

> Scope: frontend only. Backend (`/api/*` → Apps Script → Sheets) is done. This doc drives UI build.
> Requirements source: `requirements.md` (FR-01..FR-10, §9 Dashboard/Event/Attendance, §13 NFRs).

## 1. Approaches considered

### A. Server-first thin pages (Recommended)
RSC pages fetch via `lib/api-client` with `next:{revalidate}`; interactivity isolated in small `'use client'` islands (`CheckInForm`, `EventFormDialog`, `AttendanceTable`). `dynamic()` lazy-loads reports/dialogs.
- Pros: fastest FCP, matches existing BFF cache (`private, max-age`), smallest client JS, easy `<400 lines/file`.
- Cons: needs careful client/server boundary discipline.
- Use for: all MVP routes.

### B. Full client SPA with query hooks
Everything client-fetches with useEffect + local cache.
- Pros: snappy transitions after load.
- Cons: larger bundle, worse SEO/FCP, duplicates server cache logic, kiosk on slow devices suffers.
- Rejected for MVP.

### C. PWA kiosk + admin split
Separate offline-first kiosk bundle + admin bundle.
- Pros: best for gym-door offline check-in.
- Cons: overkill for MVP (no service-worker infra, doubles routes). Defer to post-MVP.

**Decision: A.** Balanced MVP per user choice: Dashboard, Events, Check-in kiosk, Attendance list, Reports all functional with shared Claymorphism system.

## 2. Information architecture / routes

| Route | Server / Client | Purpose (req ref) |
|---|---|---|
| `/` Dashboard | RSC + client islands | Active / Upcoming / Closed sections (§9.1), stat cards (counts, total present today), CTA Take Attendance |
| `/events` | RSC list + client dialog | View Events, Create Event (FR-02), search + status filter |
| `/events/[eventId]` | RSC detail + tabs | Open/Close (FR-08), View Attendance, filters `?q=&college=&program=&yearLevel=&gender=`, CSV export link, report summary (FR-10) |
| `/events/[eventId]/check-in` | Client kiosk | Event info + SRCODE input + CHECK IN (FR-05, §9.3), success/duplicate/invalid states (FR-06, FR-01) |
| `/lookup` | Client | Standalone student lookup by SRCODE (FR-01) for staff verification |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | conventions | Skeletons, retry, 404 per route segment |

Deep-linking: `?status=` on `/events`, all attendance filters in URL for shareability. CSV export is plain anchor to existing `GET .../attendance/export` (no JS needed).

Auth placeholder: no login in MVP. `AppShell` reserves `UserSlot`; `middleware.ts` note documents where 3rd-party auth (e.g. Clerk/Auth.js) will gate `/events/*` later. No secrets in client — all calls go to same-origin `/api/*`.

## 3. File & component structure (MVP standard, <400 lines/file)

```
app/
  layout.tsx            # fonts, ThemeProvider, AppShell
  globals.css           # tokens + clay utilities (appended)
  page.tsx              # / dashboard (RSC)
  loading.tsx error.tsx not-found.tsx
  events/page.tsx
  events/[eventId]/page.tsx
  events/[eventId]/check-in/page.tsx
  lookup/page.tsx
components/
  layout/AppShell.tsx / SiteHeader.tsx / SideNav.tsx / ThemeToggle.tsx
  dashboard/StatCards.tsx StatCard.tsx EventSection.tsx
  events/EventCard.tsx EventStatusBadge.tsx EventFormDialog.tsx EventActions.tsx
  attendance/CheckInForm.tsx CheckInResult.tsx AttendanceTable.tsx AttendanceFilters.tsx ExportButton.tsx
  reports/ReportSummary.tsx BreakdownBar.tsx
  lookup/LookupForm.tsx
  ui/ card.tsx input.tsx badge.tsx dialog.tsx table.tsx skeleton.tsx sonner.tsx (shadcn-style, cva + @base-ui + cn)
  theme-provider.tsx (exists)
hooks/ useEvents.ts useEvent.ts useAttendance.ts useReport.ts useStudentLookup.ts
lib/ api-client.ts (typed fetch to /api/*) format.ts query.ts
models/ (exists: event.ts student.ts attendance.ts report.ts api.ts) — single source of truth
```

ShadcnUI: `components.json` (`base-nova`, `neutral`) respected. Existing `ui/button.tsx` untouched; new `ui/*` follow same `cva + cn` pattern so they remain shadcn swappable. Reusability rule: no route imports another route's component — shared UI lives in `components/*`.

SOLID: each component one job; data-fetch only in `lib/api-client` + `hooks/*`; presentation never calls `fetch` directly (except via hook).

## 4. Type safety / integration contract

Frontend talks only to Next BFF (`/api/events`, `/api/events/[id]/attendance`, `/report`, `/students/lookup`, `/export`). Reuse `models/*` + `ApiResult<T>` discriminated unions:

```ts
import type { SchoolEvent, Student, AttendanceRecord, AttendanceReport } from "@/models/*";
const res: EventsResponse | ApiFailure = await listEvents();
if (!res.success) // code: EVENT_NOT_ACTIVE | DUPLICATE_ATTENDANCE | SRCODE_NOT_FOUND ...
```

- `lib/api-client.ts`: typed wrappers (`listEvents`, `createEvent`, `getEvent`, `recordAttendance`, `checkAttendance`, `listAttendance(filters)`, `getReport`, `lookupStudent`), throws `ApiError(code,message,status)` on `success:false`.
- Validation mirrors `lib/api.ts`: `requireString` semantics client-side for instant feedback, server remains source of truth.
- No Apps Script URL/secret in client. No student PII duplicated — attendance rows join on render only.

## 5. Claymorphism design system

Soft school-friendly clay: pastel background `#E8EDF5` (dark: `#17181D`), cards `#F4F6FB` with `border-radius: 20-24px`, dual shadows:

```css
.clay { border:3px solid rgba(255,255,255,.7); border-radius:22px;
  box-shadow: 8px 8px 18px rgba(163,177,198,.45), -8px -8px 18px rgba(255,255,255,.9); }
.clay-pressed { box-shadow: inset 4px 4px 10px rgba(163,177,198,.5), inset -4px -4px 10px rgba(255,255,255,.8); }
```

- Status colors: Active=green, Upcoming=amber, Closed=slate; error=red, duplicate=orange — always paired with icon + text (not color-only).
- Typography: existing `IBM_Plex_Sans` + `Geist_Mono` for SRCODE/IDs. Min touch target 44px on kiosk. `prefers-reduced-motion` disables clay bounce.
- Dark mode via `next-themes` class; clay shadows inverted in `.dark`.
- Accessibility: labels on all inputs, `aria-live="polite"` on check-in result, focus trap in dialog (Base UI), keyboard: Enter submits, `/` focuses SRCODE on kiosk.

## 6. Performance: lazy loading, batching, caching

- Lazy: `next/dynamic(ssr:false)` for `EventFormDialog`, `ReportSummary`, `BreakdownBar`; `React.lazy+Suspense` skeletons per segment. No chart lib — CSS bars keep bundle ~0.
- Batch: attendance table paginates client-side (50/page); kiosk debounces lookup 250ms, batches recent-check-ins render via `useDeferredValue`; report breakdowns memoized.
- Cache: RSC `fetch(...,{next:{revalidate:30}})` for events (matches BFF 30s), 10s for attendance/report; client `hooks/*` implement SWR map (`stale-while-revalidate`, dedupe in-flight). Mutations call `router.refresh()` + cache invalidate by key prefix.
- Kiosk polling: `checkAttendance` pre-check only on submit (no hot poll) to respect Apps Script quotas (NFR-02).

## 7. Key interactions (states)

Check-in (`/events/[id]/check-in`): idle → submitting (pressed button, spinner) → success (green clay, name/program/year + timestamp) | duplicate (orange, existing timestamp) | invalid SRCODE (red) | event-not-active (slate, disabled input). Auto-uppercase SRCODE, autofocus, clear-after-success optional toggle, last-5 check-ins list.

Events: create dialog validates name/date (date ≥ today warning, not block), optimistic card insert → `router.refresh()`. Open/Close are confirm dialogs mapping to `POST .../open` / `PATCH ...` (empty body = close).

Reports: `ReportSummary` shows totalStudents/totalPresent/absent/rate + `BreakdownBar` per college/program/yearLevel/gender. Empty state when 0 present. Export button downloads CSV via same filters.

## 8. Testing / verification

- `vitest` for `lib/*` (filters, CSV, api-client error mapping) + hook cache keys.
- Manual E2E per `README.md` PowerShell block against dev server + test sheet.
- `npm run typecheck && npm run lint && npm test && npm run build` must pass. Verify 400-line limit: `Get-ChildItem -Recurse *.tsx,*.ts | % { $_ .LineCount }`.

## 9. Backend notes (no action now, flag for later)

- BFF already supports open/update/close/filter/export/report — frontend needs no new endpoints for MVP.
- Later: `GET /api/dashboard/summary` aggregation to avoid N+1 event fetches; rate-limit note for kiosk bursts; Apps Script quota retry with `Retry-After`.
- 3rd-party auth: add `middleware.ts` + `UserSlot`, move open/close/create to `role:staff` scope; secret stays server-only.

## 10. Build order

1. Tokens + `ui/*` clay primitives 2. Layout shell + nav 3. Dashboard 4. Events list + dialog 5. Check-in kiosk 6. Attendance table + filters + export 7. Reports 8. Lookup 9. Loading/error states 10. Verify + polish.

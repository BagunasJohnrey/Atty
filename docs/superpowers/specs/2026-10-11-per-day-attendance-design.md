# Per-Day Attendance for Multi-Day Events — Design

Date: 2026-10-11
Status: approved in chat (all 5 sections), pending spec review
Scope: allow one check-in per student per day at multi-day events.

## 1. Intent

Students attending a multi-day event must be able to sign attendance once
on each day, not once for the whole event. Single-day events keep
byte-identical behavior. Reports show a per-day breakdown plus an overall
summary. Both backends (Neon, Apps Script) implement the same rule behind
the existing `NEON_ATTENDANCE` flag.

## 2. Non-goals

- Restricting scans to the event's date range (staff control the kiosk;
  rejected as machinery without real-world gain).
- Changing kiosk UX, the offline queue shape, or sheet tab formats.
- Organizations (still Sheets-native).

## 3. Data model + migration

- Neon `attendance` gains `day date not null`. The primary key changes
  from `(event_id, srcode)` to `(event_id, srcode, day)`. The
  `(event_id, scanned_at)` index stays.
- One-time migration, applied to `dev` then `production`:
  1. `alter table attendance add column day date`
  2. backfill `day` from `scanned_at` in Asia/Manila
  3. drop old PK, install new PK
  A tested down-script (drop new PK, drop column, restore old PK) ships
  alongside for rollback.
- Sheets need no schema change: EVT tabs already store one row per scan.
- Offline queue needs no shape change: queued scans already carry device
  timestamps; replay attributes the scan to the *scan's* Manila day, so a
  scan taken offline yesterday and synced today counts for yesterday.

## 4. Record + check semantics

- **Record** (both backends): validate event Active + student exists
  (unchanged), insert with the scan's Manila day. Conflict on
  `(event_id, srcode, day)` reports `DUPLICATE_ATTENDANCE` with the
  message "Already recorded today." Same-day doubles rejected, next day
  accepted, race-proof via the PK as today.
- **Check** (validate step): `present` means *present today*. Scanned
  yesterday shows not-yet-present with no timestamp; scanned today shows
  present with today's timestamp.
- **API shapes unchanged**: `AttendanceCheck { present, timestamp?,
  student? }` and `RecordedAttendance { timestamp, student }` keep their
  fields with day-scoped meaning. No kiosk client changes required.

## 5. List, table + report

- **List** shape unchanged (`AttendanceRecord` per scan row); multi-day
  events return one row per student per day.
- **Attendance table** gains a Day column (Manila date). Filters and CSV
  export pick it up automatically.
- **Report**: per-day sections (present / absent / rate + grouped counts
  per day, computed over that day's scans) plus the overall summary:
  present = distinct students attending >= 1 day (rate never exceeds
  100%), with total scan count shown for context.
- Single-day events render exactly as today (one day section + summary).

## 6. Backup + Sheets mirror

- Neon→Sheets match key becomes `(event_id, srcode, day)`. Same-day
  re-backups update in place; a new day appends. No duplicates, no lost
  scans.
- Sheet format unchanged (`[Timestamp, SRCODE]`); timestamps already
  disambiguate days. Only the Next.js-side match key changes.
- Sheet-only rows stay counted-but-never-deleted, as today.

## 7. Rollout + ops

1. Migrate `dev` (column → backfill → PK), verify a 2-day test event
   locally end to end.
2. Repeat the migration on `production`.
3. Deploy once (no flags; the per-day rule is the behavior on both
   backends). Redeploy Apps Script (Manage deployments → New version)
   for the `attendance.gs` changes.
4. Rollback = redeploy old code AND run the down-script (old code's
   `ON CONFLICT (event_id, srcode)` cannot run against the new PK).

## 8. Test plan (for the implementation plan)

- Neon: same-day double insert → 1 row + duplicate; next-day insert →
  2nd row; backfill correctness on Manila-day boundaries; update path
  unaffected.
- Script harness: same-day rescan rejected, next-day accepted, tab rows
  accumulate.
- Integration: flag branches for record/check on both backends.
- Routes: record/check/list/report shapes unchanged (existing tests
  updated for multi-row fixtures).
- Component: Day column renders; report shows per-day sections.
- Load suite stays single-day (behavior identical).
- Full suite green, `tsc` + `eslint` clean.

## 9. Key files (expected)

| Area | Files |
|---|---|
| Neon | `integration/neon.ts` (record/check/list/report), migration SQL |
| Script | `apps-script/attendance.gs`, `Code.gs` (no router change — same actions) |
| Integration | `integration/attendance.ts`, `integration/reports.ts` (thin — mostly passthrough) |
| Backup | `integration/backup.ts` (match key) |
| UI | `components/attendance/AttendanceTable.tsx`, `components/reports/ReportSummary.tsx`, export path |
| Tests | neon/attendance/reports/backup/route/component suites |

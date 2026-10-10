# Neon Migration (Masterlist, Events, Attendance)

Status: **proposal (draft)** — 2026-10-10. Nothing below is implemented yet.
Decision 3 is settled by decision 1 (yearly import ritual); decisions 1–2
below are settled. Only implementation remains.

## 1. Goal

Move the **Masterlist, Events, and per-event attendance rows** (`[timestamp,
srcode]` only — student details are never duplicated, same rule as today)
into **Neon Postgres**, so reads become millisecond indexed queries instead
of full-sheet `getValues()` scans inside Apps Script containers. **Apps
Script drops to backup**: it stays deployed, tested, and flag-reachable, but
no longer serves primary traffic.

Non-goals: changing the check-in UX, removing the offline queue, or migrating
Organizations (stays in Sheets until a separate migration says so).

## 2. Current state (what hurts)

- `apps-script/students.gs` — `Students.index()` memoizes the Masterlist per
  warm container (5min TTL). A **cold container re-reads the entire sheet**;
  `CacheService` was tried and made things worse (see the comment at
  `students.gs:44-52`).
- `apps-script/attendance.gs`, `reports.gs` — joins attendance rows with the
  Masterlist **at read time, in the script container**.
- `integration/http.ts` — 15s timeout, 2 attempts, 302 warm-up, per-instance
  Map cache + inflight dedupe. Roundtrips dominate page latency.
- `integration/cached.ts` + `hooks/useCached.ts` — 10–30s TTL layers that
  hide the latency at the cost of staleness windows.
- Test scale reference: `apps-script/checkin-cost.test.ts` uses 2000
  Masterlist rows.

## 3. Target architecture

```
Browser (unchanged, offline queue unchanged)
  → Next.js BFF (app/api, integration/*)
      → Neon Postgres (primary): students, events, attendance
      → Apps Script   (backup) : same actions, flag-reachable, still tested
```

Reads and writes go to Neon behind per-domain flags (`NEON_STUDENTS`,
`NEON_EVENTS`, `NEON_ATTENDANCE`, each `neon|script`, default `script`).
The attendance join moves out of Apps Script into the Next layer: one Neon
query for the event's rows plus one batch `WHERE srcode = ANY($1)` for
student details. There is **no automatic fallback** on Neon errors —
failover is a manual flag flip, so a partial outage can never split writes
between two primaries.

## 4. Decisions (all settled)

| # | Question | Resolution |
|---|---|---|
| 1 | Who edits the Masterlist, how often? | **Decided: staff edits, once per school year** → Phase 3 is a manual yearly import; no sync machinery needed |
| 2 | Deploy target? | **Decided: Vercel (prod) + localhost (dev)** → use `@neondatabase/serverless` HTTP driver everywhere (no pooling issues on Vercel; identical code path locally) |
| 3 | Roster writer strategy? | **Settled by decision 1:** yearly manual import; Phase 3 prescribes the ritual |

Events and attendance need no writer decision: the app is their only writer
(staff never edit EVT-XXX sheets by hand), so Neon becomes their writer
directly in Phase 2, with Apps Script as the flag-flip backup.

## 5. Schema

```sql
create table students (
  srcode     text primary key,
  full_name  text not null,
  college    text not null default '',
  program    text not null default '',
  year_level text not null default '',
  gender     text not null default ''
);
create index on students (program);
create index on students (year_level);
-- Only if name search is added later:
-- create extension pg_trgm;
-- create index on students using gin (full_name gin_trgm_ops);
```

Column mapping mirrors `Config.MASTERLIST_HEADERS` in
`apps-script/config.gs`: SRCODE, Full Name, College, Program, Year Level,
Gender. See `models/student.ts` for the app-side shape (unchanged).

```sql
create table events (
  id          text primary key,  -- EVT-XXX
  name        text not null,
  event_date  text not null,     -- verbatim MM/dd/yyyy, as the sheet stores it
  status      text not null default 'Upcoming'
              check (status in ('Upcoming', 'Active', 'Closed')),
  sheet_name  text not null default '',  -- legacy ref, kept for backup correlation
  location    text not null default '',
  description text not null default '',
  org_id      text not null default '',
  time        text not null default ''   -- free text, printed verbatim
);
create index on events (status);

create table attendance (
  event_id   text not null references events (id) on delete cascade,
  srcode     text not null,
  scanned_at timestamptz not null,
  -- DB-level duplicate guard: replaces the sheet scan in attendance.gs.
  primary key (event_id, srcode)
);
create index on attendance (event_id, scanned_at);
```

Column mapping mirrors `Config.EVENTS_HEADERS` /
`Config.ATTENDANCE_HEADERS` (`apps-script/config.gs:16-28`): Event ID, Event
Name, Event Date, Status, Sheet Name, Location, Description, Org ID, Time;
Timestamp, SRCODE. See `models/event.ts`, `models/attendance.ts` (shapes
unchanged). New `EVT-XXX` ids are derived in a Neon transaction
(`max(id)+1` per prefix — safe because check-in concurrency lands on
attendance writes, never on event creation).

## 6. Phase 0 — Provision

1. Create a Neon project (free tier suffices to start) + the three tables
   above. Note the connection string.
2. Add env vars (names; see `integration/config.ts` for the existing
   pattern): `NEON_DATABASE_URL`, plus per-domain flags `NEON_STUDENTS`,
   `NEON_EVENTS`, `NEON_ATTENDANCE` (each `neon|script`, default `script`
   until its cutover).
3. Install `@neondatabase/serverless`. No pool config needed with the HTTP
   driver. Localhost uses the same driver and code path — put
   `NEON_DATABASE_URL` in `.env.local`, pointed at a **Neon branch** (never
   prod) for development.

## 7. Phase 1 — One-time import & verify

1. Export Masterlist, Events, and every EVT-XXX sheet → CSV.
2. Import via Neon dashboard or `psql \copy <table> from '<file>.csv' with
   csv header` per table.
3. Verify per table: `select count(*)` must equal the sheet counts
   (`Students.count()`, Events rows, per-event row counts); spot-check
   first/last srcodes and one full event; confirm no blank srcodes made it
   in (the sheet reader skips them — `students.gs:33`).

## 8. Phase 2 — Cut over behind flags (low risk, in this order)

1. **New `integration/neon.ts`** (one Neon client + `neon-students.ts`,
   `neon-events.ts`, `neon-attendance.ts`): PK/batch student reads; event
   CRUD; `recordAttendanceNeon` as `INSERT … ON CONFLICT (event_id, srcode)
   DO NOTHING RETURNING` — zero rows returned means duplicate, so the
   existing `DUPLICATE_ATTENDANCE` / already-present semantics hold without
   a prior scan. Unit-test each against a Neon branch (see §11).
2. **`lookupStudent`** (`NEON_STUDENTS`). Single-row path; verify kiosk
   lookups + `SRCODE_NOT_FOUND` unchanged.
3. **Event reads/writes** (`NEON_EVENTS`): `getEvents`, `getEvent`,
   create/update/open/close. Verify dashboard, pickers, and status badges.
4. **Attendance reads** (`NEON_ATTENDANCE` read side): `getAttendance` /
   `getAttendanceReport` become one Neon query for the event's rows plus one
   batch `= ANY($1)` for students. Keep response shapes
   (`models/attendance.ts`, `models/report.ts`) byte-identical so UI/tests
   don't move.
5. **Attendance writes** (`NEON_ATTENDANCE` write side): validate event
   Active + student exists (mirroring `attendance.gs`), then the
   conflict-guarded insert. Verify record/check/duplicate + offline-queue
   sync paths end to end.
6. **Cache retune** (`integration/cached.ts`): roster reads go long-TTL
   (e.g. 1h, keyed by srcode) with explicit `revalidateTag` on roster
   import (§9). Keep event/attendance TTLs (30s/10s) — those change during
   events.
7. Each flag flips back independently for instant rollback (env change +
   revalidate — no code change). Apps Script stays deployed and its harness
   tests stay green the whole time: that is what "backup" means here.

## 9. Phase 3 — Yearly roster import (decision 1 settled this)

The roster changes once per school year, so there is no sync to build and
no lag to accept — just a manual ritual each June (or whenever enrollment
finalizes). Events/attendance need nothing here — the app is already their
only writer.

1. Export the new Masterlist sheet → CSV (same ritual as Phase 1 §7).
2. Back up the current `students` table first (`copy (select * from
   students) to 'students-<prev-year>.csv with csv header'`), then
   transactionally replace (truncate + copy in one transaction, or
   upsert-by-srcode if graduating cohorts must persist — pick one and
   document it).
3. Re-run the §7 verifications (counts, spot-checks, no blank srcodes),
   then `revalidateTag` the student caches.
4. Freeze the sheet afterward (protected range + banner pointing at Neon)
   so mid-year edits can't silently diverge from the database.

A scheduled daily sync was considered and rejected: it is pure overhead for
a dataset that moves once a year.

## 10. Phase 4 — Backup posture & cleanup

- Apps Script stays **deployed and green**: keep its harness tests running
  in CI and do a periodic backup drill (flip one domain flag to `script`,
  verify, flip back). An untested backup is not a backup.
- Shrink reliance on the script memo/caches as domains cut over, but leave
  the script code intact while any flag can still point at it.
- Use **Neon branches** for preview/test databases instead of sheet
  fixtures (`apps-script/script-harness.ts` seeds stay for script tests).

## 11. Testing

- New unit tests for each `neon-*.ts` module against a Neon **branch**
  (create per run, delete after — no fixture drift).
- Keep all existing Apps Script harness tests green under both flag values
  (backup path stays proven — this is the whole point of §10).
- Load check: time `getAttendance` for the largest event before/after; the
  win should be seconds → tens of milliseconds on warm paths.
- Contract checks: `SRCODE_NOT_FOUND`, `DUPLICATE_ATTENDANCE`, and
  already-present outcomes behave identically under both flags.
- Write-contention check: hammer `recordAttendance` for one event
  concurrently — the PK conflict guard must yield exactly one recorded row
  and duplicates for the rest, matching `attendance.gs` behavior.

## 12. Rollback

Flip the affected domain flag(s) (`NEON_STUDENTS` / `NEON_EVENTS` /
`NEON_ATTENDANCE`) back to `script` and revalidate. No data migration back
is needed while the sheets are untouched — but note Phase 2 step 5 starts
writing attendance to Neon, so after that point a rollback needs a
Neon→sheet replay of rows written since cutover; document that export query
when you build the writer. Same for the yearly roster import in Phase 3
(keep each year's backup CSV so any school year is restorable).

## 13. Checklist

- [ ] Decisions settled (roster: yearly; deploy: Vercel + localhost; writer: yearly ritual)
- [ ] Neon project + schema (3 tables) + env vars + flags
- [ ] CSV import (Masterlist, Events, EVT-XXX) + count/spot verification
- [x] `neon.ts` read/write layer + branch-based tests
- [x] `lookupStudent` cutover verified (unit + live round-trip on dev branch)
- [x] Event read/write cutover verified (unit + live lifecycle on dev: create→update→open→close)
- [x] Attendance read/write cutover verified (unit + live on dev: record→duplicate→check→list→report→closed-reject)
- [x] Lookup cache on the Neon path (5-min TTL, misses never cached; event/attendance TTLs unchanged — live data)
- [ ] Yearly roster import ritual documented for next school year
- [ ] Backup drill done per domain (flag flip, timings recorded)

## Related docs

- `docs/modules/backend-integration.md` — current Sheets bridge + caches
- `docs/requirements.md` — FR-01 Masterlist Lookup, §5.1 Masterlist
- `apps-script/students.gs` — why memoization, not CacheService
- `apps-script/checkin-cost.test.ts` — read-cost regression tests

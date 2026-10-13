# Per-Day Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One check-in per student per Manila day at multi-day events, with per-day report sections.

**Architecture:** Add a `day` date column to Neon `attendance` and promote the PK to `(event_id, srcode, day)`; both backends scope their duplicate guard to the scan's Manila day; reports group by day; the offline replay chain carries each scan's timestamp so replays land on the scan's day.

**Tech Stack:** Next.js + TypeScript (vitest), Neon Postgres (SQL migration), Apps Script ES5 (vm harness tests).

**Spec:** `docs/superpowers/specs/2026-10-11-per-day-attendance-design.md`

## Global Constraints

- TDD every task: failing test first, watch it fail, minimal code, watch it pass.
- Manila day everywhere: Asia/Manila calendar date, never UTC date, never server-local date.
- Both backends implement the same rule behind the existing `NEON_ATTENDANCE` flag; no new flags.
- API shapes stay backward compatible: new fields optional, existing tests updated only where the spec changes the contract.
- Single-day events behave exactly as today.
- Full suite + `tsc --noEmit` + `eslint` clean before each commit.

## Review Focus

- A scan at 23:59 and one at 00:01 Manila time land on different days (Task 3 test pins it).
- An offline scan taken yesterday and synced today counts for yesterday (Task 7 test pins it).
- Two simultaneous same-day scans for one student store exactly one row (Task 3 test pins it).
- Legacy rows keep their original Manila day after backfill (Task 1 verification pins it).
- Overall report rate never exceeds 100% no matter how many daily scans exist (Task 4 test pins it).

---

### Task 1: Migration SQL + apply to dev

**Files:**
- Create: `db/migrations/20261011_attendance_day_up.sql`
- Create: `db/migrations/20261011_attendance_day_down.sql`

**Interfaces:**
- Produces: the `day` column + `(event_id, srcode, day)` PK that Tasks 3–4 rely on.

- [ ] **Step 1: Write `db/migrations/20261011_attendance_day_up.sql`**

```sql
alter table attendance add column day date;
update attendance set day = (timezone('Asia/Manila', scanned_at))::date;
alter table attendance alter column day set not null;
alter table attendance drop constraint attendance_pkey;
alter table attendance add primary key (event_id, srcode, day);
```

- [ ] **Step 2: Write `db/migrations/20261011_attendance_day_down.sql`**

```sql
alter table attendance drop constraint attendance_pkey;
alter table attendance drop column day;
alter table attendance add primary key (event_id, srcode);
```

- [ ] **Step 3: Apply the up-script to the dev branch** via the Neon SQL editor (dev branch only, never production yet).
- [ ] **Step 4: Run verification queries on dev and record the output**

```sql
select count(*) from attendance;
select count(*) from attendance where day is null;
select conname from pg_constraint where conrelid = 'attendance'::regclass and contype = 'p';
select srcode, scanned_at, day from attendance order by scanned_at limit 5;
```

Expected: total count equals the pre-migration count, zero null days, PK is `(event_id, srcode, day)`, spot-checked days match the Manila date of their timestamps.
- [ ] **Step 5: Commit**

```bash
git add db/migrations/20261011_attendance_day_up.sql db/migrations/20261011_attendance_day_down.sql
git commit -m "feat(attendance): day-column migration for per-day check-ins"
```

### Task 2: Manila-day helper

**Files:**
- Modify: `lib/format.ts`
- Modify: `lib/format.test.ts`

**Interfaces:**
- Produces: `manilaDayKey(value: Date | string | number): string` returning `YYYY-MM-DD` in Asia/Manila. Consumed by Tasks 3, 4, 8.

- [ ] **Step 1: Write failing tests**

```typescript
expect(manilaDayKey(new Date("2026-10-11T15:59:00Z"))).toBe("2026-10-11") // 23:59 Manila
expect(manilaDayKey(new Date("2026-10-11T16:01:00Z"))).toBe("2026-10-12") // 00:01 Manila next day
expect(manilaDayKey("2026-10-11T08:00:00+08:00")).toBe("2026-10-11")
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/format.test.ts`
Expected: FAIL, function not defined.

- [ ] **Step 3: Implement `manilaDayKey` in `lib/format.ts`** via `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year/month/day })` (en-CA yields `YYYY-MM-DD`).
- [ ] **Step 4: Run to verify green**

Run: `npx vitest run lib/format.test.ts`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat(attendance): Manila-day key helper"
```

### Task 3: Neon record + check go day-scoped

**Files:**
- Modify: `integration/neon.ts` (`recordAttendanceNeon`, `checkAttendanceNeon`)
- Modify: `integration/neon.test.ts`

**Interfaces:**
- Consumes: `manilaDayKey` from Task 2.
- Produces: same exported signatures (plus optional `scannedAt` in Task 7); duplicate message "Already recorded today."

- [ ] **Step 1: Write failing tests** in `integration/neon.test.ts` (mock-sql style, mirroring the existing attendance tests):
  - same-day double insert resolves the first and rejects the second with `DUPLICATE_ATTENDANCE` without a second insert (capture insert values: `day` equals the Manila day of `scanned_at`);
  - scans straddling midnight Manila (23:59 vs 00:01) store two rows with different days;
  - two simultaneous same-day `recordAttendanceNeon` calls for one code store exactly one row (assert via the conflict path, not timing);
  - `checkAttendanceNeon` reports `present: false` for a student whose only scan was yesterday, and `present: true` with today's timestamp for a today scan.
- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run integration/neon.test.ts`
Expected: FAIL (inserts carry no `day`; check ignores day).
- [ ] **Step 3: Implement** — insert `(event_id, srcode, day, scanned_at)` with day from `manilaDayKey`, conflict target `(event_id, srcode, day)`, duplicate message "Already recorded today."; check constrains `day = manilaDayKey(now)` and returns today's row.
- [ ] **Step 4: Run to verify green**

Run: `npx vitest run integration/neon.test.ts`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add integration/neon.ts integration/neon.test.ts
git commit -m "feat(attendance): day-scoped record and check on Neon"
```

### Task 4: Neon per-day report + model types

**Files:**
- Modify: `models/report.ts` (add `AttendanceDayReport`, extend `AttendanceReport`)
- Modify: `integration/neon.ts` (`getAttendanceReportNeon`)
- Modify: `integration/neon.test.ts`

**Interfaces:**
- Produces: `AttendanceReport.days: AttendanceDayReport[]` where each day is `{ day: string; present: number; absent: number; rate: number; byCollege/byProgram/byYearLevel/byGender: GroupedCounts }`; overall `totalPresent` = distinct srcodes, plus new `totalScans: number`. Consumed by Task 8 UI.

- [ ] **Step 1: Write failing tests**: a 2-day, 2-student fixture (student A both days, student B day 1 only) yields two day sections with correct present/absent/rate, overall present 2 / absent `totalStudents - 2` / rate ≤ 100, `totalScans` 3.
- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run integration/neon.test.ts`
Expected: FAIL (no `days`, present counts rows).
- [ ] **Step 3: Implement** — group `listAttendanceRowsNeon` output by `manilaDayKey(timestamp)`; per-day counts over that day's rows; overall present over distinct srcodes.
- [ ] **Step 4: Run to verify green**

Run: `npx vitest run integration/neon.test.ts`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add models/report.ts integration/neon.ts integration/neon.test.ts
git commit -m "feat(reports): per-day breakdown with distinct-student totals"
```

### Task 5: Script record + check go day-scoped

**Files:**
- Modify: `apps-script/attendance.gs` (`hasAttendance`, `record`, `check`)
- Modify: `apps-script/script-harness.ts` (Utilities.formatDate honors `yyyy-MM-dd`)
- Modify: `apps-script/organizations.test.ts` (event suites live there)

**Interfaces:**
- Produces: same action names/shapes; day comparison via `Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd")`.

- [ ] **Step 1: Write failing harness tests**: same-day rescan rejected with `DUPLICATE_ATTENDANCE`; next-day scan appends a second row; `check` reports not-present for a yesterday-only student; timestamps on different Manila days accumulate two rows in `list`.
- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run apps-script/organizations.test.ts`
Expected: FAIL (any rescan rejected/accepted wrongly).
- [ ] **Step 3: Implement** — `hasAttendance` reads the timestamp + srcode columns and compares Manila days; `record`/`check` use it; extend the harness `formatDate` fake to format `yyyy-MM-dd` (other patterns keep current behavior).
- [ ] **Step 4: Run to verify green**

Run: `npx vitest run apps-script/`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add apps-script/attendance.gs apps-script/script-harness.ts apps-script/organizations.test.ts
git commit -m "feat(attendance): day-scoped record and check in Apps Script"
```

### Task 6: Backup matches on srcode + day

**Files:**
- Modify: `apps-script/backup.gs` (`upsertAttendance`)
- Modify: `apps-script/backup.test.ts`

**Interfaces:**
- Produces: same report shape; match key `(srcode, Manila-day-of-timestamp)`.

- [ ] **Step 1: Write failing harness tests**: a payload with two days for one srcode inserts two rows (today it overwrites day 1 with day 2); re-backup of the same payload reports untouched, not updated.
- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run apps-script/backup.test.ts`
Expected: FAIL (single row per srcode).
- [ ] **Step 3: Implement** — index existing rows by srcode + Manila day of their timestamp; same-day re-backup updates in place; new day appends; `seen`/`sheetOnly` keyed the same way.
- [ ] **Step 4: Run to verify green**

Run: `npx vitest run apps-script/backup.test.ts`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add apps-script/backup.gs apps-script/backup.test.ts
git commit -m "fix(backup): match attendance rows by srcode and day"
```

### Task 7: Replay carries the scan's timestamp

**Files:**
- Modify: `lib/api-client.ts` (`recordAttendance(eventId, srcode, scannedAt?)`)
- Modify: `app/api/events/[eventId]/attendance/route.ts` (optional numeric `scannedAt`, 400 on non-number)
- Modify: `integration/attendance.ts` (`recordAttendance(eventId, srcode, scannedAt?)`)
- Modify: `integration/neon.ts` (`recordAttendanceNeon(..., scannedAt?)` — day + `scanned_at` from override or now)
- Modify: `apps-script/attendance.gs` (`record` accepts optional timestamp, formatted like `now()`)
- Modify: `lib/offline/sync.ts` + `components/offline/QueueStatus.tsx` (`record(eventId, srcode, scannedAt)`; sync passes `scan.scannedAt`)
- Tests: `lib/offline/sync.test.ts`, route test, `integration/attendance.test.ts`, `integration/neon.test.ts`, harness test

**Interfaces:**
- Consumes: Task 3's day-scoped record.
- Produces: end-to-end scan-day attribution for replays; kiosk calls omit `scannedAt` (behavior unchanged).

- [ ] **Step 1: Write failing tests**: sync replays a yesterday scan and the stored row carries yesterday's day (assert via injected `record` receiving `scannedAt`, plus one Neon test that an explicit override sets day/`scanned_at`); route rejects a non-numeric `scannedAt` with 400.
- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/offline/sync.test.ts "app/api/events/[eventId]/attendance" integration/attendance.test.ts`
Expected: FAIL (timestamp dropped).
- [ ] **Step 3: Implement** the chain above; kiosk `CheckInForm` call site unchanged (omits the override).
- [ ] **Step 4: Run to verify green**

Run: same three suites plus `integration/neon.test.ts`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/api-client.ts "app/api/events/[eventId]/attendance/route.ts" integration/attendance.ts integration/neon.ts apps-script/attendance.gs lib/offline/sync.ts components/offline/QueueStatus.tsx lib/offline/sync.test.ts integration/attendance.test.ts integration/neon.test.ts
git commit -m "feat(offline): replays attribute scans to the scan day"
```

### Task 8: UI — Day column + per-day report

**Files:**
- Modify: `components/attendance/AttendanceTable.tsx` (Day column from `manilaDayKey(timestamp)`)
- Modify: `app/api/events/[eventId]/attendance/export/route.ts` (Day column in CSV)
- Modify: `components/reports/ReportSummary.tsx` (per-day sections + overall summary with `totalScans`)
- Tests: table/report component tests + export route test

**Interfaces:**
- Consumes: Task 2 helper, Task 4 `days`/`totalScans`.

- [ ] **Step 1: Write failing tests**: table renders the Manila day per row; export CSV header includes Day; summary renders one section per day plus overall present/absent/rate/scans.
- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/attendance/ components/reports/`
Expected: FAIL (no Day content).
- [ ] **Step 3: Implement** per the spec §5; single-day events render exactly as today (one section).
- [ ] **Step 4: Run to verify green**

Run: same suites
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add components/attendance/AttendanceTable.tsx "app/api/events/[eventId]/attendance/export/route.ts" components/reports/ReportSummary.tsx <test files>
git commit -m "feat(reports): day column and per-day report sections"
```

### Task 9: Production migration + final verification

**Files:** none (operations + optional `docs/modules/neon.md` match-key note).

- [ ] **Step 1: Apply the Task 1 up-script to the `production` branch** via the Neon SQL editor.
- [ ] **Step 2: Run the Task 1 verification queries on production**; counts equal, zero null days, new PK present.
- [ ] **Step 3: Run the full gate**: `npm test`, `npx tsc --noEmit`, `npx eslint` on touched files. All green.
- [ ] **Step 4: Deploy** (single deploy, no flags) and redeploy Apps Script (Manage deployments → New version); verify a live 2-day check-in cycle in production.

## Self-Review

1. **Spec coverage:** §3 migration → Task 1; Manila day → Task 2; §4 record/check → Tasks 3, 5, 7; §5 list/table/report → Tasks 4, 8; §6 backup → Task 6; §7 rollout → Task 9. Script `reports.gs` needs no change (it consumes the same list shape — grouped per day by the caller per Task 4's Neon parity; the implementer adds the identical grouping to `getAttendanceReportNeon`'s script counterpart in this task if the report action routes through Neon only — verified: `integration/reports.ts` routes by `NEON_ATTENDANCE`, script path computes in `reports.gs`, so Task 4 must also cover `apps-script/reports.gs`. Added below.)
2. **Step scan:** fixed — each test step names assertions, each code step names signatures.
3. **Type consistency:** `manilaDayKey(value: Date | string | number)`; `AttendanceDayReport { day: string; present/absent/rate: number; byCollege/byProgram/byYearLevel/byGender: GroupedCounts }`; `record(..., scannedAt?: number)` (ms epoch) across api-client, route, integration, sync.
4. **Review Focus:** all five have owning tests (Tasks 1, 3, 4, 7).
5. **Proportion:** signatures and assertions only; bodies appear solely for the SQL both tasks cannot determine.

**Fix applied during review:** Task 4 now explicitly includes the script-side report grouping.

### Task 4b: Script per-day report grouping

**Files:**
- Modify: `apps-script/reports.gs`, `apps-script/attendance.test.ts` (report suites live there; check exact file during implementation)

**Interfaces:**
- Produces: same `days`/`totalScans` semantics as Task 4 for the script backend.

- [ ] **Step 1: Write failing harness tests**: 2-day, 2-student fixture yields two day sections and distinct-student overall totals.
- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run apps-script/`
Expected: FAIL.
- [ ] **Step 3: Implement** — group `Attendance.list` output by Manila day (same `yyyy-MM-dd` comparison as Task 5).
- [ ] **Step 4: Run to verify green**

Run: `npx vitest run apps-script/`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add apps-script/reports.gs <report test file>
git commit -m "feat(reports): per-day grouping in Apps Script backend"
```

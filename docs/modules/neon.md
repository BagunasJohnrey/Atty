# Neon Data Layer

Neon Postgres is the primary store for students, events, and attendance;
Google Sheets (via Apps Script) is the flag-flip backup and the nightly
mirror target. Every domain below reads and writes exactly one backend at a
time, chosen by its cutover flag — never both, never merged.

## Cutover flags

| Flag | Area | `neon` | unset / anything else |
|---|---|---|---|
| `NEON_STUDENTS` | Student lookup | Indexed PK lookup + 5-min repeat cache | Apps Script Masterlist index |
| `NEON_EVENTS` | Event list/view/create/update/open/close | Indexed queries, same rules | Apps Script Events sheet |
| `NEON_ATTENDANCE` | Check, record, list, report | Validation + writes in Neon | Apps Script EVT tabs |

Reads, validation, and writes move together per domain: validation must see
the same store that writes land in, or duplicates slip through. Rollback per
flag is deleting the variable and redeploying — no code involved.

## How reads and writes work

All Neon access lives in `integration/neon.ts` (HTTP driver, no pool to
configure). The domain modules (`integration/students|events|attendance|
reports.ts`) pick the backend by flag; callers (BFF routes, pages, backup)
never know which one served them.

- **Students** — `lookupStudentNeon`: single PK query, snake→camel mapping.
  Unknown srcode throws the same `SRCODE_NOT_FOUND` the script path
  produces, so HTTP mapping (404) is unchanged.
- **Events** — full CRUD plus open/close with script-identical rules: same
  `EVT-<n>` sequencing (recomputed on unique-violation retry), same date
  normalization (`YYYY-MM-DD` or `MM/DD/YYYY` in, zero-padded `MM/DD/YYYY`
  out), same case-insensitive statuses, same unknown-field rejection on
  update, same closed-can't-reopen. Non-empty `orgId` still resolves against
  Organizations, which live in Sheets.
- **Attendance** — `recordAttendanceNeon` validates (event exists and Active,
  student exists) then inserts with `ON CONFLICT (event_id, srcode) DO
  NOTHING`: zero rows back means duplicate, reported as
  `DUPLICATE_ATTENDANCE` exactly like the script. `checkAttendanceNeon`
  runs the event and student reads concurrently, then the presence query.
  `listAttendanceNeon` joins scans to students in one query; the report
  aggregates with the script's formulas (rate, Unknown-bucket grouping).
- **Speed shape** — event + student reads fire together (`Promise.all`),
  repeats hit the 5-min student cache, duplicates are rejected by the
  primary key rather than a pre-scan. Misses (including 404s) are never
  cached.

## Sheets as backup (the mirror)

Direction is strictly Neon → Sheets; the sheet never feeds the app while a
flag is on. `integration/backup.ts` reads the Neon tables and pushes each
through bulk script actions (`backupEvents`, `backupAttendance` in
`apps-script/backup.gs`):

- Match by key (event id / event+srcode), update in place via batched
  writes, append new rows. Sheet-only rows are counted but **never
  deleted**; empty events leave their tab untouched (reported skipped).
- Timestamps normalize to sheet format (Manila) on write, healing older
  ISO rows on first pass.
- One event's failure is collected while the rest continue; the summary
  reports per-event `{ inserted, updated, untouched, sheetOnly }`.
- Students are excluded — the roster moves yearly (see Operations).

Triggers: manual **Back up to Sheets** button on the dashboard (admin
session) and nightly 2am PHT Vercel cron (`GET /api/admin/backup`) guarded
by `CRON_SECRET`, which fails closed when unset.

## Operations

**Environment** — localhost points at the `dev` branch, Vercel at
`production`. Never cross them:

```bash
# .env.local (localhost) — dev branch URL from Branches -> dev -> Connect
NEON_DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
NEON_STUDENTS=neon
NEON_EVENTS=neon
NEON_ATTENDANCE=neon
```

```bash
# Vercel production env vars (redeploy after any change)
NEON_DATABASE_URL=postgresql://...  # production branch URL
CRON_SECRET=<long random secret>     # cron Authorization bearer
NEON_STUDENTS=neon                   # add one domain at a time
NEON_EVENTS=neon
NEON_ATTENDANCE=neon
```

**Rollout order:** `NEON_STUDENTS` → verify kiosk → `NEON_EVENTS` →
verify pages → `NEON_ATTENDANCE` → verify a full check-in cycle.
**Rollback:** delete the flag, redeploy.

**Yearly roster ritual:** export the new Masterlist → back up `students`
first → transactionally replace → re-run count/spot checks → revalidate
caches → freeze the sheet. No sync job exists by design (the roster moves
once a year).

**Branches:** `production` is the verified copy (1036 students, 7 events,
18 scans at migration time); `dev` is disposable — it expires and gets
recreated, so never treat its data as durable.

**Still Sheets-native:** Organizations (small, rarely read) and the Apps
Script deployment itself, which is the fallback target.

## Key files

| File | Role |
|---|---|
| `integration/neon.ts` | Neon reads/writes, validation parity, error contracts |
| `integration/students\|events\|attendance\|reports.ts` | Flag branches (Neon vs script) |
| `integration/backup.ts` | Backup orchestration, per-event error collection |
| `integration/neon.test.ts`, `backup.test.ts`, `students|events|attendance|reports.test.ts` | Contract + flag coverage |
| `apps-script/backup.gs`, `Code.gs` (router) | Bulk upsert actions |
| `app/api/admin/backup/route.ts` | Manual POST (session) + cron GET (secret) |
| `components/admin/SheetsBackupButton.tsx` | Dashboard trigger + result toast |
| `vercel.json` | Nightly cron schedule |

## Related docs

- `plans/2026-10-10-neon-masterlist-migration.md` — original plan, schema,
  decisions, checklists
- `plans/2026-10-10-changes.md` — team changelog for the whole batch
- `modules/backend-integration.md` — Sheets bridge and caches (script side)

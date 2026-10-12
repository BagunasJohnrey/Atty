# Deploying to Vercel

How to take this app live (or re-deploy it), in order. Assumes the code is
already merged to `main`.

## 1. Push and import

1. Push `main` to GitHub.
2. Vercel → Add New Project → import the repository. Keep the
   auto-detected Next.js defaults.

## 2. Environment variables

Project → Settings → Environment Variables. Every row below is required
unless marked otherwise:

| Variable | Value | Notes |
|---|---|---|
| `APPS_SCRIPT_URL` | Deployed `/exec` URL | Same as local; see `getting-started.md` step 3 |
| `APPS_SCRIPT_SECRET` | Long random secret | Must match the script property |
| `ADMIN_SERVICE_KEY` | Long random secret | Must match the script property |
| `ADMIN_PIN` | 8-digit staff PIN | The login PIN |
| `SESSION_SECRET` | Long random secret | Rotating logs everyone out; safe pre-launch |
| `NEON_DATABASE_URL` | **Production** branch URL | Branches → `production` → Connect. Never the dev URL |
| `CRON_SECRET` | Long random secret | Authorizes the nightly backup cron |
| `NEON_STUDENTS` | — | Leave out on first deploy (see §5) |
| `NEON_EVENTS` | — | Leave out on first deploy |
| `NEON_ATTENDANCE` | — | Leave out on first deploy |
| `NEON_ORGANIZATIONS` | — | Leave out on first deploy |

Generate secrets with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Any env change needs a redeploy to take effect.

## 3. Deploy and verify the baseline

Deploy, then confirm the app behaves exactly like today (no flags set means
100% Sheets, by design):

1. Log in with the staff PIN.
2. Dashboard loads, events open, event pages render.
3. Dashboard → **Back up to Sheets** → success toast → Events and EVT tabs
   match the database.

If the backup button answers `Unknown action: backupEvents`, the Apps
Script deployment predates `backup.gs` — redeploy it (§4) and retry.

## 4. Apps Script backend

The Web App must include `backup.gs` plus the two `backupEvents` /
`backupAttendance` router lines in `Code.gs`. After any script change:
Deploy → Manage deployments → pencil → **New version**. The URL does not
change, so no env updates are needed. A first slow request afterwards is
normal (the app re-warms the redirect).

## 5. Move traffic to Neon, one flag at a time

Each flag switches one area from Sheets to Neon. Add it in Vercel env,
redeploy, verify, then move to the next. Rollback for any step: delete the
variable, redeploy — back on Sheets in minutes, no code involved.

1. **`NEON_STUDENTS=neon`** — kiosk lookup with a real srcode (correct
   student, fast) and a bogus one (same not-found message as before).
2. **`NEON_EVENTS=neon`** — dashboard, event pages, filters; open and close
   a throwaway event, then delete it.
3. **`NEON_ATTENDANCE=neon`** — full check-in cycle on a live or test
   event: record → duplicate scan rejected → attendance list and report
   counts correct.
4. **`NEON_ORGANIZATIONS=neon`** — Organizers page loads fast; create →
   edit → delete a throwaway organizer (deletes only stick for organizers
   with no events), and confirm an event report still prints the
   organizer letterhead.

## 6. Confirm the nightly backup

Project → Cron Jobs → `GET /api/admin/backup` (daily, 2am PHT). After its
first firing, check the run log and the sheet tabs' freshness. The manual
dashboard button remains available for on-demand runs.

## 7. Ongoing operations

- **Roster changes (yearly):** export the new Masterlist → back up
  `students` → transactionally replace → verify counts → revalidate caches
  → freeze the sheet. See `modules/neon.md`.
- **Sheets stays the mirror:** the backup never deletes sheet rows; it only
  adds and updates. A flag flip back to Sheets always has fresh data to
  fall back to — except organizers, which the backup does not cover (see
  the replay query in `modules/neon.md` before rolling that flag back).
- **Dev branch:** localhost points at it; it expires and gets recreated —
  never treat its data as durable.

## Related docs

- `getting-started.md` — local setup and Apps Script deployment
- `modules/neon.md` — data layer, flags, and operations reference
- `modules/backend-integration.md` — Sheets bridge and caches
- `api-security.md` — credentials and deployment posture

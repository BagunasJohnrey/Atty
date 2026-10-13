# Organizations Neon Migration

Status: **implemented 2026-10-12, pending dev verification**. The separate
migration that `2026-10-10-neon-masterlist-migration.md` §16 deferred:
organizers were the last Sheets-served domain, and every one of their
roundtrips costs seconds, so the Organizers page lagged visibly behind
every save while events (already on Neon) felt instant.

## Schema

`db/migrations/20261012_organizations_up.sql` (+ `_down.sql` rollback):

```sql
create table organizations (
  id    text primary key,  -- ORG-XXX
  name  text not null,
  email text not null default ''
);
```

One row per organizer; the app is the only writer. Email is stored
lowercase (enforced app-side on both backends).

## Code changes

| File | Role |
|---|---|
| `integration/neon-organizations.ts` | Neon CRUD with script-identical rules (own module: `neon.ts` and `organizations.ts` both import from it, so neither direction forms a cycle) |
| `integration/organizations.ts` | `NEON_ORGANIZATIONS` flag branch (`neon` vs default `script`) |
| `integration/neon.ts` | `assertOrgNeon` resolves event `orgId`s against the flagged backend |
| `integration/neon-organizations.test.ts` | Driver: sequencing, validation, lowercase, `ORG_NOT_FOUND` (13 tests) |
| `integration/organizations.test.ts` | Cutover block: Neon vs script routing (4 tests) |
| `integration/neon.test.ts` | Org-resolution follows the flag (2 tests) |
| `docs/modules/neon.md`, `organizers.md`, `backend-integration.md`, `deployment.md`, `.env.example` | Flag table, ops, rollout, rollback replay |

Rules carried over: `ORG-<n>` sequencing with unique-violation retry,
name required (≤150), email optional (≤150, blank clears), unknown update
keys rejected, hard delete returning the removed row, `ORG_NOT_FOUND` (404).

## Import ritual (dev branch first, then production)

1. Apply the up migration in the Neon SQL editor on the target branch.
2. Export the Organizations sheet → CSV, then:
   ```sql
   \copy organizations (id, name, email) from 'organizations.csv' with csv header;
   update organizations set email = lower(email);
   ```
3. Verify:
   ```sql
   select count(*) from organizations;  -- must equal the sheet row count
   select * from organizations order by id;  -- spot-check first/last rows
   select * from organizations where email <> lower(email);  -- must be 0 rows
   ```

## Cutover

1. Set `NEON_ORGANIZATIONS=neon` (`.env.local` → restart dev; Vercel env →
   redeploy for production), one environment at a time.
2. Verify: Organizers page loads fast; create → edit → delete flow;
   event organizer picker; printed report letterhead.
3. Rollback: delete the flag, redeploy — no code involved.

## Rollback caveat

Organizers are **not** part of the nightly Sheets backup, so a rollback
after a Neon write window would lose those rows. Replay first:

```sql
select id, name, email from organizations order by id;
```

Export CSV, paste into the Organizations sheet (columns: Org ID, Org Name,
Email), then flip the flag back.

## Decisions

- **Own driver module** instead of extending `neon.ts`: avoids a
  `neon ↔ organizations` import cycle and keeps both suites' mocks simple.
- **No backup parity**: the registry is a handful of rows that change
  rarely; the documented manual replay above covers rollback, matching the
  precedent in the masterlist plan §12 for post-cutover writers.

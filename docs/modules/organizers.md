# Organizers

The offices and schools using the tracker (`/organizations`, labeled
"Organizers" in the UI). An event may name one organizer, which then appears
on its printed report letterhead.

## Pages and routes

| Route | Purpose |
|---|---|
| `/organizations` | Organizer cards + add dialog |
| `GET/POST /api/organizations` | List / create (name required ≤150, email optional ≤150) |
| `GET/PATCH /api/organizations/[orgId]` | Details / update |
| `DELETE /api/organizations/[orgId]` | Soft delete (hides, keeps the row) |
| `POST /api/organizations/[orgId]/restore` | Undo a soft delete |

## How it works

- `OrganizationFormDialog` collects name + email; success fires a toast and
  refreshes the list. Validation errors stay inline in the dialog.
- The event creation form's organizer picker is required: events without an
  organizer fall back to the default council letterhead on print.
- Frontend-only naming rule: user-facing text says "Organizers"; URLs,
  component names, `orgId`, and the API keep "organizations".
- Data store: Neon when `NEON_ORGANIZATIONS=neon`, else Apps Script —
  see [neon.md](neon.md) for the cutover, import, and rollback replay.
  Emails are always stored lowercase on both backends.

## Key files

| File | Role |
|---|---|
| `app/(app)/organizations/page.tsx` | Listing page |
| `components/organizations/OrganizationCard.tsx` | Organizer card |
| `components/organizations/OrganizationList.tsx` | Instant list (applies mutation responses locally) |
| `components/organizations/OrganizationFormDialog.tsx` | Create/edit dialog |
| `app/api/organizations/**` | CRUD + restore endpoints |
| `integration/neon-organizations.ts` | Neon CRUD behind `NEON_ORGANIZATIONS` |
| `db/migrations/20261012_organizations_*.sql` | Table + rollback |

## Related docs

- [events.md](events.md) — the organizer picker in event creation
- [reports.md](reports.md) — the letterhead fallback

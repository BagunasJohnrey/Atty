# Check-in (Kiosk)

The door tablet flow at `/events/[eventId]/check-in`: look up a student by
SR code, verify whether they already attended, and record attendance with
one tap. Only `Active` events accept records — and only on the event's own
dates (see "Event dates gate" below).

## How it works

- `CheckInForm` validates the SR code format (`00-00000`) before any request.
- **Verify first** (`POST …/attendance/check`): if the student already
  attended, the form shows the original timestamp instead of recording again —
  duplicate scans can never create a second row.
- **Record** (`POST …/attendance`): appends `[Timestamp, SRCODE]` to the
  event sheet and shows an inline success state with the student details.
  All feedback here is inline by design; this flow never fires toasts, so the
  kiosk rhythm is never interrupted by popups.
- Recording against an `Upcoming` or `Closed` event fails closed (409); the
  form disables itself when the event is not Active.
- **Event dates gate:** record (`POST …/attendance`) and verify
  (`POST …/attendance/check`) both refuse scans landing outside the event's
  date range from its details with `409 EVENT_DATE_CLOSED` ("Check-in is
  closed for this date…"). The scan's Manila day decides: live scans use
  today, offline-queue replays use their original `scannedAt`, so a late
  sync still records scans taken on event days. An unparseable event date
  fails open (old behavior) so a bad date string can never brick check-ins.
  Enforced in the Next.js routes (covers both backends), Neon, and Apps
  Script — the script side takes effect after the web app is redeployed.
  Out-of-range replays surface as `failed` in the sync report, where the
  operator discards them.
- `FullscreenToggle` hides the app chrome for distraction-free door operation.
  The tab title is `Check in · <name> · Atty`.

## Key files

| File | Role |
|---|---|
| `app/(app)/events/[eventId]/check-in/page.tsx` | Kiosk page (gate, event header) |
| `components/attendance/CheckInForm.tsx` | Validate → verify → record flow |
| `components/attendance/FullscreenToggle.tsx` | Kiosk fullscreen control |
| `app/api/events/[eventId]/attendance/route.ts` (POST) | Record endpoint |
| `app/api/events/[eventId]/attendance/check/route.ts` | Verify endpoint |
| `app/api/students/lookup/route.ts` | Student lookup by SRCODE |

## Related docs

- [attendance-records.md](attendance-records.md) — viewing what the kiosk recorded
- [../api-security.md](../api-security.md) — per-action authorization

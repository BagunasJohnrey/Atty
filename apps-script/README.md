# Apps Script Backend

This folder contains the Google Apps Script (GAS V8) backend that powers the
School Event Attendance System. It is deployed as a **Web App** and acts as the
API layer between the Next.js frontend and Google Sheets.

## Architecture

```
Next.js (server)
   │  HTTPS POST: { secret, action, ...fields }
   ▼
Apps Script Web App  (this folder)
   │  SpreadsheetApp services
   ▼
Google Sheets (Masterlist, Events, EVT-XXX)
```

- Next.js never talks to Google Sheets directly.
- Every request must carry `secret` matching the `APPS_SCRIPT_SECRET` script
  property. The secret is stored once as a Script Property and compared in
  constant time.
- The `webapp` manifest entry runs the script as the deploying user
  (`USER_DEPLOYING`) and accepts anonymous requests (`ANYONE_ANONYMOUS`);
  authentication is enforced by the shared secret, not Google accounts.

## API Actions

Request body: `{ "secret": "...", "action": "<action>", ...fields }`

| Action               | Fields                                 | Purpose                                  |
| -------------------- | -------------------------------------- | ---------------------------------------- |
| `getEvents`          | —                                      | List all events                          |
| `getEvent`           | `eventId`                              | Single event                             |
| `createEvent`        | `name`, `date`                         | Create event + dynamic sheet             |
| `openEvent`          | `eventId`                              | Mark event as Active                     |
| `closeEvent`         | `eventId`                              | Mark event as Closed                     |
| `lookupStudent`      | `srcode`                               | Lookup a student in the Masterlist       |
| `recordAttendance`   | `eventId`, `srcode`                    | Record attendance (validates + de-dupes) |
| `checkAttendance`    | `eventId`, `srcode`                    | Check if a student already attended      |
| `getAttendance`      | `eventId`                              | Attendance rows joined with students     |
| `getAttendanceReport`| `eventId`                              | Totals + grouping report                 |

All responses are JSON. Success shape: `{ "success": true, "message": "..." }`
plus action fields (e.g. `event`, `student`, `attendance`, `report`). Failure
shape: `{ "success": false, "code": "...", "message": "..." }`.

Error codes: `INVALID_REQUEST`, `INVALID_FIELD`, `UNAUTHORIZED`,
`METHOD_NOT_ALLOWED`, `CONFIGURATION_ERROR`, `EVENT_NOT_FOUND`,
`EVENT_NOT_ACTIVE`, `SRCODE_NOT_FOUND`, `DUPLICATE_ATTENDANCE`,
`INTERNAL_ERROR`.

## Expected Spreadsheet

| Sheet        | Columns                                       |
| ------------ | --------------------------------------------- |
| `Masterlist` | SRCODE, Full Name, College, Program, Year Level, Gender |
| `Events`     | Event ID, Event Name, Event Date, Status, Sheet Name |
| `EVT-XXX`    | Timestamp, SRCODE (one sheet per event)       |

Notes:

- The first row of each sheet must be a header row.
- `SRCODE` is the unique student identifier, used only once per event.
- Recorded attendance is kept even after an event is closed.

## Deployment

### Option A: Container-bound project (recommended)

1. Open the spreadsheet, then **Extensions > Apps Script**.
2. Replace the default `Code.gs` with the files in this folder (one file per
   module, same names).
3. Save and run any function once to authorize the Spreadsheet scope.
4. **Project Settings > Script Properties** and add:

   | Key                | Value                                    |
   | ------------------ | ---------------------------------------- |
   | `APPS_SCRIPT_SECRET` | `A long random string known only to the Next.js server` |

   Only this property is required when the script is bound to the spreadsheet.
5. **Deploy > New deployment > Web app**:
   - Execute as: **Me (the spreadsheet owner)**
   - Who has access: **Anyone** (the shared secret protects the API)
6. Copy the Web App URL (`https://script.google.com/macros/s/<ID>/exec`)
   into `APPS_SCRIPT_URL` on the Next.js server.

### Option B: Standalone project + clasp

1. Install [clasp](https://github.com/google/clasp) and log in.
2. Create a `clasp` project and add `.clasp.json` with your Script ID.
3. Push the folder: `clasp push`.
4. In a standalone project, add a `SPREADSHEET_ID` script property pointing at
   the attendance spreadsheet (in addition to `APPS_SCRIPT_SECRET`).
5. Deploy as a Web App with the same settings as Option A.

## Notes

- The first request after each redeploy may receive a `302` redirect from
  `/exec`. The Next.js integration performs a GET warm-up and retries, so this
  is handled automatically.
- `auth.gs` fails closed: if `APPS_SCRIPT_SECRET` is not configured, every
  request is rejected.
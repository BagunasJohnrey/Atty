# School Event Attendance System

A web-based attendance system for school events built with **Next.js**,
**Google Apps Script**, and **Google Sheets**.

- A centralized `Masterlist` sheet holds all student information (keyed by
  `SRCODE`).
- The `Events` sheet is the event registry.
- Every event gets a dynamically created attendance sheet named after its
  Event ID (e.g. `EVT-001`) that stores only `Timestamp` + `SRCODE`.
- The **Apps Script Web App** is the backend/API: it validates requests,
  records attendance, prevents duplicates, and generates reports.
- The **Next.js server** is a thin BFF: it forwards client requests to the
  Web App with a shared secret, so credentials never reach the browser.

## Architecture

```
Browser
   │  HTTPS
   ▼
Next.js App Router (app/api/* route handlers)
   │  POST { secret, action, ... }  (shared secret, server-only)
   ▼
Google Apps Script Web App (apps-script/)
   │  SpreadsheetApp services
   ▼
Google Sheets (Masterlist, Events, EVT-XXX)
```

Next.js never talks to Google Sheets directly, and per the requirements no
student data is duplicated into event sheets.

## Repository layout

| Path                | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `apps-script/`      | Apps Script backend, deployed as a Web App        |
| `models/`           | Shared domain types (Student, Event, Attendance…) |
| `integration/`      | Server-side client for the Apps Script API        |
| `app/api/`          | Next.js route handlers (BFF)                      |
| `lib/api.ts`        | Route handler validation + error mapping          |

Each source file stays under 400 lines to keep the codebase maintainable.

## Setup

1. Deploy the Apps Script backend — see `apps-script/README.md`.
2. Create `.env.local` from `.env.example` and fill in `APPS_SCRIPT_URL` and
   `APPS_SCRIPT_SECRET`.
3. Run the app:

```bash
npm install
npm run dev
```

## API surface

The Next.js app exposes these endpoints (all return JSON):

| Method | Path                                    | Description                    |
| ------ | --------------------------------------- | ------------------------------ |
| GET    | `/api/events`                           | List events                    |
| POST   | `/api/events`                           | Create an event                |
| GET    | `/api/events/[eventId]`                 | Event details                  |
| POST   | `/api/events/[eventId]/open`            | Open an event (mark Active)    |
| PATCH  | `/api/events/[eventId]`                 | Close an event                 |
| GET    | `/api/events/[eventId]/attendance`      | Attendance records             |
| POST   | `/api/events/[eventId]/attendance`      | Record attendance              |
| POST   | `/api/events/[eventId]/attendance/check`| Verify a student's attendance  |
| GET    | `/api/events/[eventId]/report`          | Attendance report              |
| POST   | `/api/students/lookup`                  | Look up a student by SRCODE     |

## Scripts

```bash
npm run dev        # start the development server
npm run build      # production build
npm run start      # start the production server
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest unit tests
npm run format     # prettier --write
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, typecheck, lint, test, and build
on every push and pull request.
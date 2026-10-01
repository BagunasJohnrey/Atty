# Testing

How to verify this codebase, and what each suite is actually proving.

## The gate

CI (`.github/workflows/ci.yml`) runs exactly this, and all of it must pass:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm run build` is not optional. It is what proves no Client Component has
imported a `server-only` module — a check nothing else performs.

## Running tests

```bash
npm test                          # everything, once
npx vitest                        # watch mode
npx vitest run lib/auth           # one directory
npx vitest run apps-script/auth.test.ts
npx vitest run -t "tampered"      # by test name
```

16 files, 138 tests. Node environment by default; a suite needing a DOM opts in
with a `@vitest-environment jsdom` docblock at the top of the file. Tests are
co-located with their source as `*.test.ts`.

## What each suite proves

### Authentication

| Suite | Proves |
|---|---|
| `lib/auth/session.test.ts` | A signed token round-trips. Tampered payloads, tampered signatures, expired tokens, foreign keys, and `alg: none` substitution are all rejected. The payload carries only `role`/`iat`/`exp`. A missing or weak `SESSION_SECRET` fails closed. |
| `lib/auth/pin.test.ts` | The configured PIN is accepted and others rejected. **Leading zeros survive** — `Number("04812075")` is `4812075`, so a numeric comparison would wrongly accept a 7-character input. 7-char, 9-char, non-digit, whitespace, and newline inputs are rejected. An unset or malformed `ADMIN_PIN` throws `503`, not `false`. |
| `lib/auth/dal.test.ts` | **Layer 2 rejects on its own**, with no proxy involved. No cookie, tampered cookie, foreign key, and missing `SESSION_SECRET` each produce a 401; pages redirect to `/login` instead. |
| `lib/auth/rate-limit.test.ts` | Exactly 5 attempts pass, the 6th is blocked with a `Retry-After`, the window resets, clients are independent, and **successful attempts count too** so a correct PIN is not distinguishable. |
| `lib/auth/redirect.test.ts` | `?next=` accepts same-origin paths and rejects `//evil.com`, `/\evil.com`, absolute URLs, `javascript:`, `data:`, and control characters. |
| `lib/auth/cache-isolation.test.ts` | **The structural guard.** `integration/cached.ts` imports nothing from `lib/auth`; no cached wrapper calls a gate; every route file has at least as many `requireAdmin()` calls as exported handlers; every page outside `(app)` calls `requireAdminPage()`; `/login` calls neither. |

That last suite is the one that matters most for the future. It is easy to
break the security model by accident — moving a check one line inside a cached
function looks harmless — and a test is the only thing that reliably notices.

### Backend

| Suite | Proves |
|---|---|
| `apps-script/auth.test.ts` | The real `doPost` entry point rejects a request carrying **only** the shared secret, rejects each credential independently, fails closed when either Script Property is unset, and does not leak which action names exist. Also asserts the comparison is the constant-time XOR loop. |
| `apps-script/attendance.test.ts` | Attendance behaviour **and** how many sheet reads each code path performs. |
| `apps-script/checkin-cost.test.ts` | The check-in path's read cost, and that `CacheService` is never touched — each cache get is a network round trip that previously exhausted the upstream timeout. |

The Apps Script suites evaluate the real `.gs` sources in a `node:vm` sandbox
with Google globals stubbed. That is why they can assert on read counts, and
why `auth.test.ts` drives `doPost` rather than calling `Auth` directly — so the
wiring in `Code.gs` is covered too.

### Everything else

| Suite | Covers |
|---|---|
| `lib/api.test.ts` | Body parsing, field validation, and error-code → HTTP status mapping. |
| `lib/attendance.test.ts` | Filter parsing, filtering, CSV serialisation. |
| `lib/format.test.ts` | Date and SR Code formatting. |
| `integration/http.test.ts` | Read-cache hit, in-flight dedupe, mutation invalidation, `APPS_SCRIPT_CACHE=off`, and that both credentials reach the wire. |
| `integration/events.test.ts` | Request shapes for each event action. |
| `integration/cached.test.ts` | `unstable_cache` tag wiring and revalidation windows. |
| `hooks/useCached.test.tsx` | The client stale-while-revalidate cache. |

## Manual verification

Unit tests cannot prove a redirect happens or a cookie is set. After changing
auth, walk this:

```bash
npm run dev
```

| # | Do | Expect |
|---|---|---|
| 1 | Open `/` | `307` to `/login?next=%2F` |
| 2 | Wrong PIN | `Incorrect PIN.` |
| 3 | Same PIN 6 times | `Too many attempts` + `Retry-After` |
| 4 | Correct PIN | Dashboard loads |
| 5 | Lock button | Back to `/login` |
| 6 | DevTools → Application → Cookies | `atty_admin` is `HttpOnly` |
| 7 | Incognito → `/api/events` | `401` JSON |
| 8 | Incognito → `/events/anything/check-in` | Redirected to `/login` |

### The one that matters most

**Delete `proxy.ts`, restart, and repeat steps 1, 7, and 8.** They must still
hold.

Layer 2 is the authoritative gate; the proxy is a fast path in front of it. If
anything breaks without the proxy, the real gate is not where it is supposed to
be. The upstream Next.js documentation is explicit that a matcher change "can
silently remove Proxy coverage", which is why the gate does not depend on it.

### With curl

```bash
base=http://localhost:3000
pin=$(grep ADMIN_PIN .env.local | cut -d= -f2)

# Unauthenticated
curl -s -o /dev/null -D - "$base/" | grep -i location
curl -s "$base/api/events"

# Sign in, keep the cookie
curl -s -c /tmp/jar -X POST "$base/api/auth/login" \
  -H 'Content-Type: application/json' -d "{\"pin\":\"$pin\"}"

# Authenticated
curl -s -b /tmp/jar -o /dev/null -w '%{http_code}\n' "$base/api/events"
```

On PowerShell, write the JSON to a file and use `--data-binary "@file"`;
single-quoted inline JSON gets mangled by argument parsing.

## Writing a new test

- Co-locate it as `*.test.ts` beside the source.
- Default to the Node environment; add a `@vitest-environment jsdom` docblock
  only if you need a DOM.
- `vi.resetModules()` plus a dynamic `import()` when module state or
  `process.env` matters — `integration/http.test.ts` and the `lib/auth` suites
  both do this.
- Set required env vars at the top of the file, as
  `integration/http.test.ts` does for `ADMIN_SERVICE_KEY`.
- Assert on behaviour, not implementation, except where the implementation *is*
  the invariant — `cache-isolation.test.ts` reads source text precisely because
  the rule has no runtime expression.

### Do not fake a mutation by appending a character

A tampered-token test that does `token.slice(0, -1) + "x"` is **flaky**: the
last character of a base64url signature is heavily constrained, so it is often
already `x` and the "tampered" token comes out identical. This caused 3
failures in 8 runs here before it was caught. Flip a character that is
guaranteed to differ — see the `tamper()` helper in `lib/auth/dal.test.ts`.

## Adding a route or page

Run `npm test` first. `lib/auth/cache-isolation.test.ts` will fail until the
new route calls `requireAdmin()` and the new page calls `requireAdminPage()`.
That is intentional — it is the cheapest possible reminder that authorization
is not automatic.

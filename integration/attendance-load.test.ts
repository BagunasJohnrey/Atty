import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * Load + concurrency tests for the attendance record path: 50 and 100
 * simultaneous scans must all land exactly once, and 50 simultaneous scans
 * of the SAME code must yield exactly one record plus 49 duplicates.
 *
 * Opt-in only: runs solely when NEON_LOAD_TEST_URL is set. Point it at the
 * DEV branch, never production — this suite writes and deletes real rows.
 * Each run uses timestamped srcodes, and afterAll removes everything it
 * made, so reruns never collide with leftovers.
 *
 * Run: NEON_LOAD_TEST_URL=<dev-url> npx vitest run integration/attendance-load.test.ts
 * Or:  npm run test:load  (same, reads the var from your shell)
 */

import { neon } from "@neondatabase/serverless"

const LOAD_URL = process.env.NEON_LOAD_TEST_URL
const EVENT_ID = "EVT-LOAD"
// Test-only 99- prefix (the real roster uses 23/25/26-), zero-padded and
// distinct per index; afterAll removes everything this file makes.
const code = (i: number) => `99-${String(i).padStart(5, "0")}`

describe.skipIf(!LOAD_URL)("attendance load (dev branch only)", () => {
  const OLD_URL = process.env.NEON_DATABASE_URL

  beforeAll(async () => {
    process.env.NEON_DATABASE_URL = LOAD_URL
    const sql = neon(LOAD_URL as string)
    // Check-ins land only on the event's dates, so the fixture always
    // covers today instead of a fixed date the suite would age past.
    const today = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
    await sql`delete from attendance where event_id = ${EVENT_ID}`
    await sql`delete from events where id = ${EVENT_ID}`
    await sql`insert into events (id, name, event_date, status, sheet_name)
      values (${EVENT_ID}, 'Load Test', ${today}, 'Active', ${EVENT_ID})`
  }, 60000)

  afterAll(async () => {
    const sql = neon(LOAD_URL as string)
    await sql`delete from attendance where event_id = ${EVENT_ID}`
    await sql`delete from events where id = ${EVENT_ID}`
    await sql`delete from students where srcode like '99-%' and full_name = 'Load Test'`
    process.env.NEON_DATABASE_URL = OLD_URL
  }, 60000)

  async function seedStudents(n: number) {
    const { neon: neonFn } = await import("@neondatabase/serverless")
    const sql = neonFn(LOAD_URL as string)
    const values = Array.from(
      { length: n },
      (_, i) =>
        `('${code(i)}','Load Test','','','','')`
    ).join(",")
    await sql.query(
      `insert into students (srcode, full_name, college, program, year_level, gender)
       values ${values} on conflict (srcode) do nothing`
    )
  }

  async function blast(n: number, sameCode: boolean) {
    const { recordAttendanceNeon } = await import("./neon")
    const start = Date.now()
    const results = await Promise.allSettled(
      Array.from({ length: n }, (_, i) =>
        recordAttendanceNeon(EVENT_ID, sameCode ? code(0) : code(i))
      )
    )
    return { results, ms: Date.now() - start }
  }

  it("records 50 simultaneous distinct scans exactly once", async () => {
    await seedStudents(50)
    const { results, ms } = await blast(50, false)
    const ok = results.filter((r) => r.status === "fulfilled")
    console.log(`50-scan blast: ${ms}ms, ${ok.length}/50 recorded`)
    expect(ok).toHaveLength(50)
    const { neon: neonFn } = await import("@neondatabase/serverless")
    const sql = neonFn(LOAD_URL as string)
    const count = await sql`select count(*)::int as n from attendance where event_id = ${EVENT_ID}`
    expect((count[0] as { n: number }).n).toBe(50)
  }, 60000)

  it("records 100 simultaneous distinct scans exactly once", async () => {
    await seedStudents(100)
    const { neon: neonFn } = await import("@neondatabase/serverless")
    const sql = neonFn(LOAD_URL as string)
    await sql`delete from attendance where event_id = ${EVENT_ID}`
    const { results, ms } = await blast(100, false)
    const ok = results.filter((r) => r.status === "fulfilled")
    console.log(`100-scan blast: ${ms}ms, ${ok.length}/100 recorded`)
    expect(ok).toHaveLength(100)
    const count = await sql`select count(*)::int as n from attendance where event_id = ${EVENT_ID}`
    expect((count[0] as { n: number }).n).toBe(100)
  }, 120000)

  it("collapses 50 simultaneous same-code scans to one record + 49 duplicates", async () => {
    const { neon: neonFn } = await import("@neondatabase/serverless")
    const sql = neonFn(LOAD_URL as string)
    await sql`delete from attendance where event_id = ${EVENT_ID}`
    const { results, ms } = await blast(50, true)
    const ok = results.filter((r) => r.status === "fulfilled")
    const dupes = results.filter(
      (r) => r.status === "rejected" && (r.reason as { code?: string })?.code === "DUPLICATE_ATTENDANCE"
    )
    console.log(`same-code blast: ${ms}ms, ${ok.length} recorded, ${dupes.length} duplicates`)
    expect(ok).toHaveLength(1)
    expect(dupes).toHaveLength(49)
  }, 60000)
})

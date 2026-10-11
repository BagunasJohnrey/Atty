import type { Student } from "@/models/student"
import { requestAppsScript } from "./http"
import { lookupStudentNeon } from "./neon"

/** Cutover flag: `neon` reads the roster from Neon; anything else (or unset)
 *  keeps the Apps Script path. Fail-safe defaults to the legacy backend. */
function isNeonStudentsEnabled(): boolean {
  return process.env.NEON_STUDENTS === "neon"
}

/**
 * Short-lived student cache for the Neon path. The roster changes yearly,
 * while a kiosk looks the same srcodes up repeatedly (preview-then-record
 * double reads, duplicate re-scans), so repeats within the window skip the
 * roundtrip. Only student identity is cached — never attendance state, so a
 * re-scan still hits the duplicate guard. Misses (including 404s) are never
 * stored, so a newly added student is always found.
 */
const LOOKUP_TTL_MS = 5 * 60 * 1000
const LOOKUP_CACHE_MAX = 1000
const lookupCache = new Map<string, { at: number; student: Student }>()

/** Test hook: drops cached lookups between cases. */
export function clearStudentLookupCache(): void {
  lookupCache.clear()
}

async function lookupStudentNeonCached(srcode: string): Promise<Student> {
  const hit = lookupCache.get(srcode)
  if (hit && Date.now() - hit.at < LOOKUP_TTL_MS) return hit.student
  const student = await lookupStudentNeon(srcode)
  lookupCache.set(srcode, { at: Date.now(), student })
  while (lookupCache.size > LOOKUP_CACHE_MAX) {
    const oldest = lookupCache.keys().next().value
    if (oldest === undefined) break
    lookupCache.delete(oldest)
  }
  return student
}

export async function lookupStudent(srcode: string): Promise<Student> {
  if (isNeonStudentsEnabled()) return lookupStudentNeonCached(srcode)
  const response = await requestAppsScript<{ student: Student }>(
    "lookupStudent",
    { srcode }
  )
  return response.student
}

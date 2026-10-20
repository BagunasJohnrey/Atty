import type { AttendanceRecord } from "@/models/attendance"

/**
 * Facet filters for the on-page report charts. These mirror the attendance
 * table's dropdowns (department, course, year level, gender), minus the
 * free-text search: a name/SR-code term cannot aggregate into a chart.
 * The day is scoped client-side from `report.days`, so it is not part of
 * this shape.
 */
export interface ReportFilters {
  college?: string
  program?: string
  yearLevel?: string
  gender?: string
}

export const REPORT_FILTER_FIELDS = [
  "college",
  "program",
  "yearLevel",
  "gender",
] as const

/**
 * Trims, drops blanks, and lowercases so URL values, cache keys, and
 * backend comparisons all agree. Comparison is case-insensitive because
 * the sheet stores display casing while dropdown values round-trip through
 * query params.
 */
export function normalizeReportFilters(
  filters?: ReportFilters | null
): ReportFilters {
  const normalized: ReportFilters = {}
  for (const field of REPORT_FILTER_FIELDS) {
    const value = filters?.[field]?.trim().toLowerCase()
    if (value) normalized[field] = value
  }
  return normalized
}

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  return normalizeReportFilters({
    college: params.get("college") ?? undefined,
    program: params.get("program") ?? undefined,
    yearLevel: params.get("yearLevel") ?? undefined,
    gender: params.get("gender") ?? undefined,
  })
}

export function hasReportFilters(filters?: ReportFilters): boolean {
  const normalized = normalizeReportFilters(filters)
  return REPORT_FILTER_FIELDS.some((field) => normalized[field])
}

/** Stable cache key; normalization fixes both casing and field order. */
export function reportFiltersKey(filters?: ReportFilters): string {
  return JSON.stringify(normalizeReportFilters(filters))
}

export function matchesReportFilters(
  record: Pick<
    AttendanceRecord,
    "college" | "program" | "yearLevel" | "gender"
  >,
  filters?: ReportFilters
): boolean {
  const normalized = normalizeReportFilters(filters)
  for (const field of REPORT_FILTER_FIELDS) {
    const wanted = normalized[field]
    if (!wanted) continue
    if (
      String(record[field] ?? "")
        .trim()
        .toLowerCase() !== wanted
    ) {
      return false
    }
  }
  return true
}

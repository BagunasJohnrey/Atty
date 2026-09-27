import type { AttendanceRecord } from "@/models/attendance"

/**
 * Server-side search/filter for attendance records (FR-13/FR-14).
 *
 * Filtering happens in the Next.js layer over the joined attendance list,
 * so the Apps Script backend stays untouched and unfiltered responses
 * (no query params) behave exactly as before.
 */
export interface AttendanceFilters {
  /** Free-text search across SRCODE, name, college, and program. */
  q?: string
  college?: string
  program?: string
  yearLevel?: string
  gender?: string
}

export function parseAttendanceFilters(
  searchParams: URLSearchParams
): AttendanceFilters {
  const pick = (key: string): string | undefined => {
    const value = searchParams.get(key)?.trim()
    return value ? value : undefined
  }
  return {
    q: pick("q"),
    college: pick("college"),
    program: pick("program"),
    yearLevel: pick("yearLevel"),
    gender: pick("gender"),
  }
}

function matches(value: string, filter: string | undefined): boolean {
  if (!filter) return true
  return value.trim().toLowerCase() === filter.trim().toLowerCase()
}

export function filterAttendance(
  records: AttendanceRecord[],
  filters: AttendanceFilters
): AttendanceRecord[] {
  const q = filters.q?.trim().toLowerCase()
  return records.filter((record) => {
    if (q) {
      const haystack = [record.srcode, record.name, record.college, record.program]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return (
      matches(record.college, filters.college) &&
      matches(record.program, filters.program) &&
      matches(record.yearLevel, filters.yearLevel) &&
      matches(record.gender, filters.gender)
    )
  })
}

const CSV_HEADERS = [
  "Timestamp",
  "SRCODE",
  "Full Name",
  "College",
  "Program",
  "Year Level",
  "Gender",
] as const

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Builds a UTF-8 CSV export of attendance rows (FR-16). The BOM prefix
 * keeps accented names readable when opened directly in Excel.
 */
export function toAttendanceCsv(records: AttendanceRecord[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...records.map((record) =>
      [
        record.timestamp,
        record.srcode,
        record.name,
        record.college,
        record.program,
        record.yearLevel,
        record.gender,
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ]
  return `﻿${lines.join("\r\n")}\r\n`
}

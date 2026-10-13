import type { SchoolEvent } from "./event"

export type GroupedCounts = Record<string, number>

export interface AttendanceDayReport {
  /** Manila calendar day (`YYYY-MM-DD`). */
  day: string
  present: number
  absent: number
  rate: number
  byCollege: GroupedCounts
  byProgram: GroupedCounts
  byYearLevel: GroupedCounts
  byGender: GroupedCounts
}

export interface AttendanceReport {
  event: SchoolEvent
  totalStudents: number
  /** Distinct students present on at least one day (rate never exceeds 100). */
  totalPresent: number
  totalAbsent: number
  attendanceRate: number
  /** Every scan row across all days. */
  totalScans: number
  byCollege: GroupedCounts
  byProgram: GroupedCounts
  byYearLevel: GroupedCounts
  byGender: GroupedCounts
  days: AttendanceDayReport[]
}

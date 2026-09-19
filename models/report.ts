import type { SchoolEvent } from "./event"

export type GroupedCounts = Record<string, number>

export interface AttendanceReport {
  event: SchoolEvent
  totalStudents: number
  totalPresent: number
  totalAbsent: number
  attendanceRate: number
  byCollege: GroupedCounts
  byProgram: GroupedCounts
  byYearLevel: GroupedCounts
  byGender: GroupedCounts
}

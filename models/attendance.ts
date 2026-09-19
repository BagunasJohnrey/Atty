import type { Student } from "./student"

export interface AttendanceRecord extends Student {
  timestamp: string
}

export interface AttendanceCheck {
  present: boolean
  timestamp?: string
  student?: Student | null
}

export interface RecordedAttendance {
  timestamp: string
  student: Student
}

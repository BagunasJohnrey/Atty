import type { Student } from "@/models/student"
import { requestAppsScript } from "./http"

export async function lookupStudent(srcode: string): Promise<Student> {
  const response = await requestAppsScript<{ student: Student }>(
    "lookupStudent",
    { srcode }
  )
  return response.student
}

import type {
  ApiFailure,
  AttendanceCheckResponse,
  AttendanceListResponse,
  AttendanceRecordResponse,
  EventResponse,
  EventsResponse,
  ReportResponse,
  StudentResponse,
} from "@/models/api"
import type { AttendanceFilters } from "@/lib/attendance"
import type { CreateEventInput, UpdateEventInput } from "@/models/event"

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  const data = (await res.json().catch(() => null)) as
    | (T & { success?: boolean; code?: string; message?: string })
    | null
  if (!data || data.success === false) {
    const failure = data as unknown as ApiFailure | null
    throw new ApiError(
      failure?.code ?? "INTERNAL_ERROR",
      failure?.message ?? `Request failed: ${path}`,
      res.status
    )
  }
  return data as T
}

export function listEvents(): Promise<EventsResponse> {
  return request<EventsResponse>("/api/events", { cache: "no-store" })
}

export function getEvent(eventId: string): Promise<EventResponse> {
  return request<EventResponse>(
    `/api/events/${encodeURIComponent(eventId)}`,
    { cache: "no-store" }
  )
}

export function createEvent(input: CreateEventInput): Promise<EventResponse> {
  return request<EventResponse>("/api/events", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function openEvent(eventId: string): Promise<EventResponse> {
  return request<EventResponse>(
    `/api/events/${encodeURIComponent(eventId)}/open`,
    { method: "POST" }
  )
}

export function closeEvent(eventId: string): Promise<EventResponse> {
  return request<EventResponse>(`/api/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
  })
}

export function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<EventResponse> {
  return request<EventResponse>(`/api/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function listAttendance(
  eventId: string,
  filters?: AttendanceFilters
): Promise<AttendanceListResponse> {
  const params = new URLSearchParams()
  if (filters?.q) params.set("q", filters.q)
  if (filters?.college) params.set("college", filters.college)
  if (filters?.program) params.set("program", filters.program)
  if (filters?.yearLevel) params.set("yearLevel", filters.yearLevel)
  if (filters?.gender) params.set("gender", filters.gender)
  const qs = params.toString()
  return request<AttendanceListResponse>(
    `/api/events/${encodeURIComponent(eventId)}/attendance${qs ? `?${qs}` : ""}`,
    { cache: "no-store" }
  )
}

export function recordAttendance(
  eventId: string,
  srcode: string
): Promise<AttendanceRecordResponse> {
  return request<AttendanceRecordResponse>(
    `/api/events/${encodeURIComponent(eventId)}/attendance`,
    { method: "POST", body: JSON.stringify({ srcode }) }
  )
}

export function checkAttendance(
  eventId: string,
  srcode: string
): Promise<AttendanceCheckResponse> {
  return request<AttendanceCheckResponse>(
    `/api/events/${encodeURIComponent(eventId)}/attendance/check`,
    { method: "POST", body: JSON.stringify({ srcode }) }
  )
}

export function getReport(eventId: string): Promise<ReportResponse> {
  return request<ReportResponse>(
    `/api/events/${encodeURIComponent(eventId)}/report`,
    { cache: "no-store" }
  )
}

export function lookupStudent(srcode: string): Promise<StudentResponse> {
  return request<StudentResponse>("/api/students/lookup", {
    method: "POST",
    body: JSON.stringify({ srcode }),
  })
}

export function exportUrl(eventId: string, filters?: AttendanceFilters): string {
  const params = new URLSearchParams()
  if (filters?.q) params.set("q", filters.q)
  if (filters?.college) params.set("college", filters.college)
  if (filters?.program) params.set("program", filters.program)
  if (filters?.yearLevel) params.set("yearLevel", filters.yearLevel)
  if (filters?.gender) params.set("gender", filters.gender)
  const qs = params.toString()
  return `/api/events/${encodeURIComponent(eventId)}/attendance/export${qs ? `?${qs}` : ""}`
}

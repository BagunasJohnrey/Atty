export const EVENT_STATUSES = ["Upcoming", "Active", "Closed"] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

export interface SchoolEvent {
  id: string
  name: string
  date: string
  status: EventStatus
  sheetName: string
  location: string
  description: string
}

export interface CreateEventInput {
  name: string
  date: string
  location?: string
  description?: string
}

export interface UpdateEventInput {
  name?: string
  date?: string
  location?: string
  description?: string
  status?: string
}

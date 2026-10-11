import type {
  CreateEventInput,
  SchoolEvent,
  UpdateEventInput,
} from "@/models/event"
import { requestAppsScript } from "./http"
import {
  closeEventNeon,
  createEventNeon,
  deleteEventNeon,
  getEventNeon,
  getEventsNeon,
  openEventNeon,
  updateEventNeon,
} from "./neon"

/** Cutover flag: `neon` serves events from Neon; anything else (or unset)
 *  keeps the Apps Script path. Fail-safe defaults to the legacy backend. */
function isNeonEventsEnabled(): boolean {
  return process.env.NEON_EVENTS === "neon"
}

export async function getEvents(): Promise<SchoolEvent[]> {
  if (isNeonEventsEnabled()) return getEventsNeon()
  const response = await requestAppsScript<{ events: SchoolEvent[] }>(
    "getEvents"
  )
  return response.events
}

export async function getEvent(eventId: string): Promise<SchoolEvent> {
  if (isNeonEventsEnabled()) return getEventNeon(eventId)
  const response = await requestAppsScript<{ event: SchoolEvent }>("getEvent", {
    eventId,
  })
  return response.event
}

export async function createEvent(
  input: CreateEventInput
): Promise<SchoolEvent> {
  // Optional today (the event form collects neither), but validated by
  // the backend whenever it is present.
  const normalized = {
    name: input.name,
    date: input.date,
    location: input.location ?? "",
    description: input.description ?? "",
    orgId: input.orgId ?? "",
    time: input.time ?? "",
  }
  if (isNeonEventsEnabled()) return createEventNeon(normalized)
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "createEvent",
    normalized
  )
  return response.event
}

export async function closeEvent(eventId: string): Promise<SchoolEvent> {
  if (isNeonEventsEnabled()) return closeEventNeon(eventId)
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "closeEvent",
    { eventId }
  )
  return response.event
}

export async function openEvent(eventId: string): Promise<SchoolEvent> {
  if (isNeonEventsEnabled()) return openEventNeon(eventId)
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "openEvent",
    { eventId }
  )
  return response.event
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<SchoolEvent> {
  if (isNeonEventsEnabled()) return updateEventNeon(eventId, input)
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "updateEvent",
    { eventId, ...input }
  )
  return response.event
}

export async function deleteEvent(eventId: string): Promise<SchoolEvent> {
  if (isNeonEventsEnabled()) return deleteEventNeon(eventId)
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "deleteEvent",
    { eventId }
  )
  return response.event
}

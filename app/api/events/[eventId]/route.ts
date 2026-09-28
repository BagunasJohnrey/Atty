import { NextResponse } from "next/server"
import { closeEvent, getEvent, updateEvent } from "@/integration/events"
import type { UpdateEventInput } from "@/models/event"
import { cachedJson, HttpError, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type EventParams = { params: Promise<{ eventId: string }> }

const UPDATABLE_FIELDS = [
  "name",
  "date",
  "location",
  "description",
  "status",
] as const

export async function GET(_request: Request, context: EventParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const event = await getEvent(eventId)
    return cachedJson({ success: true, event }, 30)
  })
}

/**
 * PATCH with an empty body closes the event (original behavior).
 * PATCH with a JSON body updates the given fields (name, date, location,
 * description, status) — including reopening a closed event via
 * { "status": "Active" }.
 */
export async function PATCH(request: Request, context: EventParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const raw = await request.text()
    if (!raw.trim()) {
      const event = await closeEvent(eventId)
      return NextResponse.json({
        success: true,
        message: "Event closed successfully.",
        event,
      })
    }
    const input = parsePatchBody(raw)
    const event = await updateEvent(eventId, input)
    return NextResponse.json({
      success: true,
      message: "Event updated successfully.",
      event,
    })
  })
}

function parsePatchBody(raw: string): UpdateEventInput {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.")
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "INVALID_JSON", "Request body must be a JSON object.")
  }
  const record = body as Record<string, unknown>
  const input: UpdateEventInput = {}
  for (const field of UPDATABLE_FIELDS) {
    const value = record[field]
    if (value === undefined || value === null) continue
    if (typeof value !== "string" || value.trim() === "") {
      throw new HttpError(400, "INVALID_FIELD", `Invalid field: ${field}.`)
    }
    input[field] = value.trim()
  }
  if (Object.keys(input).length === 0) {
    throw new HttpError(
      400,
      "INVALID_FIELD",
      "Provide at least one of: name, date, location, description, status."
    )
  }
  return input
}

import { NextResponse } from "next/server"
import { closeEvent, getEvent } from "@/integration/events"
import { respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type EventParams = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, context: EventParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const event = await getEvent(eventId)
    return NextResponse.json({ success: true, event })
  })
}

export async function PATCH(_request: Request, context: EventParams) {
  return respondWith(async () => {
    const { eventId } = await context.params
    const event = await closeEvent(eventId)
    return NextResponse.json({
      success: true,
      message: "Event closed successfully.",
      event,
    })
  })
}

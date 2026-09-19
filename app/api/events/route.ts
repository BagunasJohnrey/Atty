import { NextResponse } from "next/server"
import { createEvent, getEvents } from "@/integration/events"
import { parseJsonBody, requireString, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET() {
  return respondWith(async () => {
    const events = await getEvents()
    return NextResponse.json({ success: true, events })
  })
}

export async function POST(request: Request) {
  return respondWith(async () => {
    const body = await parseJsonBody(request)
    const name = requireString(body, "name")
    const date = requireString(body, "date")
    const event = await createEvent({ name, date })
    return NextResponse.json(
      { success: true, message: "Event created successfully.", event },
      { status: 201 }
    )
  })
}

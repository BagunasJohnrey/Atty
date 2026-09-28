import { notFound } from "next/navigation"
import { getEvent } from "@/integration/events"
import { CheckInForm } from "@/components/attendance/CheckInForm"
import { EventStatusBadge } from "@/components/events/EventStatusBadge"
import { formatEventDate } from "@/lib/format"

export const revalidate = 10

export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  let event: Awaited<ReturnType<typeof getEvent>> | null = null
  try {
    event = await getEvent(eventId)
  } catch {
    notFound()
  }
  if (!event) notFound()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="clay p-5 text-center">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{event.id}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight uppercase">{event.name}</h1>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {formatEventDate(event.date)} <EventStatusBadge status={event.status} />
        </p>
      </div>
      <CheckInForm eventId={event.id} eventName={event.name} eventActive={event.status === "Active"} />
    </div>
  )
}

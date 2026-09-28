"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Input, Label } from "@/components/ui/input"

const fields = ["q", "college", "program", "yearLevel", "gender"] as const

const LABELS: Record<(typeof fields)[number], string> = {
  q: "Search",
  college: "College",
  program: "Program",
  yearLevel: "Year level",
  gender: "Gender",
}

export function AttendanceFilters({ eventId }: { eventId: string }) {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/events/${eventId}?${next.toString()}`)
  }

  return (
    <form
      aria-label="Filter attendance"
      className="clay grid grid-cols-2 gap-3 p-4 sm:grid-cols-5"
      onSubmit={(e) => e.preventDefault()}
    >
      {fields.map((key) => (
        <div key={key} className="flex flex-col gap-1.5">
          <Label htmlFor={`f-${key}`}>{LABELS[key]}</Label>
          <Input
            id={`f-${key}`}
            defaultValue={params.get(key) ?? ""}
            placeholder={key === "q" ? "SRCODE / name" : "All"}
            onChange={(e) => update(key, e.target.value)}
          />
        </div>
      ))}
    </form>
  )
}

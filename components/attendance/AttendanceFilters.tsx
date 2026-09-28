"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input, Label } from "@/components/ui/input"
import { ClaySelect } from "@/components/ui/select"
import type { FilterOptions } from "@/lib/attendance"

const DROPDOWNS = [
  { key: "college", label: "Department", values: (o: FilterOptions) => o.colleges },
  { key: "program", label: "Course", values: (o: FilterOptions) => o.programs },
  { key: "yearLevel", label: "Year level", values: (o: FilterOptions) => o.yearLevels },
  { key: "gender", label: "Gender", values: (o: FilterOptions) => o.genders },
] as const

export function AttendanceFilters({
  eventId,
  options,
}: {
  eventId: string
  options: FilterOptions
}) {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/events/${eventId}?${next.toString()}`, { scroll: false })
  }

  return (
    <form
      aria-label="Search and filter attendance"
      className="clay flex flex-col gap-3 p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-q">Search</Label>
        <span className="relative block">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="f-q"
            defaultValue={params.get("q") ?? ""}
            placeholder="SR Code or name…"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => update("q", e.target.value)}
            className="clay-search pl-11"
          />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DROPDOWNS.map(({ key, label, values }) => {
          const current = params.get(key) ?? ""
          const list = values(options)
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`f-${key}`}>{label}</Label>
              <ClaySelect
                id={`f-${key}`}
                value={list.includes(current) ? current : ""}
                onChange={(v) => update(key, v)}
                placeholder={`All ${label.toLowerCase()}s`}
                options={list}
                allLabel={`All ${label.toLowerCase()}s`}
              />
            </div>
          )
        })}
      </div>
    </form>
  )
}

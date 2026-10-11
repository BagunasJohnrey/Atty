"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Label } from "@/components/ui/input"
import { ClaySelect } from "@/components/ui/select"
import { formatDayLabel } from "@/lib/format"

/**
 * Day picker writing the shared `?day=` param, so every picker and every
 * consumer (report, table, export, print) stays in sync. `basePath` is the
 * page the param belongs to: the event page or the print view.
 */
export function DayFilter({
  days,
  basePath,
  variant = "input",
  layout = "stacked",
}: {
  days: string[]
  basePath: string
  /** "button" matches clay-btn metrics for button-row toolbars. */
  variant?: "input" | "button"
  /** "inline" puts the label left of the picker for badge-height rows. */
  layout?: "stacked" | "inline"
}) {
  const router = useRouter()
  const params = useSearchParams()
  if (days.length <= 1) return null

  function update(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("day", value)
    else next.delete("day")
    router.replace(`${basePath}?${next.toString()}`, { scroll: false })
  }

  const current = params.get("day") ?? ""
  // Options show "Day 1 · Oct 11" while the URL keeps the ISO value the
  // server matches on.
  const labeled = days.map((value, index) => ({
    value,
    label: formatDayLabel(value, index),
  }))
  return (
    <div
      className={
        layout === "inline"
          ? "flex min-w-44 flex-row items-center gap-2"
          : "flex min-w-44 flex-col gap-1.5"
      }
    >
      <Label htmlFor="day-filter">Day</Label>
      <ClaySelect
        id="day-filter"
        value={labeled.find((l) => l.value === current)?.label ?? ""}
        onChange={(label) =>
          update(labeled.find((l) => l.label === label)?.value ?? "")
        }
        placeholder="All days"
        options={labeled.map((l) => l.label)}
        allLabel="All days"
        className={
          variant === "button" ? "clay-btn h-9 rounded-full font-semibold" : undefined
        }
      />
    </div>
  )
}

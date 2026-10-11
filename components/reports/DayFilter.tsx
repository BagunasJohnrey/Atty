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
          ? // Pill parity with the Active badge and event-ID chip (~24px):
            // no forced min width (it crowds the badges on a 360px phone)
            // and an h-6 trigger instead of the h-9/h-11 inputs.
            "flex min-w-0 flex-row items-center gap-1.5"
          : "flex min-w-44 flex-col gap-1.5"
      }
    >
      <Label htmlFor="day-filter" className="shrink-0">
        Day
      </Label>
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
          layout === "inline"
            ? // Same metrics as the pills: h-6 height, px-2.5, text-xs.
              // tailwind-merge drops the base h-11/px-4/text-sm/gap-2.
              // The label doubles as the touch affordance: the trigger is
              // ~24px tall (below the 44px WCAG minimum), so the nearby
              // "Day" text plus the popup options carry the tapping load.
              "h-6 gap-1 rounded-full px-2.5 text-xs font-semibold"
            : variant === "button"
              ? "clay-btn h-9 rounded-full font-semibold"
              : undefined
        }
      />
    </div>
  )
}

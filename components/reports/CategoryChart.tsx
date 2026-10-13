"use client"

import { BreakdownBar, type BarTone } from "./BreakdownBar"

export function CategoryChart({
  title,
  entries,
  total,
  tone = "indigo",
  limit = 8,
}: {
  title: string
  entries: [string, number][]
  total: number
  tone?: BarTone
  limit?: number
}) {
  const top = entries.slice(0, limit)
  if (top.length === 0) return null

  return (
    // min-w-0 lets the card shrink inside its grid cell: without it the
    // card keeps its content width on phones and overlaps its neighbour.
    <div className="clay-pressed flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h4>
      {top.map(([label, count]) => (
        <BreakdownBar key={label} label={label} count={count} total={total} tone={tone} />
      ))}
    </div>
  )
}

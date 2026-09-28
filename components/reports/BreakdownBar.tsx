"use client"

export type BarTone = "indigo" | "violet" | "mint" | "coral"

const TONE_FILLS: Record<BarTone, string> = {
  indigo: "linear-gradient(90deg, #818cf8 0%, #6366f1 100%)",
  violet: "linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 100%)",
  mint: "linear-gradient(90deg, #6ee7b7 0%, #10b981 100%)",
  coral: "linear-gradient(90deg, #fda4af 0%, #fb7185 100%)",
}

export function BreakdownBar({
  label,
  count,
  total,
  tone = "indigo",
}: {
  label: string
  count: number
  total: number
  tone?: BarTone
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-xs">
        <span className="truncate font-medium" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {count} · {pct}%
        </span>
      </div>
      <div
        className="clay-pressed h-4 overflow-hidden"
        role="img"
        aria-label={`${label}: ${count} of ${total}`}
      >
        <div
          className="h-full rounded-[5px]"
          style={{ width: `${pct}%`, backgroundImage: TONE_FILLS[tone] }}
        />
      </div>
    </div>
  )
}

"use client"

export function CategoryChart({
  title,
  entries,
}: {
  title: string
  entries: [string, number][]
}) {
  const top = entries.slice(0, 8)
  if (top.length === 0) return null
  const max = Math.max(1, ...top.map(([, count]) => count))

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <div
        className="clay-pressed flex h-40 items-end justify-around gap-2 px-4 pt-4 pb-1"
        role="img"
        aria-label={`${title}: ${top.map(([label, count]) => `${label} ${count}`).join(", ")}`}
      >
        {top.map(([label, count]) => {
          const pct = Math.round((count / max) * 100)
          return (
            <div key={label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold tabular-nums">{count}</span>
              <div className="flex w-full max-w-10 flex-1 items-end">
                <div
                  className="w-full rounded-t-full"
                  style={{
                    height: `${Math.max(6, pct)}%`,
                    backgroundImage: "linear-gradient(180deg, #a5b4fc 0%, #6366f1 100%)",
                  }}
                />
              </div>
              <span className="w-full truncate text-center text-[11px] text-muted-foreground" title={label}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

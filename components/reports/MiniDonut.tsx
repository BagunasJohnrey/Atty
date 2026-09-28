"use client"

import * as React from "react"

const PALETTE = ["#6366f1", "#fb7185", "#10b981", "#f59e0b", "#8b5cf6", "#0ea5e9"]

export interface DonutSegment {
  label: string
  value: number
}

/** Small multi-slice donut for bounded category sets (gender, year level). */
export function MiniDonut({
  title,
  segments,
  centerValue,
  centerCaption,
}: {
  title: string
  segments: DonutSegment[]
  centerValue: string
  centerCaption: string
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const R = 54
  const C = 2 * Math.PI * R
  // Cumulative start offsets, computed without mutation.
  const fracs = segments.map((s) => (total > 0 ? s.value / total : 0))
  const arcs = segments.map((s, i) => ({
    ...s,
    frac: fracs[i] ?? 0,
    start: fracs.slice(0, i).reduce((a, b) => a + b, 0),
    color: PALETTE[i % PALETTE.length],
  }))
  // Hovered/focused slice pops; siblings dim. Legend stays as the readout.
  const [hot, setHot] = React.useState<number | null>(null)

  return (
    <div className="clay-pressed flex flex-col gap-3 p-4 sm:p-5">
      <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <div
        className="flex items-center gap-4"
        role="img"
        aria-label={`${title}: ${arcs.map((a) => `${a.label} ${a.value}`).join(", ")}`}
      >
        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden className="shrink-0">
          <circle
            cx="66"
            cy="66"
            r={R}
            fill="none"
            strokeWidth="18"
            style={{ stroke: "var(--muted)" }}
            opacity={0.55}
          />
          {arcs.map((a, i) =>
            a.frac <= 0 ? null : (
              <g
                key={a.label}
                className="donut-seg"
                tabIndex={0}
                role="img"
                aria-label={`${a.label}: ${a.value} (${Math.round(a.frac * 100)} percent)`}
                style={{ opacity: hot === null || hot === i ? 1 : 0.3 }}
                onMouseEnter={() => setHot(i)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(i)}
                onBlur={() => setHot(null)}
              >
                <title>{`${a.label}: ${a.value} (${Math.round(a.frac * 100)}%)`}</title>
                <circle
                  cx="66"
                  cy="66"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="18"
                  strokeDasharray={`${Math.max(a.frac * C - 6, 0.1)} ${C}`}
                  strokeDashoffset={-a.start * C}
                  strokeLinecap="round"
                  transform="rotate(-90 66 66)"
                />
              </g>
            )
          )}
          <text x="66" y="64" textAnchor="middle" className="fill-foreground" fontSize="20" fontWeight="800">
            {centerValue}
          </text>
          <text x="66" y="82" textAnchor="middle" className="fill-muted-foreground" fontSize="10" fontWeight="600">
            {centerCaption}
          </text>
        </svg>
        <ul className="flex min-w-0 flex-col gap-1.5 text-sm">
          {arcs.map((a) => (
            <li key={a.label} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-[4px]"
                style={{ backgroundColor: a.color }}
                aria-hidden
              />
              <span className="truncate font-medium" title={a.label}>
                {a.label}
              </span>
              <span className="ml-auto pl-2 text-muted-foreground tabular-nums">
                {a.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

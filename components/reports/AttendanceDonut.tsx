"use client"

export function AttendanceDonut({
  present,
  absent,
  rate,
}: {
  present: number
  absent: number
  rate: number
}) {
  const total = present + absent
  const R = 62
  const C = 2 * Math.PI * R
  const frac = total > 0 ? present / total : 0

  return (
    <div
      className="flex items-center gap-4"
      role="img"
      aria-label={`Attendance: ${present} present, ${absent} absent, ${rate} percent rate`}
    >
      <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden>
        <defs>
          <linearGradient id="donut-present" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle
          cx="74"
          cy="74"
          r={R}
          fill="none"
          strokeWidth="20"
          style={{ stroke: "var(--muted)" }}
          opacity={0.55}
        />
        <circle
          cx="74"
          cy="74"
          r={R}
          fill="none"
          stroke="url(#donut-present)"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={`${frac * C} ${C}`}
          transform="rotate(-90 74 74)"
        />
        <text
          x="74"
          y="70"
          textAnchor="middle"
          className="fill-foreground"
          fontSize="26"
          fontWeight="800"
        >
          {rate}%
        </text>
        <text
          x="74"
          y="90"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="11"
          fontWeight="600"
        >
          attendance
        </text>
      </svg>
      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-emerald-500" aria-hidden />
          <span className="font-semibold tabular-nums">{present}</span>
          <span className="text-muted-foreground">Present</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-muted-foreground/50" aria-hidden />
          <span className="font-semibold tabular-nums">{absent}</span>
          <span className="text-muted-foreground">Absent</span>
        </li>
      </ul>
    </div>
  )
}

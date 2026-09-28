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
  // Floor the rendered arc so trace amounts (e.g. 0.2%) stay visible.
  const arc = present > 0 ? Math.max(frac, 0.035) : 0

  return (
    <div
      className="flex items-center justify-center"
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
          className="donut-seg"
          strokeDasharray={`${arc * C} ${C}`}
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
    </div>
  )
}

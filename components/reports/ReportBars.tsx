"use client"

import type { AttendanceReport } from "@/models/report"
import { BreakdownBar } from "./BreakdownBar"

function Group({ title, entries, total }: { title: string; entries: [string, number][]; total: number }) {
  if (entries.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h4>
      {entries.slice(0, 6).map(([label, count]) => (
        <BreakdownBar key={label} label={label} count={count} total={total} />
      ))}
    </div>
  )
}

export function ReportBars({ report }: { report: AttendanceReport }) {
  const present = Math.max(1, report.totalPresent)
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Group title="By college" entries={Object.entries(report.byCollege)} total={present} />
      <Group title="By gender" entries={Object.entries(report.byGender)} total={present} />
      <Group title="By program" entries={Object.entries(report.byProgram)} total={present} />
      <Group title="By year level" entries={Object.entries(report.byYearLevel)} total={present} />
    </div>
  )
}

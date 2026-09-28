"use client"

import type { AttendanceReport } from "@/models/report"
import { attendanceRate } from "@/lib/format"
import { AttendanceDonut } from "./AttendanceDonut"
import { BreakdownBar } from "./BreakdownBar"
import { CategoryChart } from "./CategoryChart"

function SplitList({
  title,
  entries,
  total,
}: {
  title: string
  entries: [string, number][]
  total: number
}) {
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
  const rate = attendanceRate(report.totalPresent, report.totalStudents)

  return (
    <div className="mt-4 flex flex-col gap-5">
      <AttendanceDonut present={report.totalPresent} absent={report.totalAbsent} rate={rate} />
      <div className="grid gap-5 md:grid-cols-2">
        <CategoryChart title="By department" entries={Object.entries(report.byCollege)} />
        <CategoryChart title="By course" entries={Object.entries(report.byProgram)} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <SplitList
          title="By year level"
          entries={Object.entries(report.byYearLevel)}
          total={present}
        />
        <SplitList title="By gender" entries={Object.entries(report.byGender)} total={present} />
      </div>
    </div>
  )
}

"use client"

import type { AttendanceReport } from "@/models/report"
import { attendanceRate } from "@/lib/format"
import { AttendanceDonut } from "./AttendanceDonut"
import { CategoryChart } from "./CategoryChart"
import { MiniDonut } from "./MiniDonut"

export function ReportBars({ report }: { report: AttendanceReport }) {
  const present = Math.max(1, report.totalPresent)
  const rate = attendanceRate(report.totalPresent, report.totalStudents)
  const genders = Object.entries(report.byGender).map(([label, value]) => ({ label, value }))
  const years = Object.entries(report.byYearLevel).map(([label, value]) => ({ label, value }))

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="clay-pressed p-4 sm:p-5">
          <h4 className="mb-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Overall turnout
          </h4>
          <AttendanceDonut present={report.totalPresent} absent={report.totalAbsent} rate={rate} />
        </div>
        {genders.length > 0 ? (
          <MiniDonut
            title="By gender"
            segments={genders}
            centerValue={String(report.totalPresent)}
            centerCaption="present"
          />
        ) : null}
        {years.length > 0 ? (
          <MiniDonut
            title="By year level"
            segments={years}
            centerValue={String(report.totalPresent)}
            centerCaption="present"
          />
        ) : null}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CategoryChart
          title="By department"
          entries={Object.entries(report.byCollege)}
          total={present}
          tone="indigo"
        />
        <CategoryChart
          title="By course"
          entries={Object.entries(report.byProgram)}
          total={present}
          tone="violet"
        />
      </div>
    </div>
  )
}

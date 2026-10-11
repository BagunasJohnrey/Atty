"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { attendanceRate } from "@/lib/format"
import { useReport } from "@/hooks/useQueries"
import type { AttendanceReport } from "@/models/report"

const Bars = dynamic(() => import("./ReportBars").then((m) => m.ReportBars), {
  ssr: false,
  loading: () => <Skeleton className="h-32" />,
})

export function ReportSummary({ eventId }: { eventId: string }) {
  const { data, error, loading } = useReport(eventId)
  const params = useSearchParams()

  if (loading && !data) return <Skeleton className="h-48" />
  if (error || !data) {
    return (
      <p role="alert" className="clay p-4 text-sm text-destructive">
        Could not load report{error ? `: ${error.message}` : "."}
      </p>
    )
  }

  const { report } = data
  const rate = attendanceRate(report.totalPresent, report.totalStudents)
  // Deploy-transition tolerance: a cached pre-upgrade report has no day
  // sections yet. It heals on the next fetch seconds later.
  const days = report.days ?? []
  const picked = params.get("day") ?? ""
  const scoped = picked ? days.find((d) => d.day === picked) : undefined

  if (picked && !scoped) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="clay-pressed p-4 text-sm text-muted-foreground">
            No attendance recorded on {picked}.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Tiles and charts follow the picked day; "All days" keeps the overall
  // distinct-student totals. A day section has one row per student max, so
  // its present count doubles as its scan count.
  const tiles = scoped
    ? [
        { label: "Present", value: scoped.present },
        { label: "Absent", value: scoped.absent },
        { label: "Rate %", value: scoped.rate },
        { label: "Scans", value: scoped.present },
      ]
    : [
        { label: "Present", value: report.totalPresent },
        { label: "Absent", value: report.totalAbsent },
        { label: "Rate %", value: rate },
        { label: "Scans", value: report.totalScans ?? "—" },
      ]
  const sections = scoped ? [scoped] : days
  const chartReport: AttendanceReport = scoped
    ? {
        ...report,
        totalPresent: scoped.present,
        totalAbsent: scoped.absent,
        attendanceRate: scoped.rate,
        byCollege: scoped.byCollege,
        byProgram: scoped.byProgram,
        byYearLevel: scoped.byYearLevel,
        byGender: scoped.byGender,
      }
    : report

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {tiles.map((s) => (
            <div key={s.label} className="clay-pressed p-3">
              <p className="text-xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        {sections.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {sections.map((d) => (
              <div
                key={d.day}
                className="clay-pressed flex flex-wrap items-baseline gap-x-4 gap-y-1 p-3 text-sm"
              >
                <span className="font-mono font-semibold">{d.day}</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground tabular-nums">
                    {d.present}
                  </strong>{" "}
                  present ·{" "}
                  <strong className="text-foreground tabular-nums">
                    {d.absent}
                  </strong>{" "}
                  absent ·{" "}
                  <strong className="text-foreground tabular-nums">
                    {d.rate}%
                  </strong>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <Bars report={chartReport} />
      </CardContent>
    </Card>
  )
}

"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useReport } from "@/hooks/useQueries"
import type { AttendanceReport } from "@/models/report"
import { hasReportFilters, parseReportFilters } from "@/lib/reports/filters"

const Bars = dynamic(() => import("./ReportBars").then((m) => m.ReportBars), {
  ssr: false,
  loading: () => <Skeleton className="h-32" />,
})

export function ReportSummary({ eventId }: { eventId: string }) {
  const params = useSearchParams()
  const filters = parseReportFilters(params)
  const { data, error, loading } = useReport(eventId, filters)

  if (loading && !data) return <Skeleton className="h-48" />
  if (error || !data) {
    return (
      <p role="alert" className="clay p-4 text-sm text-destructive">
        Could not load report{error ? `: ${error.message}` : "."}
      </p>
    )
  }

  const { report } = data
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
        {hasReportFilters(filters) ? (
          <span className="clay-pressed shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            Filtered
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <Bars report={chartReport} />
      </CardContent>
    </Card>
  )
}

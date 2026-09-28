"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { attendanceRate } from "@/lib/format"
import { useReport } from "@/hooks/useQueries"

const Bars = dynamic(() => import("./ReportBars").then((m) => m.ReportBars), {
  ssr: false,
  loading: () => <Skeleton className="h-32" />,
})

export function ReportSummary({ eventId }: { eventId: string }) {
  const { data, error, loading } = useReport(eventId)

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Present", value: report.totalPresent },
            { label: "Absent", value: report.totalAbsent },
            { label: "Rate %", value: rate },
          ].map((s) => (
            <div key={s.label} className="clay-pressed p-3">
              <p className="text-xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <Bars report={report} />
      </CardContent>
    </Card>
  )
}

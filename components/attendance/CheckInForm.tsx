"use client"

import * as React from "react"
import { ScanLine, CircleCheck, TriangleAlert, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input, Label } from "@/components/ui/input"
import { ApiError, checkAttendance, recordAttendance } from "@/lib/api-client"
import { formatTimestamp, normalizeSrcode } from "@/lib/format"
import type { Student } from "@/models/student"

type Phase =
  | { kind: "input"; error: string | null }
  | { kind: "confirm"; student: Student }
  | { kind: "duplicate"; message: string; timestamp?: string }
  | { kind: "done"; student: Student; timestamp: string }

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  )
}

export function CheckInForm({
  eventId,
  eventName,
  eventActive,
}: {
  eventId: string
  eventName: string
  eventActive: boolean
}) {
  const [srcode, setSrcode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [phase, setPhase] = React.useState<Phase>({ kind: "input", error: null })
  const [recent, setRecent] = React.useState<{ srcode: string; name: string; timestamp: string }[]>([])
  const deferredRecent = React.useDeferredValue(recent)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /** Step 1 (FR-04/FR-05): validate the SR Code and show verified info. */
  async function onLookup(e: React.FormEvent) {
    e.preventDefault()
    const code = normalizeSrcode(srcode)
    if (!code || busy) return
    setBusy(true)
    try {
      const res = await checkAttendance(eventId, code)
      if (!res.check.student) {
        setPhase({ kind: "input", error: "Invalid SR Code. Please check your SR Code and try again." })
      } else if (res.check.present) {
        setPhase({
          kind: "duplicate",
          message: "Attendance already recorded for this event.",
          timestamp: res.check.timestamp,
        })
      } else {
        setPhase({ kind: "confirm", student: res.check.student })
      }
    } catch (err) {
      setPhase({
        kind: "input",
        error:
          err instanceof ApiError && err.code === "SRCODE_NOT_FOUND"
            ? "Invalid SR Code. Please check your SR Code and try again."
            : err instanceof ApiError
              ? err.message
              : "Validation failed. Please try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  /** Step 2 (FR-07/FR-08): record only after the student confirms. */
  async function onConfirm() {
    if (phase.kind !== "confirm" || busy) return
    const student = phase.student
    setBusy(true)
    try {
      const res = await recordAttendance(eventId, student.srcode)
      setPhase({ kind: "done", student: res.student, timestamp: res.timestamp })
      setRecent((prev) =>
        [{ srcode: student.srcode, name: res.student.name, timestamp: res.timestamp }, ...prev].slice(0, 5)
      )
      setSrcode("")
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_ATTENDANCE") {
        setPhase({ kind: "duplicate", message: "Attendance already recorded for this event." })
      } else {
        setPhase({
          kind: "input",
          error: err instanceof ApiError ? err.message : "Check-in failed. Please try again.",
        })
      }
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function reset() {
    setPhase({ kind: "input", error: null })
    setSrcode("")
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          {phase.kind === "confirm" ? (
            <div className="animate-clay-pop flex flex-col gap-3" aria-live="polite">
              <Badge variant="success" className="self-start">
                SR Code verified
              </Badge>
              <div className="clay-pressed flex flex-col gap-2 p-4">
                <Detail label="Department" value={phase.student.college} />
                <Detail label="Full Name" value={phase.student.name} />
                <Detail label="Course" value={phase.student.program} />
                <Detail label="SR Code" value={phase.student.srcode} />
              </div>
              <p className="text-sm text-muted-foreground">
                Please confirm your attendance for <strong>{eventName}</strong>.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => void onConfirm()} disabled={busy} className="clay-btn h-12 flex-1 text-base">
                  <CircleCheck className="size-5" aria-hidden />
                  {busy ? "Recording…" : "Confirm Attendance"}
                </Button>
                <Button variant="outline" onClick={reset} disabled={busy} className="clay-btn h-12">
                  <Undo2 className="size-4" aria-hidden /> Back
                </Button>
              </div>
            </div>
          ) : phase.kind === "done" ? (
            <div className="animate-clay-pop flex flex-col gap-3" aria-live="polite">
              <Badge variant="success" className="animate-clay-ring self-start">
                Attendance Confirmed.
              </Badge>
              <div className="clay-pressed flex flex-col gap-2 p-4">
                <Detail label="Full Name" value={phase.student.name} />
                <Detail label="Department" value={phase.student.college} />
                <Detail label="Course" value={phase.student.program} />
                <Detail label="Event" value={eventName} />
                <Detail label="Date & Time" value={formatTimestamp(phase.timestamp)} />
                <Detail label="Status" value="Present" />
              </div>
              <Button onClick={reset} className="clay-btn h-12 text-base">
                <ScanLine className="size-5" aria-hidden /> Check in another student
              </Button>
            </div>
          ) : phase.kind === "duplicate" ? (
            <div className="animate-clay-pop flex flex-col gap-3" aria-live="polite">
              <p className="clay-pressed flex items-start gap-2 p-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <span>
                  {phase.message}
                  {phase.timestamp ? (
                    <span className="block text-muted-foreground">
                      Checked in at {formatTimestamp(phase.timestamp)}
                    </span>
                  ) : null}
                </span>
              </p>
              <Button variant="outline" onClick={reset} className="clay-btn h-12">
                <ScanLine className="size-5" aria-hidden /> Scan another SR Code
              </Button>
            </div>
          ) : (
            <form onSubmit={onLookup} className="flex flex-col gap-3">
              <Label htmlFor="srcode">Enter / Scan SR Code</Label>
              <Input
                ref={inputRef}
                id="srcode"
                value={srcode}
                onChange={(e) => setSrcode(e.target.value.toUpperCase())}
                placeholder="23-19300"
                autoComplete="off"
                disabled={!eventActive || busy}
                className="h-14 text-center font-mono text-xl tracking-widest"
              />
              <Button type="submit" disabled={!eventActive || busy || !srcode.trim()} className="clay-btn h-12 text-base">
                <ScanLine className="size-5" aria-hidden />
                {busy ? "Validating…" : "Validate SR Code"}
              </Button>
              {!eventActive ? (
                <p role="note" className="text-sm text-muted-foreground">
                  This event is not Active — check-ins are disabled.
                </p>
              ) : null}
              {phase.error ? (
                <p role="alert" className="clay-pressed p-4 text-sm text-destructive">
                  {phase.error}
                </p>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
      {deferredRecent.length > 0 ? (
        <Card>
          <CardContent>
            <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Recent check-ins</h3>
            <ul className="flex flex-col gap-2">
              {deferredRecent.map((r) => (
                <li key={`${r.srcode}-${r.timestamp}`} className="clay-pressed flex justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-mono">{r.srcode}</span>
                  <span className="truncate">{r.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

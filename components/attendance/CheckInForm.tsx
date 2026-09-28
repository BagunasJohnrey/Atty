"use client"

import * as React from "react"
import { ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input, Label } from "@/components/ui/input"
import { ApiError, recordAttendance } from "@/lib/api-client"
import { formatTimestamp, normalizeSrcode } from "@/lib/format"
import type { Student } from "@/models/student"

type Outcome =
  | { kind: "idle" }
  | { kind: "success"; student: Student; timestamp: string }
  | { kind: "duplicate"; student: Student | null; timestamp?: string; message: string }
  | { kind: "error"; message: string }

export function CheckInForm({ eventId, eventActive }: { eventId: string; eventActive: boolean }) {
  const [srcode, setSrcode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" })
  const [recent, setRecent] = React.useState<{ srcode: string; name: string; timestamp: string }[]>([])
  const deferredRecent = React.useDeferredValue(recent)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = normalizeSrcode(srcode)
    if (!code || busy) return
    setBusy(true)
    try {
      const res = await recordAttendance(eventId, code)
      setOutcome({ kind: "success", student: res.student, timestamp: res.timestamp })
      setRecent((prev) => [{ srcode: code, name: res.student.name, timestamp: res.timestamp }, ...prev].slice(0, 5))
      setSrcode("")
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_ATTENDANCE") {
        setOutcome({ kind: "duplicate", student: null, message: err.message })
      } else {
        setOutcome({
          kind: "error",
          message: err instanceof ApiError ? err.message : "Check-in failed.",
        })
      }
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Label htmlFor="srcode">Enter / Scan SRCODE</Label>
            <Input
              ref={inputRef}
              id="srcode"
              value={srcode}
              onChange={(e) => setSrcode(e.target.value.toUpperCase())}
              placeholder="26-12345"
              autoComplete="off"
              disabled={!eventActive || busy}
              className="h-14 text-center font-mono text-xl tracking-widest"
            />
            <Button type="submit" disabled={!eventActive || busy || !srcode.trim()} className="clay-btn h-12 text-base">
              <ScanLine className="size-5" aria-hidden />
              {busy ? "Checking in…" : "Check In"}
            </Button>
            {!eventActive ? (
              <p role="note" className="text-sm text-muted-foreground">
                This event is not Active — check-ins are disabled.
              </p>
            ) : null}
          </form>
          <div aria-live="polite" className="mt-2">
            {outcome.kind === "success" ? (
              <p className="clay-pressed animate-clay-pop flex flex-col gap-1 p-4">
                <Badge variant="success" className="animate-clay-ring self-start">Attendance recorded</Badge>
                <span className="font-semibold">{outcome.student.name}</span>
                <span className="text-sm text-muted-foreground">
                  {outcome.student.program} · {outcome.student.yearLevel} · {formatTimestamp(outcome.timestamp)}
                </span>
              </p>
            ) : outcome.kind === "duplicate" ? (
              <p className="clay-pressed flex flex-col gap-1 p-4">
                <Badge variant="warning">Already checked in</Badge>
                <span className="text-sm">{outcome.message}</span>
              </p>
            ) : outcome.kind === "error" ? (
              <p role="alert" className="clay-pressed p-4 text-sm text-destructive">
                {outcome.message}
              </p>
            ) : null}
          </div>
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

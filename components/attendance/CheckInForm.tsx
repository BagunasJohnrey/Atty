"use client"

import * as React from "react"
import { ScanLine, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input, Label } from "@/components/ui/input"
import { ApiError, checkAttendance, recordAttendance } from "@/lib/api-client"
import {
  formatTimestamp,
  isValidSrcodeFormat,
  normalizeSrcode,
  SRCODE_MAX_LENGTH,
} from "@/lib/format"
import type { Student } from "@/models/student"
import { getSharedQueue } from "@/lib/offline/shared"

type Outcome =
  | { kind: "idle" }
  | { kind: "duplicate"; message: string; timestamp?: string }
  | { kind: "done"; student: Student; timestamp: string }
  | { kind: "queued"; srcode: string }

/** Result cards fade out this long after appearing, then clear. */
const RESULT_DISMISS_MS = 5000
/** Fade transition length before the cleared card unmounts. */
const DISMISS_FADE_MS = 300

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
  const [validating, setValidating] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const busy = validating || recording
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" })
  const [error, setError] = React.useState<string | null>(null)
  const [dismissing, setDismissing] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /** Auto-dismiss: result cards fade out 5s after appearing so the kiosk
      returns to a clean state for the next scan. A new scan replaces the
      outcome, which restarts both timers via cleanup. */
  React.useEffect(() => {
    // Always reset first: a new scan landing on a result must render
    // fully visible even if the previous result was mid-fade.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional cascading reset: each new outcome must render fully visible before its own timers arm; converges immediately (same-value bail-out, no loop).
    setDismissing(false)
    if (
      outcome.kind !== "done" &&
      outcome.kind !== "duplicate" &&
      outcome.kind !== "queued"
    ) {
      return
    }
    const fadeTimer = setTimeout(() => setDismissing(true), RESULT_DISMISS_MS)
    const clearTimer = setTimeout(
      () => setOutcome({ kind: "idle" }),
      RESULT_DISMISS_MS + DISMISS_FADE_MS
    )
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(clearTimer)
    }
  }, [outcome])

  /** One tap (FR-04/FR-05/FR-07/FR-08): validate the SR Code and record
      immediately when the student is verified and not yet present. */
  async function onLookup(e: React.FormEvent) {
    e.preventDefault()
    const code = normalizeSrcode(srcode)
    if (!code || busy) return
    // Client-side gate: never hit the spreadsheet with a malformed code.
    if (!isValidSrcodeFormat(code)) {
      setOutcome({ kind: "idle" })
      setError("Invalid SR Code format. Use 00-00000 (e.g. 23-19300).")
      inputRef.current?.focus()
      return
    }
    setValidating(true)
    let verified = false
    try {
      const res = await checkAttendance(eventId, code)
      // The form stays mounted and resets for the next scan in every path;
      // results render underneath, never in place of the form.
      setSrcode("")
      if (!res.check.student) {
        setOutcome({ kind: "idle" })
        setError("Invalid SR Code. Please check your SR Code and try again.")
      } else if (res.check.present) {
        setOutcome({
          kind: "duplicate",
          message: "Attendance already recorded today.",
          timestamp: res.check.timestamp,
        })
      } else {
        verified = true
      }
    } catch (err) {
      if (err instanceof TypeError) {
        let enqueueFailed = false
        try {
          // eslint-disable-next-line react-hooks/purity -- stamps the scan at event time: onLookup runs only on form submit, never during render.
          await getSharedQueue().enqueue(eventId, code, Date.now())
        } catch {
          enqueueFailed = true
        }
        if (!enqueueFailed) {
          setError(null)
          setOutcome({ kind: "queued", srcode: code })
          return
        }
        // Storage/quota failure: fall through to the generic error branch.
      }
      setOutcome({ kind: "idle" })
      setError(
        err instanceof ApiError && err.code === "SRCODE_NOT_FOUND"
          ? "Invalid SR Code. Please check your SR Code and try again."
          : err instanceof ApiError
            ? err.message
            : "Validation failed. Please try again."
      )
    } finally {
      setValidating(false)
      inputRef.current?.focus()
    }
    if (verified) await recordCode(code)
  }

  /** Record right after verification, with no confirm step. */
  async function recordCode(code: string) {
    setRecording(true)
    try {
      const res = await recordAttendance(eventId, code)
      setOutcome({
        kind: "done",
        student: res.student,
        timestamp: res.timestamp,
      })
      setSrcode("")
    } catch (err) {
      // Mirror the lookup path: a network-layer failure queues the scan
      // instead of erroring, so a dropout after verification never loses
      // the attendance.
      if (err instanceof TypeError) {
        let enqueueFailed = false
        try {
          await getSharedQueue().enqueue(eventId, code, Date.now())
        } catch {
          enqueueFailed = true
        }
        if (!enqueueFailed) {
          setError(null)
          setOutcome({ kind: "queued", srcode: code })
          return
        }
        // Storage/quota failure: fall through to the generic error branch.
      }
      if (err instanceof ApiError && err.code === "DUPLICATE_ATTENDANCE") {
        setOutcome({
          kind: "duplicate",
          message: "Attendance already recorded today.",
        })
      } else {
        setOutcome({ kind: "idle" })
        setError(
          err instanceof ApiError
            ? err.message
            : "Check-in failed. Please try again."
        )
      }
    } finally {
      setRecording(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <form onSubmit={onLookup} className="flex flex-col gap-3">
            <Label htmlFor="srcode">Enter SR Code</Label>
            <Input
              ref={inputRef}
              id="srcode"
              value={srcode}
              onChange={(e) => {
                // Manual dash: the operator types 00-00000 exactly.
                // Keystrokes filter to digits-and-dash only; placement is
                // validated on submit, never reformatted while typing.
                setSrcode(e.target.value.toUpperCase().replace(/[^0-9-]/g, ""))
                setError(null)
              }}
              placeholder="26-12345"
              autoComplete="off"
              spellCheck={false}
              // Digits-and-dash code: touch devices get the numeric layout
              // (dash included where the OS offers it). Desktop is unaffected
              // — inputMode only shapes virtual keyboards.
              inputMode="numeric"
              maxLength={SRCODE_MAX_LENGTH}
              disabled={!eventActive || busy}
              className="h-14 text-center font-mono text-xl tracking-widest"
            />
            <Button
              type="submit"
              disabled={!eventActive || busy || !srcode.trim()}
              className="clay-btn clay-btn-primary h-12 text-base"
            >
              <ScanLine className="size-5" aria-hidden />
              {validating
                ? "Validating…"
                : recording
                  ? "Recording…"
                  : "Validate SR Code"}
            </Button>
            {!eventActive ? (
              <p role="note" className="text-sm text-muted-foreground">
                This event is not Active — check-ins are disabled.
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="clay-pressed p-4 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div
        aria-live="polite"
        className={`flex flex-col gap-4 transition-opacity duration-300 motion-reduce:transition-none ${dismissing ? "opacity-0" : "opacity-100"}`}
      >
        {outcome.kind === "done" ? (
          <Card>
            <CardContent>
              <div className="animate-clay-pop flex flex-col gap-3">
                <Badge variant="success" className="animate-clay-ring self-end">
                  Attendance Confirmed.
                </Badge>
                <div className="clay-pressed flex flex-col gap-2 p-4">
                  <Detail label="Full Name" value={outcome.student.name} />
                  <Detail label="Department" value={outcome.student.college} />
                  <Detail label="Course" value={outcome.student.program} />
                  <Detail label="Event" value={eventName} />
                  <Detail
                    label="Date & Time"
                    value={formatTimestamp(outcome.timestamp)}
                  />
                  <Detail label="Status" value="Present" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {outcome.kind === "duplicate" ? (
          <Card>
            <CardContent>
              <div className="animate-clay-pop flex flex-col gap-3">
                <p className="clay-pressed flex items-start gap-2 p-4 text-sm">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                    aria-hidden
                  />
                  <span>
                    {outcome.message}
                    {outcome.timestamp ? (
                      <span className="block text-muted-foreground">
                        Checked in at {formatTimestamp(outcome.timestamp)}
                      </span>
                    ) : null}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {outcome.kind === "queued" ? (
          <Card>
            <CardContent>
              <div className="animate-clay-pop flex flex-col gap-3">
                <p className="clay-pressed flex items-start gap-2 p-4 text-sm">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                    aria-hidden
                  />
                  <span>
                    Attendance recorded successfully. It will sync automatically
                    when an internet connection is restored.
                    <span className="block text-muted-foreground">
                      {outcome.srcode}
                    </span>
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

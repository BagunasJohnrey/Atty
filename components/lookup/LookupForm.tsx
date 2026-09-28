"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input, Label } from "@/components/ui/input"
import { ApiError, lookupStudent } from "@/lib/api-client"
import { normalizeSrcode } from "@/lib/format"
import type { Student } from "@/models/student"

export function LookupForm() {
  const [srcode, setSrcode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [student, setStudent] = React.useState<Student | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = normalizeSrcode(srcode)
    if (!code || busy) return
    setBusy(true)
    setError(null)
    setStudent(null)
    try {
      const res = await lookupStudent(code)
      setStudent(res.student)
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "SRCODE_NOT_FOUND"
          ? "Invalid SR Code. Please check your SR Code and try again."
          : e instanceof ApiError
            ? e.message
            : "Lookup failed."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Label htmlFor="lookup-srcode">Student SRCODE</Label>
            <Input
              id="lookup-srcode"
              value={srcode}
              onChange={(e) => setSrcode(e.target.value.toUpperCase())}
              placeholder="26-12345"
              autoComplete="off"
              spellCheck={false}
              className="h-12 font-mono text-lg tracking-widest"
            />
            <Button type="submit" disabled={busy || !srcode.trim()} className="clay-btn clay-btn-primary">
              {busy ? "Looking up…" : "Look up student"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {student ? (
        <Card>
          <CardContent>
            <Badge variant="success" className="self-start">Verified</Badge>
            <div className="clay-pressed flex flex-col gap-2 p-4">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Department</span>
                <span className="text-right font-semibold">{student.college}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Full Name</span>
                <span className="text-right font-semibold">{student.name}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Course</span>
                <span className="text-right font-semibold">{student.program}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">SR Code</span>
                <span className="text-right font-mono">{student.srcode}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {error ? <p role="alert" className="clay p-4 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

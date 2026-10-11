"use client"

import * as React from "react"
import { DatabaseBackup } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

/**
 * Manual trigger for the nightly Sheets backup (events + attendance only;
 * the roster is out of scope). Posts to the admin route and toasts the
 * outcome. Takes no props and reads nothing browser-specific during render,
 * so it hydrates cleanly anywhere in the app shell.
 */
export function SheetsBackupButton() {
  const toast = useToast()
  const [running, setRunning] = React.useState(false)
  const [lastRun, setLastRun] = React.useState<string | null>(null)

  async function run() {
    if (running) return
    setRunning(true)
    try {
      const response = await fetch("/api/admin/backup", { method: "POST" })
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        summary?: {
          perEvent?: Record<string, unknown>
          errors?: unknown[]
        }
      } | null
      if (!response.ok || !body?.success) {
        throw new Error(body?.message ?? "Backup failed.")
      }
      const eventCount = Object.keys(body.summary?.perEvent ?? {}).length
      const errorCount = body.summary?.errors?.length ?? 0
      // Formatted on click (not render), so server/client HTML never differ.
      setLastRun(new Date().toLocaleString())
      toast.success(
        `Sheets backup complete: ${eventCount} event(s) mirrored` +
          (errorCount > 0 ? `, ${errorCount} error(s).` : ".")
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup failed.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lastRun ? (
        <span className="text-sm text-muted-foreground">Last run {lastRun}</span>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="clay-btn"
        disabled={running}
        onClick={() => void run()}
      >
        <DatabaseBackup className="size-4" aria-hidden />{" "}
        {running ? "Backing up…" : "Back up to Sheets"}
      </Button>
    </div>
  )
}

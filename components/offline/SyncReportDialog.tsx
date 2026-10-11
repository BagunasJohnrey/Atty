"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { X } from "lucide-react"
import { formatTimeOnly } from "@/lib/format"
import type { SyncOutcome, SyncReport } from "@/lib/offline/sync"

const badgeVariant: Record<SyncOutcome, "success" | "warning" | "error"> = {
  recorded: "success",
  "already-present": "warning",
  failed: "error",
}

export function SyncReportDialog({
  report,
  onClose,
  onDiscard,
}: {
  report: SyncReport
  onClose: () => void
  onDiscard: (scanId: string) => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(next, details) => {
        // An unreviewed sync report must not be lost to a stray backdrop
        // click; the X button and Dismiss still close it.
        if (!next && details?.reason === "outside-press") return
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close dialog"
              className="absolute top-3 right-3"
            >
              <X className="size-4" aria-hidden />
            </Button>
          }
        />
        <DialogTitle>Sync report</DialogTitle>
        <DialogDescription>
          Reviewed failures stay queued or are discarded by the operator.
        </DialogDescription>
        {report.pausedAuth ? (
          <p className="mt-4 text-sm">
            Sync paused — sign in again to continue.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {report.results.map((result) => (
              <li
                key={result.scan.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="font-mono">{result.scan.srcode}</span>
                <Badge variant={badgeVariant[result.outcome]}>
                  {result.outcome}
                </Badge>
                <span className="text-muted-foreground">
                  {formatTimeOnly(
                    new Date(result.scan.scannedAt).toISOString()
                  )}
                </span>
                {result.outcome === "failed" ? (
                  <>
                    {result.message ? <span>{result.message}</span> : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="clay-btn"
                      onClick={() => onDiscard(result.scan.id)}
                    >
                      Discard
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="clay-btn"
            onClick={onClose}
          >
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

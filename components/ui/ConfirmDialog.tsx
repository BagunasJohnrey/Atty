"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Small explicit-confirmation modal for irreversible or session-ending
 * actions. Dumb by design: confirming only calls `onConfirm` — the owner
 * closes the dialog when the work settles. Cancelling (button, X, or
 * outside click) only calls `onOpenChange(false)` and never confirms.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  busy = false,
  destructive = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  busy?: boolean
  destructive?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose
            render={
              <Button
                variant="outline"
                className="clay-btn h-12"
                disabled={busy}
              >
                {cancelLabel}
              </Button>
            }
          />
          <Button
            variant={destructive ? "destructive" : undefined}
            className={
              destructive ? "clay-btn h-12" : "clay-btn clay-btn-primary h-12"
            }
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

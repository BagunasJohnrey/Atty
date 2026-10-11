"use client"

import * as React from "react"
import { recordAttendance } from "@/lib/api-client"
import { getSharedQueue, isMemoryFallback } from "@/lib/offline/shared"
import type { SyncReport } from "@/lib/offline/sync"
import { QueueStatus } from "./QueueStatus"
import { SyncReportDialog } from "./SyncReportDialog"
import { useToast } from "@/components/ui/toast"

export function QueueSyncPanel({ eventId }: { eventId: string }) {
  const toast = useToast()
  const [report, setReport] = React.useState<SyncReport | null>(null)
  const queue = React.useMemo(() => getSharedQueue(), [])
  // `isMemoryFallback()` differs between server prerender (no IndexedDB) and
  // the browser. Read it in an effect so the first render is `false` on both
  // sides (QueueStatus returns null) and hydration matches.
  const [storageWarning, setStorageWarning] = React.useState(false)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe sync: first render must match the server (false); real value applies after mount.
    setStorageWarning(isMemoryFallback())
  }, [])

  function handleReport(next: SyncReport) {
    // Auto-sync fires on mount / event change / reconnect even when there is
    // nothing queued. An empty, non-auth report means "nothing to do" — stay
    // silent instead of popping the dialog with only the description text.
    if (!next.pausedAuth && next.results.length === 0) return
    if (
      !next.pausedAuth &&
      next.results.every(
        (r) => r.outcome === "recorded" || r.outcome === "already-present"
      )
    ) {
      toast.success("Sync complete.")
      return
    }
    setReport(next)
  }

  return (
    <>
      <QueueStatus
        eventId={eventId}
        queue={queue}
        record={recordAttendance}
        onReport={handleReport}
        storageWarning={storageWarning}
      />
      {report ? (
        <SyncReportDialog
          report={report}
          onClose={() => setReport(null)}
          onDiscard={(id) => {
            void queue.remove(id)
            setReport((current) =>
              current
                ? {
                    ...current,
                    results: current.results.filter((r) => r.scan.id !== id),
                  }
                : current
            )
          }}
        />
      ) : null}
    </>
  )
}

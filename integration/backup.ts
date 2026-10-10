import "server-only"

import { requestAppsScript } from "./http"
import {
  fetchAttendanceNeon,
  fetchEventsNeon,
  type NeonAttendanceRow,
  type NeonEventRow,
} from "./neon"

/**
 * Neon → Sheets backup orchestration (events + attendance only; the roster
 * moves yearly and is never part of this backup).
 *
 * Reads Neon, then pushes each table through the bulk Apps Script backup
 * actions in a single call per table/event. One event's failure is collected
 * into `errors` while the rest continue, so a single bad event never blocks
 * the nightly run.
 */

export interface BackupTableReport {
  inserted: number
  updated: number
  untouched: number
  sheetOnly: number
  skipped?: boolean
}

export interface BackupSummary {
  events: BackupTableReport
  perEvent: Record<string, BackupTableReport>
  errors: { eventId: string; message: string }[]
}

export async function sendBackupEvents(
  events: NeonEventRow[]
): Promise<BackupTableReport> {
  const response = await requestAppsScript<{ report: BackupTableReport }>(
    "backupEvents",
    { events }
  )
  return response.report
}

export async function backupAttendanceToSheets(
  eventId: string,
  rows: NeonAttendanceRow[]
): Promise<BackupTableReport> {
  const response = await requestAppsScript<{ report: BackupTableReport }>(
    "backupAttendance",
    { eventId, rows }
  )
  return response.report
}

export async function backupAllToSheets(): Promise<BackupSummary> {
  const events = await fetchEventsNeon()
  const summary: BackupSummary = {
    events: await sendBackupEvents(events),
    perEvent: {},
    errors: [],
  }
  for (const event of events) {
    try {
      const rows = await fetchAttendanceNeon(event.id)
      summary.perEvent[event.id] = await backupAttendanceToSheets(
        event.id,
        rows
      )
    } catch (error) {
      summary.errors.push({
        eventId: event.id,
        message: error instanceof Error ? error.message : "Backup failed.",
      })
    }
  }
  return summary
}

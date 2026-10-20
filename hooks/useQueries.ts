"use client"

import * as React from "react"
import {
  getEvent,
  listAttendance,
  listEvents,
  getReport,
  listOrganizations,
} from "@/lib/api-client"
import type { AttendanceFilters } from "@/lib/attendance"
import {
  normalizeReportFilters,
  reportFiltersKey,
  type ReportFilters,
} from "@/lib/reports/filters"
import { invalidatePrefix, useCached } from "./useCached"

export function useEvents() {
  const result = useCached("events:all", listEvents, 30_000)
  const refresh = React.useCallback(() => {
    invalidatePrefix("events:")
    invalidatePrefix("dashboard:")
    result.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.refresh])
  return { ...result, refresh }
}

export function useOrganizations() {
  const result = useCached("organizations:all", listOrganizations, 30_000)
  const refresh = React.useCallback(() => {
    invalidatePrefix("organizations:")
    result.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.refresh])
  return { ...result, refresh }
}

export function useEvent(eventId: string | null) {
  const result = useCached(
    eventId ? `events:${eventId}` : null,
    eventId ? () => getEvent(eventId) : null,
    30_000
  )
  const refresh = React.useCallback(() => {
    if (eventId) invalidatePrefix(`events:${eventId}`)
    invalidatePrefix("events:all")
    result.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, result.refresh])
  return { ...result, refresh }
}

export function useAttendance(
  eventId: string | null,
  filters?: AttendanceFilters,
  page?: number,
  pageSize?: number
) {
  const paginationKey = `${page ?? 1}:${pageSize ?? 50}`
  const key = eventId
    ? `attendance:${eventId}:${JSON.stringify(filters ?? {})}:${paginationKey}`
    : null
  const result = useCached(
    key,
    eventId
      ? () =>
          listAttendance(eventId, filters, {
            page: page ?? 1,
            pageSize: pageSize ?? 50,
          })
      : null,
    10_000
  )
  const refresh = React.useCallback(() => {
    if (eventId) invalidatePrefix(`attendance:${eventId}`)
    result.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, result.refresh])
  return { ...result, refresh }
}

export function useReport(eventId: string | null, filters?: ReportFilters) {
  const filterKey = reportFiltersKey(filters)
  // No-filter reads keep the bare key so offline snapshots saved before
  // facet filters existed still resolve.
  const key = eventId
    ? filterKey === "{}"
      ? `report:${eventId}`
      : `report:${eventId}:${filterKey}`
    : null
  const result = useCached(
    key,
    eventId ? () => getReport(eventId, normalizeReportFilters(filters)) : null,
    10_000
  )
  return result
}

export function formatEventDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Formats a native time-picker value ("HH:MM", 24-hour) into the 12-hour
 * display style event times use ("8:00 AM"). Pure string mapping, no Date
 * involved — ranges like "8:00 AM - 5:00 PM" are composed by the caller.
 * Anything that is not a picker value passes through untouched.
 */
export function formatTimeInput(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return value
  let hour = Number(match[1])
  if (hour > 23 || Number(match[2]) > 59) return value
  const suffix = hour < 12 ? "AM" : "PM"
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}:${match[2]} ${suffix}`
}

/**
 * Reverse of the event-date storage: maps a stored date back to a
 * date-picker value ("YYYY-MM-DD"). Handles ISO storage, zero-padded
 * MM/DD/YYYY storage, and pretty ranges (takes the start half). Anything
 * unparseable yields "" so the picker stays blank instead of lying.
 * Manual parsing only — never `new Date` on ISO strings, which parses as
 * UTC midnight and shifts a day under negative-offset timezones.
 */
export function toDateInputValue(value: string): string {
  return dateHalfToInput(value.split(" - ")[0])
}

function dateHalfToInput(half: string | undefined): string {
  const text = (half ?? "").trim()
  if (!text) return ""
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return text
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`
  }
  // Pretty storage ("November 1, 2026") parses as local midnight, so the
  // local getters below are timezone-safe.
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ""
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Reverse of formatTimeInput for a single stored time ("8:00 AM" back to
 * "08:00"). Case-insensitive for verbatim storage ("12:00 pm"). Anything
 * that is not a 12-hour time yields "" so the picker stays blank.
 */
export function toTimeInputValue(value: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(value.trim())
  if (!match) return ""
  const hour12 = Number(match[1])
  const minute = Number(match[2])
  if (hour12 < 1 || hour12 > 12 || minute > 59) return ""
  let hour = hour12 % 12
  if (match[3].toUpperCase() === "P") hour += 12
  return `${String(hour).padStart(2, "0")}:${match[2]}`
}

export function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  return value
}

/** Date half of a check-in timestamp (FR-12: separate Date column). */
export function formatDateOnly(value: string): string {
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }
  return value
}

/** Time half of a check-in timestamp (FR-12: separate Time column). */
export function formatTimeOnly(value: string): string {
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  return value
}

export function normalizeSrcode(value: string): string {
  return value.trim().toUpperCase()
}

/**
 * Live SR Code mask: keeps digits only (max 7) and inserts the dash after
 * the second digit, so typing or pasting yields 00-00000 progressively.
 * Idempotent on complete codes, so submit-time validation is unaffected.
 */
export function formatSrcodeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 7)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

/** Kiosk SR Code shape: two digits, hyphen, five digits (e.g. 23-19300). */
export const SRCODE_PATTERN = /^\d{2}-\d{5}$/

export const SRCODE_MAX_LENGTH = 8

export function isValidSrcodeFormat(value: string): boolean {
  return SRCODE_PATTERN.test(value.trim())
}

export function attendanceRate(present: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((present / total) * 1000) / 10
}

/**
 * Manila calendar day key (`YYYY-MM-DD` in Asia/Manila) for per-day
 * attendance. `en-CA` formats the date part as ISO order; the explicit
 * time zone keeps the UTC-midnight day-shift trap out regardless of the
 * server's locale.
 */
export function manilaDayKey(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return parts
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/**
 * Picker label for one event day: `Day 1 · Oct 11`. Pure string mapping on
 * the ISO day — no Date involved, so no timezone can shift it.
 */
export function formatDayLabel(dayIso: string, index: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayIso.trim())
  if (!match) return dayIso
  const month = SHORT_MONTHS[Number(match[2]) - 1] ?? match[2]
  return `Day ${index + 1} · ${month} ${Number(match[3])}`
}

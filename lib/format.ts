export function formatEventDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
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

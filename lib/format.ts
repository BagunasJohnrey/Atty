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

export function normalizeSrcode(value: string): string {
  return value.trim().toUpperCase()
}

export function attendanceRate(present: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((present / total) * 1000) / 10
}

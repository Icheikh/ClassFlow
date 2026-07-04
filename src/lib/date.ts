export function parseDateOnly(value?: string | null) {
  if (value) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }

  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function getWeekStartDate(value?: string | Date) {
  const date =
    typeof value === "string"
      ? parseDateOnly(value)
      : value
        ? parseDateOnly(formatDateOnly(value))
        : parseDateOnly()

  const day = date.getUTCDay()
  const diff = (day + 6) % 7
  date.setUTCDate(date.getUTCDate() - diff)
  return date
}

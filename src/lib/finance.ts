export function getMonthLabel(month: string, locale = "ar") {
  const [year, monthValue] = month.split("-").map(Number)
  if (!year || !monthValue) return month

  const dateLocale = locale === "fr" ? "fr-FR" : "ar-MR"

  return new Date(Date.UTC(year, monthValue - 1, 1)).toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
  })
}

export function generateRecentMonthOptions(count = 12, locale = "ar") {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const months: { value: string; label: string }[] = []

  for (let index = 0; index < count; index += 1) {
    const date = new Date(start)
    date.setUTCMonth(date.getUTCMonth() - index)
    const value = date.toISOString().slice(0, 7)
    months.push({ value, label: getMonthLabel(value, locale) })
  }

  return months
}

export function monthBelongsToYear(month: string, year: string) {
  return month.startsWith(`${year}-`)
}

/** First/last day bounds of a "YYYY-MM" month string. */
export function monthBounds(month: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [y, m] = month.split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) return null
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) }
}

/** All "YYYY-MM" strings overlapped by [startsAt, endsAt). Pure + tested. */
export function monthsInRange(startsAt: Date, endsAt: Date): string[] {
  const months: string[] = []
  const cursor = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), 1))
  const end = new Date(endsAt)
  let guard = 0
  while (cursor < end && guard < 24) {
    months.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    guard += 1
  }
  return months
}

/** True remaining on an invoice given total paid (never negative). Pure + tested. */
export function invoiceRemaining(amount: number, paid: number): number {
  return Math.max(amount - paid, 0)
}

/** Status transition after recording payments totalling `paid` against `amount`. Pure + tested. */
export function invoiceStatusAfterPayment(amount: number, paid: number): "PENDING" | "PARTIAL" | "PAID" {
  if (paid <= 0) return "PENDING"
  return paid >= amount ? "PAID" : "PARTIAL"
}

/** Positive-amount guard shared by fees/invoices/payments. Pure + tested. */
export function parsePositiveAmount(raw: unknown): number | null {
  const value = typeof raw === "string" || typeof raw === "number" ? parseFloat(raw as string) : NaN
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

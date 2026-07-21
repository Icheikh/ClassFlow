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

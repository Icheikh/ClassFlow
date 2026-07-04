export function getMonthLabel(month: string) {
  const [year, monthValue] = month.split("-").map(Number)
  if (!year || !monthValue) return month

  return new Date(Date.UTC(year, monthValue - 1, 1)).toLocaleDateString("ar-MR", {
    month: "long",
    year: "numeric",
  })
}

export function generateRecentMonthOptions(count = 12) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const months: { value: string; label: string }[] = []

  for (let index = 0; index < count; index += 1) {
    const date = new Date(start)
    date.setUTCMonth(date.getUTCMonth() - index)
    const value = date.toISOString().slice(0, 7)
    months.push({ value, label: getMonthLabel(value) })
  }

  return months
}

export function monthBelongsToYear(month: string, year: string) {
  return month.startsWith(`${year}-`)
}

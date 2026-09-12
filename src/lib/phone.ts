/**
 * Phone utilities — Phone number is the PRIMARY identity in ClassFlow.
 *
 * Mauritania: 8-digit national numbers (mobiles start with 2/3/4).
 * Accepted inputs: "46123456", "+22246123456", "22246123456", "46 12 34 56".
 * Normalized form: 8 digits (national) for Mauritanian numbers,
 * full digit string for other international numbers.
 */

/** Strip a raw phone input down to its normalized identity, or null if invalid. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  // Mauritania with country code: 222 + 8 digits
  if (digits.startsWith("222") && digits.length === 11) return digits.slice(3)
  // National format
  if (digits.length === 8) return digits
  // Other international numbers: keep full digits (min 7, max 15 per E.164)
  if (digits.length >= 7 && digits.length <= 15) return digits
  return null
}

/** True if the raw input is a usable login phone number. */
export function isValidPhone(raw: unknown): boolean {
  return normalizePhone(raw) !== null
}

/** International display format (+222XXXXXXXX) for sending via providers. */
export function toInternationalFormat(normalizedOrRaw: string): string | null {
  const normalized = normalizePhone(normalizedOrRaw)
  if (!normalized) return null
  if (normalized.length === 8) return `+222${normalized}`
  if (normalized.startsWith("222")) return `+${normalized}`
  return `+${normalized}`
}

/** Masked display for UI (e.g. 46•• ••34) — never expose full numbers in logs. */
export function maskPhone(normalizedOrRaw: string | null | undefined): string {
  const normalized = typeof normalizedOrRaw === "string" ? normalizePhone(normalizedOrRaw) : null
  if (!normalized || normalized.length < 4) return "••••"
  return `${normalized.slice(0, 2)}•• ••${normalized.slice(-2)}`
}

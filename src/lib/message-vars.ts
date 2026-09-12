/**
 * Per-recipient message variables + SMS segment counting.
 * Pure + tested.
 *
 * Supported variables: {{studentName}} {{amount}} {{month}} {{dueDate}}
 * {{date}} {{schoolName}} {{receipt}} — unknown keys render as "".
 */

export type MessageVars = Record<string, string | number | null | undefined>

export function renderMessageVars(template: string, vars: MessageVars): string {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key]
    if (value === null || value === undefined) return ""
    return String(value)
  })
}

function isGsm7(text: string): boolean {
  return !/[^\x00-\x7F]/.test(text)
}

/** Number of SMS segments (GSM-7: 160/153, unicode incl. Arabic: 70/67). */
export function smsSegments(text: string): number {
  if (!text) return 0
  if (isGsm7(text)) {
    return text.length <= 160 ? 1 : Math.ceil(text.length / 153)
  }
  return text.length <= 70 ? 1 : Math.ceil(text.length / 67)
}

/** Arabic month label helper is in lib/finance (getMonthLabel). */
export function describeSegments(text: string): { segments: number; encoding: "GSM-7" | "Unicode" } {
  return { segments: smsSegments(text), encoding: isGsm7(text) ? "GSM-7" : "Unicode" }
}

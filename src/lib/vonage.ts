/**
 * Vonage SMS — DISABLED.
 * القرار: المزود المعتمد الوحيد الآن هو Wasender (واتساب).
 * هذا الملف مُبقى فقط لتفادي كسر الاستيرادات القديمة:
 * - isVonageConfigured() ترجع دائماً false
 * - sendVonageSMS() ترفض دائماً برسالة تعطيل
 * دوال التنسيق البحتة (formatVonagePhone/vonageMessageType) مُبقاة للاختبارات فقط.
 */

const VONAGE_API_KEY = process.env.VONAGE_API_KEY || ""
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || ""
const VONAGE_SENDER_ID = process.env.VONAGE_SENDER_ID || "ClassFlow"

export type VonageSendResult = {
  success: boolean
  messageId?: string
  error?: string
}

export function isVonageConfigured(): boolean {
  void VONAGE_API_KEY
  void VONAGE_API_SECRET
  void VONAGE_SENDER_ID
  return false
}

/** Vonage expects E.164 digits without the leading "+". */
export function formatVonagePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("222") && digits.length === 11) return digits
  if (digits.length === 8) return `222${digits}`
  if (digits.length >= 7 && digits.length <= 15) return digits
  return null
}

/** Arabic (or any non-ASCII) content must be sent as unicode (70 chars/segment). */
export function vonageMessageType(text: string): "text" | "unicode" {
  return /[^\x00-\x7F]/.test(text) ? "unicode" : "text"
}

export async function sendVonageSMS(to: string, text: string): Promise<VonageSendResult> {
  void to
  void text
  return { success: false, error: "Vonage معطل — المزود المعتمد الآن Wasender فقط" }
}

/** Balance check — DISABLED (كان يتحقق من رصيد Vonage). */
export async function getVonageBalance(): Promise<{ ok: boolean; balance?: number; error?: string }> {
  return { ok: false, error: "Vonage معطل — المزود المعتمد الآن Wasender فقط" }
}

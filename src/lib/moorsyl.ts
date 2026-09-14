/**
 * MoorSyl SMS — DISABLED.
 * القرار: المزود المعتمد الوحيد الآن هو Wasender (واتساب).
 * هذا الملف مُبقى فقط لتفادي كسر الاستيرادات القديمة:
 * - isMoorsylConfigured() ترجع دائماً false
 * - sendMoorsylSMS() ترفض دائماً برسالة تعطيل
 * الدوال البحتة (formatMauritanianPhone/buildAbsenceSMS) مُبقاة لأنها
 * تُستخدم لبناء النصوص فقط ولا تُرسل شيئاً.
 */

const MOORSYL_API_URL = process.env.MOORSYL_API_URL || "https://api.moorsyl.com/api/sms"
const MOORSYL_API_KEY = process.env.MOORSYL_API_KEY || ""
const MOORSYL_SENDER_ID = process.env.MOORSYL_SENDER_ID || "ClassFlow"

export type MoorsylSendResult = {
  success: boolean
  messageId?: string
  error?: string
}

export function isMoorsylConfigured(): boolean {
  void MOORSYL_API_URL
  void MOORSYL_API_KEY
  void MOORSYL_SENDER_ID
  return false
}

export function formatMauritanianPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "")
  if (!cleaned) return null
  if (cleaned.startsWith("+222") && cleaned.length === 12) return cleaned
  if (cleaned.startsWith("222") && cleaned.length === 11) return `+${cleaned}`
  if (/^\d{8}$/.test(cleaned)) return `+222${cleaned}`
  if (cleaned.startsWith("+") && cleaned.length >= 10) return cleaned
  return null
}

export async function sendMoorsylSMS(to: string, body: string): Promise<MoorsylSendResult> {
  void to
  void body
  return { success: false, error: "MoorSyl معطل — المزود المعتمد الآن Wasender فقط" }
}

export function buildAbsenceSMS(params: {
  studentName: string
  classroomName: string
  dateLabel: string
  schoolName?: string
}): string {
  const school = params.schoolName ? ` - ${params.schoolName}` : ""
  return `غياب: ${params.studentName} (${params.classroomName}) غائب يوم ${params.dateLabel}${school}. يرجى التواصل مع الإدارة.`
}

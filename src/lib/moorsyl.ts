/**
 * MoorSyl SMS service for ClassFlow
 * Mauritanian SMS provider — used for critical absence notifications
 * Docs: https://docs.moorsyl.com
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
  return Boolean(MOORSYL_API_KEY)
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
  if (!isMoorsylConfigured()) {
    return { success: false, error: "MoorSyl غير مُعد — أضف MOORSYL_API_KEY في .env" }
  }

  const formatted = formatMauritanianPhone(to)
  if (!formatted) {
    return { success: false, error: `رقم الهاتف غير صالح: ${to}` }
  }

  if (!body.trim()) {
    return { success: false, error: "نص الرسالة فارغ" }
  }

  try {
    const res = await fetch(MOORSYL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MOORSYL_API_KEY,
      },
      body: JSON.stringify({
        to: formatted,
        from: MOORSYL_SENDER_ID,
        body: body.trim(),
      }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      accepted?: boolean
      messageId?: string
      error?: string
      message?: string
    }

    if (!res.ok) {
      return { success: false, error: data.error || data.message || `HTTP ${res.status}` }
    }

    if (data.accepted === true || data.messageId) {
      return { success: true, messageId: data.messageId }
    }

    return { success: false, error: data.error || "فشل الإرسال — استجابة غير متوقعة" }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `خطأ شبكة: ${message}` }
  }
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

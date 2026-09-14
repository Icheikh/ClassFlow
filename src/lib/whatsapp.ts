/**
 * WhatsApp messaging service for ClassFlow — Wasender ONLY.
 *
 * القرار: المزود المعتمد الوحيد هو WasenderAPI (بوابة QR session).
 * كل المزودين الآخرين (Meta/UltraMsg/WATI/generic) و SMS (Vonage/MoorSyl) معطلون.
 * الإعداد: WHATSAPP_PROVIDER="wasender" + WASENDER_API_KEY في .env
 */

const PROVIDER = process.env.WHATSAPP_PROVIDER || "disabled"

// WasenderAPI configuration (المزود المعتمد الوحيد — QR-session gateway)
// Docs: https://wasenderapi.com/api-docs/messages/send-text-message
// Endpoint: POST {WASENDER_API_URL} with `Authorization: Bearer {WASENDER_API_KEY}`
// Body: { "to": "222XXXXXXXX", "text": "..." }
const WASENDER_API_URL = process.env.WASENDER_API_URL || "https://www.wasenderapi.com/api/send-message"
const WASENDER_API_KEY = process.env.WASENDER_API_KEY || ""

export type WhatsAppConnectionStatus = "DISCONNECTED" | "CONNECTED" | "CONNECTING" | "QR_REQUIRED"

export type WhatsAppSendResult = {
  success: boolean
  messageId?: string
  error?: string
}

export function formatPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "")
  if (!cleaned) return null
  if (cleaned.startsWith("+")) return cleaned
  if (cleaned.startsWith("222")) return `+${cleaned}`
  if (cleaned.length === 8) return `+222${cleaned}`
  return cleaned
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppSendResult> {
  if (PROVIDER !== "wasender") {
    return { success: false, error: "المزود المعتمد الوحيد هو Wasender — اضبط WHATSAPP_PROVIDER=wasender" }
  }
  const formatted = formatPhone(to)
  if (!formatted) {
    return { success: false, error: `رقم الهاتف غير صالح: ${to}` }
  }

  return sendViaWasender(formatted, message)
}

export function isWhatsAppConfigured(): boolean {
  return PROVIDER === "wasender" && !!WASENDER_API_KEY
}

export function getWhatsAppConnectionStatus(): WhatsAppConnectionStatus {
  return "DISCONNECTED"
}

export function getWhatsAppQR(): string | null {
  return null
}

async function sendViaWasender(to: string, message: string): Promise<WhatsAppSendResult> {
  if (!WASENDER_API_KEY) {
    return { success: false, error: "Wasender غير مُعد — أضف WASENDER_API_KEY في .env" }
  }
  if (!message.trim()) {
    return { success: false, error: "نص الرسالة فارغ" }
  }
  // Wasender accepts E.164 digits; send without "+" to match docs ("222XXXXXXXX").
  const recipient = to.replace("+", "").replace(/[\s\-\(\)]/g, "")

  try {
    const res = await fetch(WASENDER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WASENDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: recipient, text: message }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      message?: string
      retry_after?: number
      data?: { msgId?: number | string; jid?: string; status?: string }
    }

    if (res.ok && data.success === true) {
      const messageId = data.data?.msgId != null
        ? String(data.data.msgId)
        : data.data?.jid || undefined
      return { success: true, messageId }
    }

    // Surface rate-limit / session errors clearly so the queue can back off.
    // Trial: "You can only send 1 message every 1 minute." + retry_after: 60
    const errorMsg =
      data.message ||
      (res.status === 429
        ? `حد الإرسال (429)${data.retry_after ? ` — أعد المحاولة بعد ${data.retry_after} ثانية` : ""}`
        : `HTTP ${res.status}`)
    return { success: false, error: `Wasender: ${errorMsg}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `خطأ شبكة (Wasender): ${msg}` }
  }
}

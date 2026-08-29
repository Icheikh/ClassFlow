/**
 * WhatsApp messaging service for ClassFlow — DISABLED by default
 *
 * Decision (2026-08-29): WhatsApp bulk disabled. Use MoorSyl SMS for absences
 * and in-app notifications for everything else. This file is kept as a stub
 * for future re-enablement (set WHATSAPP_PROVIDER to ultramsg/wati/generic).
 *
 * No baileys import here — it breaks Vercel builds (native deps + preinstall).
 */

const PROVIDER = process.env.WHATSAPP_PROVIDER || "disabled"
const API_URL = process.env.WHATSAPP_API_URL || ""
const API_TOKEN = process.env.WHATSAPP_API_TOKEN || ""
const INSTANCE_ID = process.env.WHATSAPP_INSTANCE_ID || ""

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
  if (PROVIDER === "disabled") {
    return { success: false, error: "WhatsApp معطل — يتم استخدام SMS والإشعارات الداخلية حالياً" }
  }
  const formatted = formatPhone(to)
  if (!formatted) {
    return { success: false, error: `رقم الهاتف غير صالح: ${to}` }
  }

  switch (PROVIDER) {
    case "ultramsg":
      return sendViaUltraMsg(formatted, message)
    case "wati":
      return sendViaWATI(formatted, message)
    case "generic":
      return sendViaGeneric(formatted, message)
    default:
      return { success: false, error: `مزود WhatsApp غير معروف: ${PROVIDER}` }
  }
}

export function isWhatsAppConfigured(): boolean {
  if (PROVIDER === "disabled") return false
  return !!(API_URL && API_TOKEN)
}

export function getWhatsAppConnectionStatus(): WhatsAppConnectionStatus {
  return "DISCONNECTED"
}

export function getWhatsAppQR(): string | null {
  return null
}

async function sendViaUltraMsg(to: string, message: string): Promise<WhatsAppSendResult> {
  const url = `${API_URL}/api/messages/chat`
  const body = new URLSearchParams({
    token: API_TOKEN,
    instance: INSTANCE_ID,
    to,
    body: message,
  })

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const data = await res.json()
  if (data.sent === true || data.id) {
    return { success: true, messageId: data.id }
  }
  return { success: false, error: data.error || JSON.stringify(data) }
}

async function sendViaWATI(to: string, message: string): Promise<WhatsAppSendResult> {
  const url = `${API_URL}/api/v1/sendSessionMessage/${to}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  })

  const data = await res.json()
  if (res.ok && data.result) {
    return { success: true, messageId: data.messageId }
  }
  return { success: false, error: data.info || data.message || "WATI send failed" }
}

async function sendViaGeneric(to: string, message: string): Promise<WhatsAppSendResult> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: to, message, body: message, to }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
  }

  const data = await res.json().catch(() => ({}))
  if (data.success === false) {
    return { success: false, error: data.error || "Send failed" }
  }
  return { success: true, messageId: data.messageId || data.id }
}

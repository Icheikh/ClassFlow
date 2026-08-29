/**
 * WhatsApp messaging service for ClassFlow
 *
 * Supports multiple providers via WHATSAPP_PROVIDER env var:
 *   - "ultramsg"  → UltraMsg API (popular in Africa/Middle East)
 *   - "wati"      → WATI WhatsApp Business API
 *   - "generic"   → Generic HTTP POST (任何 REST API)
 *
 * Required env vars:
 *   WHATSAPP_API_URL      — Base URL of the API
 *   WHATSAPP_API_TOKEN    — Auth token / API key
 *   WHATSAPP_INSTANCE_ID  — Instance ID (UltraMsg specific)
 *   WHATSAPP_PROVIDER     — Provider key (default: "generic")
 */

const PROVIDER = process.env.WHATSAPP_PROVIDER || "generic"
const API_URL = process.env.WHATSAPP_API_URL || ""
const API_TOKEN = process.env.WHATSAPP_API_TOKEN || ""
const INSTANCE_ID = process.env.WHATSAPP_INSTANCE_ID || ""

export type WhatsAppSendResult = {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Format a Mauritanian phone number to international format.
 * Accepts: "22243062814", "+22243062814", "43062814"
 * Returns: "+22243062814" or null if invalid
 */
export function formatPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, "")
  if (cleaned.startsWith("+222")) return cleaned
  if (cleaned.startsWith("222")) return `+${cleaned}`
  if (cleaned.length === 8) return `+222${cleaned}`
  return null
}

/**
 * Send a WhatsApp message to a single phone number.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppSendResult> {
  const formatted = formatPhone(to)
  if (!formatted) {
    return { success: false, error: `رقم الهاتف غير صالح: ${to}` }
  }

  if (!API_URL || !API_TOKEN) {
    console.warn("[whatsapp] API not configured — skipping send")
    return { success: false, error: "WHATSAPP_API_NOT_CONFIGURED" }
  }

  try {
    if (PROVIDER === "ultramsg") {
      return await sendViaUltraMsg(formatted, message)
    }
    if (PROVIDER === "wati") {
      return await sendViaWATI(formatted, message)
    }
    return await sendViaGeneric(formatted, message)
  } catch (error: any) {
    console.error("[whatsapp] send failed:", error?.message)
    return { success: false, error: error?.message || "SEND_FAILED" }
  }
}

/**
 * Send a WhatsApp message via UltraMsg API.
 * Docs: https://ultramsg.com/api
 */
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

/**
 * Send a WhatsApp message via WATI API.
 * Docs: https://docs.wati.io/
 */
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

/**
 * Send a WhatsApp message via a generic REST API.
 * Expects: POST to WHATSAPP_API_URL with JSON body { phone, message }
 * Or form-urlencoded with phone + body fields.
 * Response: { success: boolean, messageId?: string, error?: string }
 */
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

/**
 * Check if WhatsApp is configured.
 */
export function isWhatsAppConfigured(): boolean {
  return !!(API_URL && API_TOKEN)
}

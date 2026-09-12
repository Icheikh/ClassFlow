/**
 * Vonage SMS service for ClassFlow — PRIMARY messaging channel.
 * Used for OTP codes (activation / password reset) and account invites.
 *
 * Docs: https://developer.vonage.com/en/api/sms
 * Credentials live in .env (server-only): VONAGE_API_KEY / VONAGE_API_SECRET.
 * Sender ID (VONAGE_SENDER_ID, up to 11 Latin chars) may be replaced by
 * Mauritanian carriers with a short code — verify on real handsets.
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
  return Boolean(VONAGE_API_KEY && VONAGE_API_SECRET)
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

type VonageSmsResponse = {
  "message-count"?: string
  messages?: { status?: string; "message-id"?: string; error?: string; "error-text"?: string }[]
}

export async function sendVonageSMS(to: string, text: string): Promise<VonageSendResult> {
  if (!isVonageConfigured()) {
    return { success: false, error: "Vonage غير مُعد — أضف VONAGE_API_KEY/SECRET في .env" }
  }

  const formatted = formatVonagePhone(to)
  if (!formatted) {
    return { success: false, error: `رقم الهاتف غير صالح: ${to}` }
  }
  if (!text.trim()) {
    return { success: false, error: "نص الرسالة فارغ" }
  }

  try {
    const payload: Record<string, unknown> = {
      to: formatted,
      from: VONAGE_SENDER_ID,
      text: text.trim(),
      type: vonageMessageType(text),
    }
    // Per-message DLR callback (needs a PUBLIC https URL — Vonage can't reach localhost).
    if (process.env.VONAGE_DLR_CALLBACK) {
      payload.callback = process.env.VONAGE_DLR_CALLBACK
    }
    const res = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${VONAGE_API_KEY}:${VONAGE_API_SECRET}`).toString("base64")}`,
      },
      body: JSON.stringify(payload),
    })

    const data = (await res.json().catch(() => ({}))) as VonageSmsResponse
    const first = data.messages?.[0]
    if (first?.status === "0") {
      return { success: true, messageId: first["message-id"] }
    }
    return {
      success: false,
      error: first?.["error-text"] || first?.error || `Vonage status ${first?.status ?? res.status}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `خطأ شبكة: ${message}` }
  }
}

/** Balance check (EUR) — validates credentials without spending on an SMS. */
export async function getVonageBalance(): Promise<{ ok: boolean; balance?: number; error?: string }> {
  if (!isVonageConfigured()) return { ok: false, error: "Vonage غير مُعد" }
  try {
    const res = await fetch(
      `https://rest.nexmo.com/account/get-balance?api_key=${VONAGE_API_KEY}&api_secret=${VONAGE_API_SECRET}`
    )
    const data = (await res.json().catch(() => ({}))) as { value?: number; error?: string }
    if (typeof data.value === "number") return { ok: true, balance: data.value }
    return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `خطأ شبكة: ${message}` }
  }
}

/**
 * WhatsApp messaging service for ClassFlow
 *
 * Provider hierarchy (configured via WHATSAPP_PROVIDER env var):
 *   1. "baileys"  → Free, direct WhatsApp Web protocol (default)
 *   2. "ultramsg" → UltraMsg API (paid, popular in Africa)
 *   3. "wati"     → WATI WhatsApp Business API (paid)
 *   4. "generic"  → Generic HTTP POST (any REST API)
 *
 * For production/scale: use "ultramsg" or "wati"
 * For launch/MVP: use "baileys" (free, no subscription)
 */

import {
  sendMessage as baileysSend,
  getWhatsAppStatus,
  getLatestQR,
  formatPhone as baileysFormatPhone,
} from "./whatsapp/session"

export type { WhatsAppConnectionStatus } from "./whatsapp/session"

const PROVIDER = process.env.WHATSAPP_PROVIDER || "baileys"
const API_URL = process.env.WHATSAPP_API_URL || ""
const API_TOKEN = process.env.WHATSAPP_API_TOKEN || ""
const INSTANCE_ID = process.env.WHATSAPP_INSTANCE_ID || ""

export type WhatsAppSendResult = {
  success: boolean
  messageId?: string
  error?: string
}

export function formatPhone(phone: string): string | null {
  return baileysFormatPhone(phone)
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppSendResult> {
  const formatted = formatPhone(to)
  if (!formatted) {
    return { success: false, error: `رقم الهاتف غير صالح: ${to}` }
  }

  switch (PROVIDER) {
    case "baileys":
      return sendViaBaileys(formatted, message)
    case "ultramsg":
      return sendViaUltraMsg(formatted, message)
    case "wati":
      return sendViaWATI(formatted, message)
    default:
      return sendViaGeneric(formatted, message)
  }
}

export function isWhatsAppConfigured(): boolean {
  if (PROVIDER === "baileys") {
    return true
  }
  return !!(API_URL && API_TOKEN)
}

export function getWhatsAppConnectionStatus() {
  return getWhatsAppStatus()
}

export function getWhatsAppQR() {
  return getLatestQR()
}

async function sendViaBaileys(phone: string, message: string): Promise<WhatsAppSendResult> {
  const status = getWhatsAppStatus()
  if (status !== "CONNECTED") {
    return { success: false, error: "WhatsApp غير متصل — امسح QR أولاً من إعدادات WhatsApp" }
  }
  return baileysSend(phone, message)
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

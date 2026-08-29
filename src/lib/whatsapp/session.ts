import path from "path"
import fs from "fs"

export type WhatsAppConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "QR_REQUIRED"

type QRCallback = (qr: string) => void
type StatusCallback = (status: WhatsAppConnectionStatus) => void

const SESSION_DIR = path.join(process.cwd(), "whatsapp-sessions")

let sock: any = null
let currentStatus: WhatsAppConnectionStatus = "DISCONNECTED"
let latestQR: string | null = null
let qrCallbacks: QRCallback[] = []
let statusCallbacks: StatusCallback[] = []
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true })
  }
}

export function getWhatsAppStatus(): WhatsAppConnectionStatus {
  return currentStatus
}

export function getLatestQR(): string | null {
  return latestQR
}

export function onQR(cb: QRCallback): () => void {
  qrCallbacks.push(cb)
  return () => {
    qrCallbacks = qrCallbacks.filter((fn) => fn !== cb)
  }
}

export function onStatusChange(cb: StatusCallback): () => void {
  statusCallbacks.push(cb)
  return () => {
    statusCallbacks = statusCallbacks.filter((fn) => fn !== cb)
  }
}

function emitQR(qr: string) {
  latestQR = qr
  qrCallbacks.forEach((cb) => cb(qr))
}

function emitStatus(status: WhatsAppConnectionStatus) {
  currentStatus = status
  statusCallbacks.forEach((cb) => cb(status))
}

export async function startWhatsApp(): Promise<any> {
  if (sock) return sock

  let makeWASocket: any, DisconnectReason: any, useMultiFileAuthState: any
  try {
    const baileys = await import("@whiskeysockets/baileys")
    makeWASocket = baileys.default
    DisconnectReason = baileys.DisconnectReason
    useMultiFileAuthState = baileys.useMultiFileAuthState
  } catch {
    throw new Error("مكتبة Baileys غير مثبتة. ثبّتها يدوياً: npm install @whiskeysockets/baileys @hapi/boom")
  }

  ensureSessionDir()
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["ClassFlow", "Chrome", "4.0.0"],
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", (update: any) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      emitQR(qr)
      emitStatus("QR_REQUIRED")
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      console.log("[whatsapp] connection closed:", statusCode, "reconnect:", shouldReconnect)

      sock = null
      emitStatus("DISCONNECTED")

      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => {
          startWhatsApp().catch(console.error)
        }, 3000)
      }
    }

    if (connection === "open") {
      latestQR = null
      emitStatus("CONNECTED")
      console.log("[whatsapp] connected successfully")
    }

    if (connection === "connecting") {
      emitStatus("CONNECTING")
    }
  })

  return sock
}

export function getSocket(): any | null {
  return sock
}

export async function stopWhatsApp(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (sock) {
    sock.end(undefined)
    sock = null
  }
  emitStatus("DISCONNECTED")
  latestQR = null
}

export async function logoutWhatsApp(): Promise<void> {
  await stopWhatsApp()
  ensureSessionDir()
  const files = fs.readdirSync(SESSION_DIR)
  for (const file of files) {
    fs.unlinkSync(path.join(SESSION_DIR, file))
  }
}

export async function sendMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const s = sock
  if (!s || currentStatus !== "CONNECTED") {
    return { success: false, error: "WhatsApp غير متصل" }
  }

  const formatted = formatPhone(phone)
  if (!formatted) {
    return { success: false, error: `رقم الهاتف غير صالح: ${phone}` }
  }

  const jid = `${formatted}@s.whatsapp.net`

  try {
    const result = await s.sendMessage(jid, { text: message })
    return { success: true, messageId: result?.key?.id || undefined }
  } catch (error: any) {
    console.error("[whatsapp] send failed:", error?.message)
    return { success: false, error: error?.message || "فشل الإرسال" }
  }
}

export function formatPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, "")
  if (cleaned.startsWith("+222")) return cleaned.slice(1)
  if (cleaned.startsWith("222")) return cleaned
  if (cleaned.length === 8) return `222${cleaned}`
  if (cleaned.startsWith("+")) return cleaned.slice(1)
  return null
}

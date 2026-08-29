import path from "path"
import fs from "fs"

export type WhatsAppConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "QR_REQUIRED"

type QRCallback = (qr: string) => void
type StatusCallback = (status: WhatsAppConnectionStatus) => void

const SESSION_DIR = path.join(process.cwd(), "whatsapp-sessions")

let currentStatus: WhatsAppConnectionStatus = "DISCONNECTED"
let latestQR: string | null = null
let qrCallbacks: QRCallback[] = []
let statusCallbacks: StatusCallback[] = []

function emitQR(qr: string) {
  latestQR = qr
  qrCallbacks.forEach((cb) => cb(qr))
}

function emitStatus(status: WhatsAppConnectionStatus) {
  currentStatus = status
  statusCallbacks.forEach((cb) => cb(status))
}

export function getWhatsAppStatus(): WhatsAppConnectionStatus {
  return currentStatus
}

export function getLatestQR(): string | null {
  return latestQR
}

export function onQR(cb: QRCallback): () => void {
  qrCallbacks.push(cb)
  return () => { qrCallbacks = qrCallbacks.filter((fn) => fn !== cb) }
}

export function onStatusChange(cb: StatusCallback): () => void {
  statusCallbacks.push(cb)
  return () => { statusCallbacks = statusCallbacks.filter((fn) => fn !== cb) }
}

async function loadBaileys(): Promise<any> {
  const pkg = ["@", "whiskeysockets", "/", "baileys"].join("")
  const boom = ["@", "hapi", "/", "boom"].join("")
  const mod = await new Function(`return import(${JSON.stringify(pkg)})`)()
  return { ...mod, Boom: (await new Function(`return import(${JSON.stringify(boom)})`)()).Boom }
}

export async function startWhatsApp(): Promise<any> {
  let baileys: any
  try {
    baileys = await loadBaileys()
  } catch {
    throw new Error("Baileys غير مثبت. ثبّته يدوياً: npm install @whiskeysockets/baileys @hapi/boom")
  }

  const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = baileys

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  const sock = makeWASocket({
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
      const shouldReconnect = statusCode !== (baileys.DisconnectReason?.loggedOut ?? 401)
      console.log("[whatsapp] connection closed:", statusCode, "reconnect:", shouldReconnect)
      emitStatus("DISCONNECTED")
      if (shouldReconnect) {
        setTimeout(() => { startWhatsApp().catch(console.error) }, 3000)
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
  return null
}

export async function stopWhatsApp(): Promise<void> {
  emitStatus("DISCONNECTED")
  latestQR = null
}

export async function logoutWhatsApp(): Promise<void> {
  await stopWhatsApp()
  if (fs.existsSync(SESSION_DIR)) {
    const files = fs.readdirSync(SESSION_DIR)
    for (const file of files) {
      fs.unlinkSync(path.join(SESSION_DIR, file))
    }
  }
}

export async function sendMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return { success: false, error: "WhatsApp Baileys غير متصل" }
}

export function formatPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, "")
  if (cleaned.startsWith("+222")) return cleaned.slice(1)
  if (cleaned.startsWith("222")) return cleaned
  if (cleaned.length === 8) return `222${cleaned}`
  if (cleaned.startsWith("+")) return cleaned.slice(1)
  return null
}

/**
 * OTP engine for phone-based authentication.
 *
 * Purposes:
 * - ACTIVATION: first-time account activation (INVITED users)
 * - RESET: password recovery (ACTIVE users)
 *
 * Channel priority: WhatsApp → MoorSyl SMS → dev fallback (console log).
 * Codes are stored hashed (sha256), expire after 10 minutes, max 5 attempts.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { prisma } from "./prisma"
import { sendWhatsAppMessage } from "./whatsapp"
import { sendVonageSMS, isVonageConfigured } from "./vonage"
import { sendMoorsylSMS, isMoorsylConfigured } from "./moorsyl"
import { toInternationalFormat, maskPhone } from "./phone"

export const OTP_TTL_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5

export type OtpPurpose = "ACTIVATION" | "RESET"

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000))
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Create (and store hashed) a fresh OTP, invalidating previous ones for the same phone+purpose. */
async function issueOtp(input: {
  phoneNormalized: string
  phone?: string | null
  purpose: OtpPurpose
  schoolId?: string | null
}): Promise<{ code: string; expiresAt: Date }> {
  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  await prisma.otpCode.updateMany({
    where: { phoneNormalized: input.phoneNormalized, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  await prisma.otpCode.create({
    data: {
      phoneNormalized: input.phoneNormalized,
      phone: input.phone || null,
      schoolId: input.schoolId || null,
      purpose: input.purpose,
      codeHash: hashOtp(code),
      expiresAt,
    },
  })
  return { code, expiresAt }
}

/**
 * Issue an OTP and deliver it. Returns delivery status.
 * `devCode` is only set when no real provider is configured AND not in production
 * (lets schools onboard/test without paying for SMS).
 */
export async function requestOtpAndSend(input: {
  phoneNormalized: string
  phone?: string | null
  purpose: OtpPurpose
  schoolId?: string | null
  schoolName?: string | null
  userName?: string | null
  locale?: string
}): Promise<{
  sent: boolean
  channel: string
  expiresAt: Date
  devCode?: string
  error?: string
}> {
  const { code, expiresAt } = await issueOtp(input)

  const isFr = input.locale === "fr"
  const school = input.schoolName ? (isFr ? ` à ${input.schoolName}` : ` في ${input.schoolName}`) : ""
  const message =
    input.purpose === "RESET"
      ? isFr
        ? `ClassFlow${school} : votre code de réinitialisation est ${code}. Valable ${OTP_TTL_MINUTES} minutes.`
        : `رمز استعادة كلمة المرور في ClassFlow${school}: ${code}. صالح لمدة ${OTP_TTL_MINUTES} دقائق.`
      : isFr
        ? `Bienvenue sur ClassFlow${school} : votre code d'activation est ${code}. Valable ${OTP_TTL_MINUTES} minutes.`
        : `مرحباً ${input.userName || ""}، رمز تفعيل حسابك في ClassFlow${school}: ${code}. صالح لمدة ${OTP_TTL_MINUTES} دقائق.`

  const to = toInternationalFormat(input.phone || input.phoneNormalized) || input.phoneNormalized

  const wa = await sendWhatsAppMessage(to, message).catch((e) => ({
    success: false as const,
    error: e instanceof Error ? e.message : String(e),
  }))
  if (wa.success) return { sent: true, channel: "WHATSAPP", expiresAt }

  if (isVonageConfigured()) {
    const vonage = await sendVonageSMS(to, message).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    if (vonage.success) return { sent: true, channel: "VONAGE_SMS", expiresAt }
    console.error(`[otp] send failed to ${maskPhone(input.phoneNormalized)} via Vonage:`, vonage.error)
  }

  if (isMoorsylConfigured()) {
    const sms = await sendMoorsylSMS(to, message).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    if (sms.success) return { sent: true, channel: "SMS", expiresAt }
    console.error(`[otp] send failed to ${maskPhone(input.phoneNormalized)} via SMS:`, sms.error)
  }

  console.log(
    `[otp:${input.purpose}] to=${maskPhone(input.phoneNormalized)} code=${code} (no provider configured)`
  )
  const isDev = process.env.NODE_ENV !== "production"
  return {
    sent: false,
    channel: "DEV_LOG",
    expiresAt,
    ...(isDev ? { devCode: code } : {}),
    error: wa.error || "No messaging provider configured",
  }
}

export async function verifyOtp(input: {
  phoneNormalized: string
  code: string
  purpose: OtpPurpose
}): Promise<{ ok: boolean; reason?: string }> {
  const check = await checkOtp(input)
  if (!check.ok || !check.rowId) return { ok: false, reason: check.reason }
  await prisma.otpCode.update({ where: { id: check.rowId }, data: { consumedAt: new Date() } })
  return { ok: true }
}

/**
 * Non-consuming OTP check (counts attempts). Used by the verify endpoint so the
 * UI can display the stored account name before asking for a password —
 * the same code is then consumed by activate/reset.
 */
export async function checkOtp(input: {
  phoneNormalized: string
  code: string
  purpose: OtpPurpose
}): Promise<{ ok: boolean; reason?: string; rowId?: string }> {
  const row = await prisma.otpCode.findFirst({
    where: {
      phoneNormalized: input.phoneNormalized,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })
  if (!row) return { ok: false, reason: "EXPIRED_OR_NOT_FOUND" }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } })
    return { ok: false, reason: "TOO_MANY_ATTEMPTS" }
  }

  const clean = String(input.code || "").replace(/\D/g, "")
  if (!clean || !safeEqual(hashOtp(clean), row.codeHash)) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
    return { ok: false, reason: "INVALID_CODE" }
  }

  return { ok: true, rowId: row.id }
}

/**
 * Account invitation (School template): sent once when the director creates an account.
 * Fire-and-forget — account creation must never fail because messaging failed.
 */
export async function sendAccountInvite(input: {
  toPhone: string
  name: string
  schoolName: string
  role: string
  locale?: string
}): Promise<{ sent: boolean; channel: string; error?: string }> {
  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")
  const link = `${baseUrl}/auth/activate`
  const isFr = input.locale === "fr"
  const roleLabel =
    input.role === "TEACHER" ? (isFr ? "enseignant(e)" : "أستاذًا") : isFr ? "parent" : "ولي أمر"

  const message = isFr
    ? `Bonjour ${input.name}, vous avez été inscrit(e) comme ${roleLabel} à ${input.schoolName}. Activez votre compte ClassFlow ici : ${link}`
    : `مرحباً ${input.name}، تم تسجيلك ${roleLabel} في ${input.schoolName}. فعّل حسابك في ClassFlow عبر الرابط: ${link}`

  const to = toInternationalFormat(input.toPhone) || input.toPhone
  const wa = await sendWhatsAppMessage(to, message).catch((e) => ({
    success: false as const,
    error: e instanceof Error ? e.message : String(e),
  }))
  if (wa.success) return { sent: true, channel: "WHATSAPP" }

  if (isVonageConfigured()) {
    const vonage = await sendVonageSMS(to, message).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    if (vonage.success) return { sent: true, channel: "VONAGE_SMS" }
    return { sent: false, channel: "VONAGE_SMS", error: vonage.error }
  }

  if (isMoorsylConfigured()) {
    const sms = await sendMoorsylSMS(to, message).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    if (sms.success) return { sent: true, channel: "SMS" }
    return { sent: false, channel: "SMS", error: sms.error }
  }

  console.log(`[invite] to=${maskPhone(input.toPhone)} link=${link} (no provider configured)`)
  return { sent: false, channel: "DEV_LOG", error: wa.error || "No messaging provider configured" }
}

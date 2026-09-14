/**
 * OTP engine for phone-based authentication.
 *
 * Purposes:
 * - ACTIVATION: first-time account activation (INVITED users)
 * - RESET: password recovery (ACTIVE users)
 *
 * Channel priority: WhatsApp via Wasender ONLY → dev fallback (console log).
 * Codes are stored hashed (sha256), expire after 10 minutes, max 5 attempts.
 */
import { createHash, randomInt, timingSafeEqual, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { sendWhatsAppMessage } from "./whatsapp"
import { toInternationalFormat, maskPhone } from "./phone"

export const OTP_TTL_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5

export type OtpPurpose = "ACTIVATION" | "RESET"

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000))
}

/**
 * Generate a random temporary password (8 characters: uppercase + lowercase + digits).
 * The user must change it on first login.
 */
export function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let password = ""
  const bytes = randomBytes(8)
  for (let i = 0; i < 8; i++) {
    password += chars[bytes[i] % chars.length]
  }
  return password
}

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
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

  console.error(`[otp] send failed to ${maskPhone(input.phoneNormalized)} via Wasender:`, wa.error)

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
  studentName?: string
}): Promise<{ sent: boolean; channel: string; error?: string }> {
  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")
  const activateUrl = `${baseUrl}/auth/activate`
  const isFr = input.locale === "fr"

  let message: string

  if (input.role === "PARENT" && input.studentName) {
    // Parent invitation — includes student name
    message = isFr
      ? `Bonjour ${input.name} 👋\nVous êtes inscrit(e) comme parent de ${input.studentName} à ${input.schoolName} via ClassFlow.\n\nVous pouvez maintenant suivre les résultats, la présence, les annonces et les informations scolaires depuis la plateforme.\n\n🔐 Pour activer votre compte, cliquez sur le lien suivant :\n${activateUrl}\n\n— ${input.schoolName} via ClassFlow, système de gestion scolaire`
      : `مرحباً ${input.name} 👋\nتمت إضافتك كولي أمر للطالب ${input.studentName} في ${input.schoolName} عبر ClassFlow.\n\nيمكنك الآن متابعة الحضور، النتائج، الإعلانات والمعلومات المدرسية من خلال المنصة.\n\n🔐 لتفعيل حسابك، اضغط على الرابط التالي:\n${activateUrl}\n\n— ${input.schoolName} عبر ClassFlow نظام إدارة المدارس`
  } else {
    // Teacher / Staff invitation
    const roleLabel =
      input.role === "TEACHER" ? (isFr ? "enseignant(e)" : "أستاذًا") : (isFr ? "membre du personnel" : "موظفًا")
    message = isFr
      ? `Bonjour ${input.name} 👋\nVous êtes inscrit(e) comme ${roleLabel} à ${input.schoolName} via ClassFlow.\n\n🔐 Pour activer votre compte, cliquez sur le lien suivant :\n${activateUrl}\n\n— ${input.schoolName} via ClassFlow, système de gestion scolaire`
      : `مرحباً ${input.name} 👋\nتم تسجيلك ${roleLabel} في ${input.schoolName} عبر ClassFlow.\n\n🔐 لتفعيل حسابك، اضغط على الرابط التالي:\n${activateUrl}\n\n— ${input.schoolName} عبر ClassFlow نظام إدارة المدارس`
  }

  const to = toInternationalFormat(input.toPhone) || input.toPhone
  const wa = await sendWhatsAppMessage(to, message).catch((e) => ({
    success: false as const,
    error: e instanceof Error ? e.message : String(e),
  }))
  if (wa.success) return { sent: true, channel: "WHATSAPP" }

  console.log(`[invite] to=${maskPhone(input.toPhone)} link=${activateUrl} (wasender failed: ${wa.error})`)
  return { sent: false, channel: "WHATSAPP", error: wa.error || "No messaging provider configured" }
}

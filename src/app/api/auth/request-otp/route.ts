import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizePhone, maskPhone } from "@/lib/phone"
import { requestOtpAndSend, OtpPurpose } from "@/lib/otp"
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const GENERIC_SUCCESS = { success: true }

/**
 * Request an OTP for account activation (INVITED) or password reset (ACTIVE).
 * Always returns generic success to avoid revealing which numbers are registered.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const rawPhone = typeof body.phone === "string" ? body.phone : ""
  const purpose = body.purpose === "RESET" ? "RESET" : "ACTIVATION"
  const locale = body.locale === "fr" ? "fr" : "ar"

  const phoneNormalized = normalizePhone(rawPhone)
  if (!phoneNormalized) {
    return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })
  }

  const ip = getClientIp(req)
  const limit = checkRateLimit(`${ip}:${phoneNormalized}`, {
    namespace: `otp-${purpose.toLowerCase()}`,
    max: 5,
    windowSeconds: 300,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة. حاول بعد قليل." },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  const users = await prisma.user.findMany({
    where: { phoneNormalized },
    include: { school: { select: { id: true, name: true, isActive: true } } },
  })

  const eligible =
    purpose === "ACTIVATION"
      ? users.filter((u) => (u.status || "ACTIVE") === "INVITED" && u.isActive)
      : users.filter((u) => (u.status || "ACTIVE") === "ACTIVE" && u.isActive)

  if (eligible.length === 0) {
    // Anti-enumeration: same response, no message sent.
    console.log(`[otp] ${purpose} requested for unknown ${maskPhone(phoneNormalized)} — no message sent`)
    return NextResponse.json(GENERIC_SUCCESS)
  }

  const primary = eligible.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
  const result = await requestOtpAndSend({
    phoneNormalized,
    phone: primary.phone || rawPhone,
    purpose: purpose as OtpPurpose,
    schoolId: primary.schoolId,
    schoolName: primary.school?.name || null,
    userName: primary.name,
    locale,
  }).catch((e): { sent: boolean; channel: string; expiresAt: Date; devCode?: string; error?: string } => {
    console.error("[otp] request failed:", e)
    return { sent: false, channel: "ERROR", expiresAt: new Date(), error: "SEND_FAILED" }
  })

  return NextResponse.json({
    ...GENERIC_SUCCESS,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  })
}

import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/phone"
import { verifyOtp } from "@/lib/otp"
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/**
 * First-time activation: phone + OTP (purpose ACTIVATION) + new password.
 * Activates every INVITED account holding this phone number and sets its password.
 * The stored name from the school is kept — the user never re-enters it.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const phoneNormalized = normalizePhone(typeof body.phone === "string" ? body.phone : "")
  const code = typeof body.code === "string" ? body.code : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!phoneNormalized) {
    return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })
  }
  if (!code) {
    return NextResponse.json({ error: "رمز التحقق مطلوب" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "PasswordTooShort" }, { status: 400 })
  }

  const ip = getClientIp(req)
  const limit = checkRateLimit(`${ip}:${phoneNormalized}`, {
    namespace: "otp-activate",
    max: 10,
    windowSeconds: 300,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة. حاول بعد قليل." },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  const users = await prisma.user.findMany({ where: { phoneNormalized } })
  const invited = users.filter((u) => (u.status || "ACTIVE") === "INVITED" && u.isActive)
  if (invited.length === 0) {
    return NextResponse.json({ error: "NO_INVITED_ACCOUNT" }, { status: 400 })
  }

  const check = await verifyOtp({ phoneNormalized, code, purpose: "ACTIVATION" })
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.updateMany({
    where: { phoneNormalized, status: "INVITED" },
    data: { passwordHash, status: "ACTIVE", isActive: true, mustChangePassword: false },
  })

  return NextResponse.json({ success: true })
}

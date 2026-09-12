import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/phone"
import { checkOtp } from "@/lib/otp"
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Non-consuming OTP check — lets the UI display the stored account name
 * before asking for a password. The same code is consumed by activate/reset.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const phoneNormalized = normalizePhone(typeof body.phone === "string" ? body.phone : "")
  const code = typeof body.code === "string" ? body.code : ""
  const purpose = body.purpose === "RESET" ? "RESET" : "ACTIVATION"

  if (!phoneNormalized || !code) {
    return NextResponse.json({ error: "رقم الهاتف والرمز مطلوبان" }, { status: 400 })
  }

  const ip = getClientIp(req)
  const limit = checkRateLimit(`${ip}:${phoneNormalized}`, {
    namespace: "otp-verify",
    max: 10,
    windowSeconds: 300,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة. حاول بعد قليل." },
      { status: 429, headers: rateLimitHeaders(limit) }
    )
  }

  const check = await checkOtp({ phoneNormalized, code, purpose })
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

  const user = await prisma.user.findFirst({
    where: { phoneNormalized },
    select: { name: true, status: true },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ success: true, name: user?.name || null })
}

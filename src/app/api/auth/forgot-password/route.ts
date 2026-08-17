import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "node:crypto"
import { sendPasswordResetEmail, EmailLocale } from "@/lib/email"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { email, locale } = body
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "البريد الإلكتروني مطلوب" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })

  if (user && user.isActive) {
    const token = randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      locale: (locale === "fr" ? "fr" : "ar") as EmailLocale,
    }).catch((e) => console.error("[forgot-password] send failed:", e))
  }

  return NextResponse.json({ success: true })
}
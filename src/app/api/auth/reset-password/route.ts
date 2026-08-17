import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { token, password } = body

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "PasswordTooShort" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { resetToken: token } })
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
    return NextResponse.json({ error: "Token expired or invalid" }, { status: 400 })
  }

  const isSameAsCurrent = await bcrypt.compare(password, user.passwordHash)
  if (isSameAsCurrent) {
    return NextResponse.json({ error: "SameAsCurrent" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null, mustChangePassword: false },
  })

  return NextResponse.json({ success: true })
}
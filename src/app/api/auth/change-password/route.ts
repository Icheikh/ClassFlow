import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { currentPassword, newPassword } = body
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 })
  }

  if (dbUser.mustChangePassword) {
    const isDefault = await bcrypt.compare("password123", dbUser.passwordHash)
    const isParentDefault = await bcrypt.compare("parent123", dbUser.passwordHash)
    if (isDefault || isParentDefault) {
      const isNewDifferent = !(await bcrypt.compare(newPassword, dbUser.passwordHash))
      if (!isNewDifferent) {
        return NextResponse.json({ error: "يجب أن تختلف كلمة المرور الجديدة عن الحالية" }, { status: 400 })
      }
    }
  } else {
    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ error: "كلمة المرور الحالية مطلوبة" }, { status: 400 })
    }
    const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 })
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  })

  return NextResponse.json({ success: true })
}
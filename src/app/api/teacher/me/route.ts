import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const teacher = await prisma.teacher.findUnique({
    where: { userId: user.id },
    select: { id: true, userId: true },
  })
  if (!teacher) return NextResponse.json({ error: "الأستاذ غير موجود" }, { status: 404 })

  return NextResponse.json(teacher)
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const teachers = await prisma.teacher.findMany({
    where: { schoolId: user.schoolId },
    include: {
      user: { select: { id: true, email: true, name: true, phone: true, isActive: true } },
      teacherAssignments: {
        include: { subject: true, classroom: { include: { level: true } } },
        where: { academicYear: { isActive: true } },
      },
    },
    orderBy: { user: { name: "asc" } },
  })
  return NextResponse.json(teachers)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { email, name, phone, password, hourlyRate } = body
  if (!email || !name) return NextResponse.json({ error: "البريد الإلكتروني والاسم مطلوبان" }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: "البريد الإلكتروني موجود مسبقاً" }, { status: 400 })

  const passwordHash = await bcrypt.hash(password || "password123", 10)
  const appUser = await prisma.user.create({
    data: { email, passwordHash, name, phone, role: "TEACHER", schoolId: user.schoolId },
  })
  const teacher = await prisma.teacher.create({
    data: { schoolId: user.schoolId, userId: appUser.id, phone, hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined },
    include: {
      user: { select: { id: true, email: true, name: true, phone: true, isActive: true } },
    },
  })
  return NextResponse.json(teacher)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id, name, phone, isActive, hourlyRate } = body

  const teacher = await prisma.teacher.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  await prisma.user.update({
    where: { id: teacher.userId },
    data: { name, phone, isActive: isActive !== undefined ? isActive : undefined },
  })
  await prisma.teacher.update({
    where: { id },
    data: { phone: phone || undefined, hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : undefined },
  })

  const updated = await prisma.teacher.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, phone: true, isActive: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const teacher = await prisma.teacher.findFirst({ where: { id } })
    if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    await prisma.user.update({ where: { id: teacher.userId }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "فشل الحذف" }, { status: 400 })
  }
}
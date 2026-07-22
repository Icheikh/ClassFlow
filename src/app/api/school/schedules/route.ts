import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classroomId = searchParams.get("classroomId")
  const teacherId = searchParams.get("teacherId")

  const where: any = { schoolId: user.schoolId }
  if (classroomId) where.classroomId = classroomId
  if (teacherId) where.teacherId = teacherId

  const items = await prisma.schedule.findMany({
    where,
    include: {
      classroom: { select: { id: true, name: true, level: { select: { name: true } } } },
      subject: { select: { id: true, nameAr: true, nameFr: true } },
      teacher: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_CLASSROOMS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, dayOfWeek, startTime, endTime, classroomId, subjectId, teacherId } = body

  if (id) {
    const existing = await prisma.schedule.findFirst({ where: { id, schoolId: user.schoolId } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
    const updated = await prisma.schedule.update({
      where: { id },
      data: { dayOfWeek, startTime, endTime, classroomId, subjectId, teacherId: teacherId || null },
    })
    return NextResponse.json(updated)
  }

  const item = await prisma.schedule.create({
    data: { schoolId: user.schoolId, dayOfWeek, startTime, endTime, classroomId, subjectId, teacherId: teacherId || null },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_CLASSROOMS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 })

  const existing = await prisma.schedule.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  await prisma.schedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

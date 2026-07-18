import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.teacherAssignment.findMany({
    where: { schoolId: user.schoolId, academicYear: { isActive: true } },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      subject: true,
      classroom: { include: { level: true } },
      academicYear: true,
    },
    orderBy: [{ classroom: { name: "asc" } }, { subject: { nameAr: "asc" } }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_TEACHERS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { teacherId, subjectId, classroomId, hourlyRate, weeklyHours } = body

  const year = await prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isActive: true } })
  if (!year) return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })

  const existing = await prisma.teacherAssignment.findFirst({
    where: { teacherId, subjectId, classroomId, academicYearId: year.id },
  })
  if (existing) return NextResponse.json({ error: "هذا التكليف موجود مسبقاً" }, { status: 400 })

  const item = await prisma.teacherAssignment.create({
    data: {
      schoolId: user.schoolId, teacherId, subjectId, classroomId, academicYearId: year.id,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      weeklyHours: weeklyHours ? parseFloat(weeklyHours) : undefined,
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      subject: true,
      classroom: { include: { level: true } },
    },
  })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_TEACHERS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, hourlyRate, weeklyHours } = body

  const existing = await prisma.teacherAssignment.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const item = await prisma.teacherAssignment.update({
    where: { id },
    data: {
      hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : undefined,
      weeklyHours: weeklyHours !== undefined ? parseFloat(weeklyHours) : undefined,
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      subject: true,
      classroom: { include: { level: true } },
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
    if (!hasPermission(user, PERMISSIONS.MANAGE_TEACHERS) && !isLegacyRole)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const existing = await prisma.teacherAssignment.findFirst({ where: { id, schoolId: user.schoolId } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const entryCount = await prisma.teachingHourEntry.count({
      where: { teacherAssignmentId: id },
    })
    if (entryCount > 0) {
      return NextResponse.json({
        error: `لا يمكن حذف التكليف لأنه مرتبط بـ ${entryCount} سجل ساعات تدريس. قم بحذف ساعات التدريس أولاً.`,
      }, { status: 400 })
    }

    await prisma.teacherAssignment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.code === "P2003"
      ? "لا يمكن حذف التكليف لأنه مرتبط ببيانات أخرى"
      : e.message || "فشل الحذف"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const academicYearId = url.searchParams.get("academicYearId")
  const status = url.searchParams.get("status")

  const where: any = { schoolId: user.schoolId }
  if (classroomId) where.classroomId = classroomId
  if (academicYearId) where.academicYearId = academicYearId
  if (status) where.status = status

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      student: true,
      classroom: { include: { level: true, stream: true } },
      academicYear: true,
    },
    orderBy: { enrolledAt: "desc" },
  })
  return NextResponse.json(enrollments)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { studentId, classroomId, academicYearId } = body
  if (!studentId || !classroomId || !academicYearId)
    return NextResponse.json({ error: "الطالب والقسم والسنة الدراسية مطلوبة" }, { status: 400 })

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_academicYearId: { studentId, academicYearId } },
  })
  if (existing) return NextResponse.json({ error: "الطالب مسجل بالفعل في هذه السنة الدراسية" }, { status: 400 })

  const enrollment = await prisma.enrollment.create({
    data: { schoolId: user.schoolId, studentId, classroomId, academicYearId },
    include: {
      student: true,
      classroom: { include: { level: true } },
      academicYear: true,
    },
  })
  return NextResponse.json(enrollment)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
    if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS) && !isLegacyRole)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const enrollment = await prisma.enrollment.findFirst({ where: { id, schoolId: user.schoolId } })
    if (!enrollment) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    await prisma.enrollment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "فشل الحذف" }, { status: 400 })
  }
}

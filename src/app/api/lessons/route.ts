import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

const legacyRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]

function canAccessLessons(user: any) {
  return legacyRoles.includes(user?.role) || hasPermission(user, PERMISSIONS.REVIEW_LESSONS)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessLessons(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, homework, notes, duration, classroomId, subjectId } = body

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })
  if (!activeYear) return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })

  const activeTerm = await prisma.term.findFirst({
    where: { academicYearId: activeYear.id, isActive: true },
  })

  let teacherId: string
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "الأستاذ غير موجود" }, { status: 404 })
    teacherId = teacher.id
  } else {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { classroomId, subjectId, schoolId: user.schoolId, academicYearId: activeYear.id },
    })
    teacherId = assignment?.teacherId || ""
    if (!teacherId) return NextResponse.json({ error: "لا يوجد أستاذ مكلف" }, { status: 404 })
  }

  const lesson = await prisma.lesson.create({
    data: {
      title, description, homework, notes,
      duration: duration ? parseInt(duration) : null,
      classroomId, subjectId, teacherId,
      schoolId: user.schoolId,
      academicYearId: activeYear.id,
      termId: activeTerm?.id,
      status: "DRAFT",
    },
  })

  return NextResponse.json(lesson)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const subjectId = url.searchParams.get("subjectId")
  const teacherId = url.searchParams.get("teacherId")

  const where: any = { schoolId: user.schoolId }
  if (classroomId) where.classroomId = classroomId
  if (subjectId) where.subjectId = subjectId
  if (teacherId) where.teacherId = teacherId

  const lessons = await prisma.lesson.findMany({
    where,
    include: { classroom: { select: { id: true, name: true } }, subject: { select: { id: true, nameAr: true, nameFr: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(lessons)
}

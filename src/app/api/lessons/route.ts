import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { notifySchoolManagers } from "@/lib/operational-notifications"

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

  const [classroom, subject, teacher] = await Promise.all([
    prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { name: true },
    }),
    prisma.subject.findUnique({
      where: { id: subjectId },
      select: { nameAr: true, nameFr: true },
    }),
    prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { name: true } } },
    }),
  ])

  await notifySchoolManagers({
    schoolId: user.schoolId,
    type: "LESSON_RECORDED",
    entityType: "LESSON",
    entityId: lesson.id,
    actionUrl: `/school/classrooms/${classroomId}`,
    title: `درس جديد في ${classroom?.name || "القسم"}`,
    message: `وثق ${teacher?.user.name || "الأستاذ"} درس "${lesson.title}" في ${subject?.nameAr || "المادة"}.`,
    metadata: {
      lessonId: lesson.id,
      classroomId,
      classroomName: classroom?.name || null,
      subjectId,
      subjectName: subject?.nameAr || null,
      teacherId,
      teacherName: teacher?.user.name || null,
      duration: lesson.duration,
    },
  }).catch((error) => {
    console.error("Lesson manager notification creation failed:", error)
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

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canAccessLessons(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, title, description, homework, notes, duration } = body

  const existing = await prisma.lesson.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 })

  const lesson = await prisma.lesson.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(homework !== undefined && { homework }),
      ...(notes !== undefined && { notes }),
      ...(duration !== undefined && { duration: parseInt(duration) || null }),
    },
  })
  return NextResponse.json(lesson)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canAccessLessons(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const existing = await prisma.lesson.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "الدرس غير موجود" }, { status: 404 })

  await prisma.lesson.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

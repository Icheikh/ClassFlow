import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const classroom = await prisma.classroom.findFirst({
    where: { id: params.id, schoolId: user.schoolId },
    include: { level: { include: { stage: true } }, stream: true },
  })
  if (!classroom) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const year = await prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isActive: true } })
  const activeTerm = year
    ? await prisma.term.findFirst({
        where: { schoolId: user.schoolId, academicYearId: year.id, isActive: true },
      })
    : null

  const enrollments = await prisma.enrollment.findMany({
    where: { classroomId: classroom.id, academicYearId: year?.id },
    include: { student: true },
    orderBy: { student: { lastName: "asc" } },
  })

  const teacherAssignments = await prisma.teacherAssignment.findMany({
    where: { classroomId: classroom.id, academicYearId: year?.id },
    include: { teacher: { include: { user: { select: { name: true } } } }, subject: true },
  })

  const recentLessons = await prisma.lesson.findMany({
    where: { classroomId: classroom.id, academicYearId: year?.id },
    orderBy: { date: "desc" },
    take: 10,
    include: { subject: true, teacher: { include: { user: { select: { name: true } } } } },
  })

  const assessments = await prisma.assessment.findMany({
    where: {
      classroomId: classroom.id,
      academicYearId: year?.id,
      termId: activeTerm?.id,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      subject: { select: { id: true, nameAr: true } },
      teacher: { include: { user: { select: { name: true } } } },
      scores: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
      },
    },
  })

  const publication = activeTerm
    ? await prisma.resultPublication.findUnique({
        where: {
          academicYearId_termId_classroomId: {
            academicYearId: year!.id,
            termId: activeTerm.id,
            classroomId: classroom.id,
          },
        },
      })
    : null

  const assessmentIds = assessments.map((assessment) => assessment.id)
  const recentActivity = assessmentIds.length || publication
    ? await prisma.resultAuditLog.findMany({
        where: {
          schoolId: user.schoolId,
          OR: [
            ...(assessmentIds.length
              ? [{ entityType: { in: ["ASSESSMENT", "ASSESSMENT_OVERRIDE"] }, entityId: { in: assessmentIds } }]
              : []),
            ...(publication ? [{ entityType: "RESULT_PUBLICATION", entityId: publication.id }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })
    : []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayAttendances = await prisma.attendance.findMany({
    where: { classroomId: classroom.id, date: { gte: today } },
    include: { student: true },
  })

  const absentToday = todayAttendances.filter((a) => a.status !== "PRESENT").length
  const presentToday = todayAttendances.filter((a) => a.status === "PRESENT").length

  return NextResponse.json({
    classroom,
    enrollments,
    teacherAssignments,
    recentLessons,
    activeTerm,
    resultPublication: publication,
    assessments,
    recentActivity,
    stats: {
      totalStudents: enrollments.length,
      totalTeachers: teacherAssignments.length,
      presentToday,
      absentToday,
      assessmentCount: assessments.length,
    },
  })
}

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
    stats: {
      totalStudents: enrollments.length,
      totalTeachers: teacherAssignments.length,
      presentToday,
      absentToday,
    },
  })
}
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const teacher = await prisma.teacher.findFirst({
    where: { id: params.id, schoolId: user.schoolId },
    include: { user: { select: { id: true, email: true, name: true, phone: true, isActive: true } } },
  })
  if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const year = await prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isActive: true } })
  const yearId = year?.id

  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId: teacher.id, academicYearId: yearId },
    include: { subject: true, classroom: { include: { level: true } } },
  })

  const recentLessons = await prisma.lesson.findMany({
    where: { teacherId: teacher.id, academicYearId: yearId },
    orderBy: { date: "desc" },
    take: 15,
    include: { subject: true, classroom: true },
  })

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
  const monthLessons = await prisma.lesson.findMany({
    where: { teacherId: teacher.id, academicYearId: yearId, date: { gte: monthStart } },
    select: { duration: true },
  })
  const totalMinutes = monthLessons.reduce((s, l) => s + (l.duration || 0), 0)
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10

  const stats = {
    assignments: assignments.length,
    lessonsThisMonth: monthLessons.length,
    totalStudents: (
      await Promise.all(assignments.map((a) =>
        prisma.enrollment.count({ where: { classroomId: a.classroomId, academicYearId: yearId } })
      ))
    ).reduce((a, b) => a + b, 0),
  }

  const payroll = {
    hourlyRate: teacher.hourlyRate,
    totalHours: teacher.hourlyRate ? totalHours : null,
    estimatedEarnings: teacher.hourlyRate ? Math.round(totalHours * teacher.hourlyRate * 10) / 10 : null,
  }

  return NextResponse.json({ teacher, assignments, recentLessons, stats, payroll })
}
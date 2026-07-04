import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { addUtcDays, formatDateOnly, getWeekStartDate } from "@/lib/date"

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

  const weekStart = getWeekStartDate()
  const weekEnd = addUtcDays(weekStart, 7)

  const [weeklyAttendance, weeklyHourEntries] = await Promise.all([
    prisma.teacherAttendance.findMany({
      where: {
        teacherId: teacher.id,
        date: { gte: weekStart, lt: weekEnd },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.teachingHourEntry.findMany({
      where: {
        teacherAssignment: {
          teacherId: teacher.id,
          academicYearId: yearId,
        },
        date: { gte: weekStart, lt: weekEnd },
      },
      include: {
        teacherAssignment: {
          include: {
            subject: true,
            classroom: { include: { level: true, stream: true } },
          },
        },
        recordedByUser: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    }),
  ])

  const weeklyAssignmentMap = new Map(
    assignments.map((assignment) => [
      assignment.id,
      {
        id: assignment.id,
        subject: assignment.subject.nameAr,
        classroom: assignment.classroom.name,
        level: assignment.classroom.level.name,
        hourlyRate: assignment.hourlyRate,
        weeklyHours: assignment.weeklyHours,
        totalHours: 0,
        entryCount: 0,
        estimatedEarnings: 0,
        lastRecordedAt: null as string | null,
        lastRecordedBy: null as string | null,
      },
    ])
  )

  for (const entry of weeklyHourEntries) {
    const assignment = weeklyAssignmentMap.get(entry.teacherAssignmentId)
    if (!assignment) continue

    assignment.totalHours = Math.round((assignment.totalHours + entry.hoursTaught) * 100) / 100
    assignment.entryCount += 1
    assignment.estimatedEarnings = assignment.hourlyRate != null
      ? Math.round(assignment.totalHours * assignment.hourlyRate * 100) / 100
      : 0

    if (!assignment.lastRecordedAt || new Date(entry.updatedAt) > new Date(assignment.lastRecordedAt)) {
      assignment.lastRecordedAt = entry.updatedAt.toISOString()
      assignment.lastRecordedBy = entry.recordedByUser.name
    }
  }

  const attendanceSummary = {
    presentDays: weeklyAttendance.filter((record) => record.status === "PRESENT").length,
    absentDays: weeklyAttendance.filter((record) => record.status === "ABSENT").length,
    lateDays: weeklyAttendance.filter((record) => record.status === "LATE").length,
    excusedDays: weeklyAttendance.filter((record) => record.status === "EXCUSED").length,
    totalMarkedDays: weeklyAttendance.length,
  }

  const weeklyHours = Math.round(weeklyHourEntries.reduce((sum, entry) => sum + entry.hoursTaught, 0) * 100) / 100
  const estimatedWeeklyEarnings = Math.round(
    Array.from(weeklyAssignmentMap.values()).reduce((sum, assignment) => sum + assignment.estimatedEarnings, 0) * 100
  ) / 100

  const payroll = {
    weekStart: formatDateOnly(weekStart),
    weekEnd: formatDateOnly(addUtcDays(weekEnd, -1)),
    totalHours: weeklyHours,
    estimatedEarnings: estimatedWeeklyEarnings,
    attendanceSummary,
    attendanceRecords: weeklyAttendance.map((record) => ({
      id: record.id,
      date: formatDateOnly(record.date),
      status: record.status,
      checkIn: record.checkIn?.toISOString() ?? null,
      checkOut: record.checkOut?.toISOString() ?? null,
      markedBy: record.user.name,
    })),
    assignmentSummaries: Array.from(weeklyAssignmentMap.values()),
    recentHourEntries: weeklyHourEntries.slice(0, 8).map((entry) => ({
      id: entry.id,
      date: formatDateOnly(entry.date),
      hoursTaught: entry.hoursTaught,
      notes: entry.notes,
      subject: entry.teacherAssignment.subject.nameAr,
      classroom: entry.teacherAssignment.classroom.name,
      level: entry.teacherAssignment.classroom.level.name,
      stream: entry.teacherAssignment.classroom.stream?.name ?? null,
      recordedBy: entry.recordedByUser.name,
      recordedAt: entry.updatedAt.toISOString(),
    })),
  }

  return NextResponse.json({ teacher, assignments, recentLessons, stats, payroll })
}

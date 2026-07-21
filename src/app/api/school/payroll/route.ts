import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { addUtcDays, formatDateOnly, getWeekStartDate } from "@/lib/date"

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + (m || 0)
}

function computeDuration(start: string, end: string): number {
  return (parseTimeToMinutes(end) - parseTimeToMinutes(start)) / 60
}

const PAYABLE_STATUSES = new Set(["PRESENT", "LATE"])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT", "SCHOOL_ADMIN"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.VIEW_REPORTS) && !isLegacyRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const weekStart = getWeekStartDate(url.searchParams.get("weekStart") || undefined)
  const weekEnd = addUtcDays(weekStart, 7)

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })

  if (!year) {
    return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })
  }

  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      academicYearId: year.id,
      isActive: true,
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      subject: true,
      classroom: { include: { level: true, stream: true } },
      teachingHourEntries: {
        where: { date: { gte: weekStart, lt: weekEnd } },
        orderBy: { date: "asc" },
      },
    },
    orderBy: [
      { teacher: { user: { name: "asc" } } },
      { classroom: { name: "asc" } },
      { subject: { nameAr: "asc" } },
    ],
  })

  const scheduleEntries = await prisma.schedule.findMany({
    where: { schoolId: user.schoolId, teacherId: { not: null } },
    select: { id: true, teacherId: true, classroomId: true, subjectId: true, startTime: true, endTime: true, dayOfWeek: true },
  })

  const scheduleAttendances = await prisma.scheduleAttendance.findMany({
    where: {
      schoolId: user.schoolId,
      date: { gte: weekStart, lt: weekEnd },
      status: { in: Array.from(PAYABLE_STATUSES) },
    },
    select: {
      scheduleId: true,
      status: true,
    },
  })

  const expectedHoursByKey = new Map<string, number>()
  const scheduleMetaById = new Map<string, { key: string; duration: number }>()
  for (const s of scheduleEntries) {
    if (!s.teacherId) continue
    const key = `${s.teacherId}|${s.classroomId}|${s.subjectId}`
    const duration = computeDuration(s.startTime, s.endTime)
    const current = expectedHoursByKey.get(key) || 0
    expectedHoursByKey.set(key, current + duration)
    scheduleMetaById.set(s.id, { key, duration })
  }

  const confirmedHoursByKey = new Map<string, number>()
  for (const attendance of scheduleAttendances) {
    const meta = scheduleMetaById.get(attendance.scheduleId)
    if (!meta) continue
    confirmedHoursByKey.set(meta.key, (confirmedHoursByKey.get(meta.key) || 0) + meta.duration)
  }

  const rows = assignments.map((assignment) => {
    const expectedKey = `${assignment.teacherId}|${assignment.classroomId}|${assignment.subjectId}`
    const expectedHours = Math.round((expectedHoursByKey.get(expectedKey) || 0) * 100) / 100
    const confirmedHours = Math.round((confirmedHoursByKey.get(expectedKey) || 0) * 100) / 100
    const compensationHours = Math.round(
      assignment.teachingHourEntries.reduce((sum, entry) => sum + entry.hoursTaught, 0) * 100
    ) / 100
    const totalHours = Math.round((confirmedHours + compensationHours) * 100) / 100

    const earnings = assignment.hourlyRate != null
      ? Math.round(totalHours * assignment.hourlyRate * 100) / 100
      : null

    return {
      id: assignment.id,
      teacherId: assignment.teacherId,
      teacherName: assignment.teacher.user.name,
      subject: assignment.subject.nameAr,
      classroom: assignment.classroom.name,
      level: assignment.classroom.level.name,
      stream: assignment.classroom.stream?.name ?? null,
      hourlyRate: assignment.hourlyRate,
      weeklyHours: assignment.weeklyHours,
      confirmedHours,
      compensationHours,
      totalHours,
      expectedHours,
      entryCount: assignment.teachingHourEntries.length,
      earnings,
    }
  })

  const teacherMap = new Map<
    string,
    { teacherId: string; name: string; assignments: typeof rows; totalHours: number; totalEarnings: number }
  >()

  for (const row of rows) {
    if (!teacherMap.has(row.teacherId)) {
      teacherMap.set(row.teacherId, {
        teacherId: row.teacherId,
        name: row.teacherName,
        assignments: [],
        totalHours: 0,
        totalEarnings: 0,
      })
    }

    const teacher = teacherMap.get(row.teacherId)!
    teacher.assignments.push(row)
    teacher.totalHours = Math.round((teacher.totalHours + row.totalHours) * 100) / 100
    teacher.totalEarnings = Math.round((teacher.totalEarnings + (row.earnings || 0)) * 100) / 100
  }

  const teachers = Array.from(teacherMap.values())
  const totalEarnings = Math.round(teachers.reduce((sum, teacher) => sum + teacher.totalEarnings, 0) * 100) / 100
  const grandTotalHours = Math.round(teachers.reduce((sum, teacher) => sum + teacher.totalHours, 0) * 100) / 100
  const assignmentsWithoutRate = rows.filter((row) => row.hourlyRate == null).length

  return NextResponse.json({
    teachers,
    rows,
    totalEarnings,
    grandTotalHours,
    totalTeachers: teachers.length,
    assignmentsWithoutRate,
    weekStart: formatDateOnly(weekStart),
    weekEnd: formatDateOnly(addUtcDays(weekEnd, -1)),
  })
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { addUtcDays, formatDateOnly, getWeekStartDate } from "@/lib/date"

export const dynamic = "force-dynamic"

const PAYABLE_STATUSES = new Set(["PRESENT", "LATE"])

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + (minutes || 0)
}

function computeDuration(startTime: string, endTime: string) {
  return Math.max(0, (parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime)) / 60)
}

function buildDayWindow(date: Date) {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = addUtcDays(start, 1)
  return { start, end }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId: user.id },
    include: { user: { select: { name: true, email: true } } },
  })

  if (!teacher) {
    return NextResponse.json({ error: "الأستاذ غير موجود" }, { status: 404 })
  }

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })

  if (!activeYear) {
    return NextResponse.json({
      teacher: { id: teacher.id, name: teacher.user.name, email: teacher.user.email },
      activeYear: null,
      weekStart: formatDateOnly(getWeekStartDate()),
      weekEnd: formatDateOnly(addUtcDays(getWeekStartDate(), 6)),
      assignments: [],
      todaySessions: [],
      attendanceSummary: { total: 0, confirmed: 0, pending: 0, present: 0, absent: 0, late: 0, excused: 0 },
      weeklyPayroll: { confirmedHours: 0, compensationHours: 0, totalHours: 0, estimatedEarnings: 0, missingRates: 0 },
      notifications: [],
      unreadNotifications: 0,
    })
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const { start: todayStart, end: tomorrow } = buildDayWindow(today)
  const weekStart = getWeekStartDate(today)
  const weekEnd = addUtcDays(weekStart, 7)

  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      teacherId: teacher.id,
      academicYearId: activeYear.id,
      isActive: true,
    },
    include: {
      classroom: { include: { level: true, stream: true } },
      subject: true,
      teachingHourEntries: {
        where: { date: { gte: weekStart, lt: weekEnd } },
      },
    },
    orderBy: [
      { classroom: { name: "asc" } },
      { subject: { nameAr: "asc" } },
    ],
  })

  const schedules = await prisma.schedule.findMany({
    where: {
      schoolId: user.schoolId,
      teacherId: teacher.id,
    },
    include: {
      classroom: { include: { level: true, stream: true } },
      subject: true,
    },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
  })

  const scheduleAttendances = schedules.length
    ? await prisma.scheduleAttendance.findMany({
        where: {
          schoolId: user.schoolId,
          scheduleId: { in: schedules.map((schedule) => schedule.id) },
          date: { gte: weekStart, lt: weekEnd },
        },
        include: {
          confirmedByUser: { select: { name: true } },
        },
      })
    : []

  const [notifications, unreadNotifications] = await Promise.all([
    prisma.notification.findMany({
      where: { schoolId: user.schoolId, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.notification.count({
      where: { schoolId: user.schoolId, userId: user.id, read: false },
    }),
  ])

  const attendanceByScheduleAndDate = new Map(
    scheduleAttendances.map((attendance) => [`${attendance.scheduleId}|${formatDateOnly(attendance.date)}`, attendance])
  )
  const scheduleMetaById = new Map(
    schedules.map((schedule) => [
      schedule.id,
      {
        key: `${schedule.teacherId}|${schedule.classroomId}|${schedule.subjectId}`,
        duration: computeDuration(schedule.startTime, schedule.endTime),
      },
    ])
  )

  const expectedHoursByKey = new Map<string, number>()
  for (const schedule of schedules) {
    const key = `${schedule.teacherId}|${schedule.classroomId}|${schedule.subjectId}`
    expectedHoursByKey.set(key, (expectedHoursByKey.get(key) || 0) + computeDuration(schedule.startTime, schedule.endTime))
  }

  const confirmedHoursByKey = new Map<string, number>()
  const attendanceSummary = { total: 0, confirmed: 0, pending: 0, present: 0, absent: 0, late: 0, excused: 0 }

  for (const attendance of scheduleAttendances) {
    const meta = scheduleMetaById.get(attendance.scheduleId)
    if (!meta) continue
    attendanceSummary.confirmed += 1
    if (attendance.status === "PRESENT") attendanceSummary.present += 1
    if (attendance.status === "ABSENT") attendanceSummary.absent += 1
    if (attendance.status === "LATE") attendanceSummary.late += 1
    if (attendance.status === "EXCUSED") attendanceSummary.excused += 1
    if (PAYABLE_STATUSES.has(attendance.status)) {
      confirmedHoursByKey.set(meta.key, (confirmedHoursByKey.get(meta.key) || 0) + meta.duration)
    }
  }

  const todaySchedules = schedules.filter((schedule) => schedule.dayOfWeek === todayStart.getUTCDay())
  attendanceSummary.total = todaySchedules.length
  attendanceSummary.pending = Math.max(
    0,
    todaySchedules.length -
      scheduleAttendances.filter(
        (attendance) => attendance.date >= todayStart && attendance.date < tomorrow
      ).length
  )

  const assignmentRows = assignments.map((assignment) => {
    const key = `${assignment.teacherId}|${assignment.classroomId}|${assignment.subjectId}`
    const confirmedHours = roundMoney(confirmedHoursByKey.get(key) || 0)
    const compensationHours = roundMoney(
      assignment.teachingHourEntries.reduce((sum, entry) => sum + entry.hoursTaught, 0)
    )
    const totalHours = roundMoney(confirmedHours + compensationHours)
    const estimatedEarnings = assignment.hourlyRate != null
      ? roundMoney(totalHours * assignment.hourlyRate)
      : null

    return {
      id: assignment.id,
      classroom: assignment.classroom,
      subject: assignment.subject,
      hourlyRate: assignment.hourlyRate,
      weeklyHours: assignment.weeklyHours,
      expectedScheduleHours: roundMoney(expectedHoursByKey.get(key) || 0),
      confirmedHours,
      compensationHours,
      totalHours,
      estimatedEarnings,
    }
  })

  const weeklyPayroll = assignmentRows.reduce(
    (summary, assignment) => ({
      confirmedHours: roundMoney(summary.confirmedHours + assignment.confirmedHours),
      compensationHours: roundMoney(summary.compensationHours + assignment.compensationHours),
      totalHours: roundMoney(summary.totalHours + assignment.totalHours),
      estimatedEarnings: roundMoney(summary.estimatedEarnings + (assignment.estimatedEarnings || 0)),
      missingRates: summary.missingRates + (assignment.hourlyRate == null ? 1 : 0),
    }),
    { confirmedHours: 0, compensationHours: 0, totalHours: 0, estimatedEarnings: 0, missingRates: 0 }
  )

  const todaySessions = todaySchedules.map((schedule) => {
    const attendance = attendanceByScheduleAndDate.get(`${schedule.id}|${formatDateOnly(todayStart)}`)
    return {
      id: schedule.id,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      duration: computeDuration(schedule.startTime, schedule.endTime),
      classroom: schedule.classroom,
      subject: schedule.subject,
      status: attendance?.status || null,
      notes: attendance?.notes || null,
      confirmedBy: attendance?.confirmedByUser.name || null,
    }
  })

  return NextResponse.json({
    teacher: { id: teacher.id, name: teacher.user.name, email: teacher.user.email },
    activeYear: { id: activeYear.id, name: activeYear.name },
    weekStart: formatDateOnly(weekStart),
    weekEnd: formatDateOnly(addUtcDays(weekEnd, -1)),
    assignments: assignmentRows,
    todaySessions,
    attendanceSummary,
    weeklyPayroll,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: notification.read,
      createdAt: notification.createdAt,
    })),
    unreadNotifications,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { addUtcDays, formatDateOnly, getWeekStartDate } from "@/lib/date"
import { monthBounds } from "@/lib/finance"

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
  const user = session?.user

  if (!user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!hasPermission(user, PERMISSIONS.VIEW_REPORTS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month") || ""
  const monthRange = /^\d{4}-\d{2}$/.test(monthParam) ? monthBounds(monthParam) : null

  let rangeStart: Date
  let rangeEnd: Date
  let period: { type: "week" | "month"; value: string }
  if (monthRange) {
    rangeStart = monthRange.start
    rangeEnd = monthRange.end
    period = { type: "month", value: monthParam }
  } else {
    const weekStart = getWeekStartDate(url.searchParams.get("weekStart") || undefined)
    rangeStart = weekStart
    rangeEnd = addUtcDays(weekStart, 7)
    period = { type: "week", value: formatDateOnly(weekStart) }
  }

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId!, isActive: true },
  })

  if (!year) {
    return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })
  }

  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: user.schoolId!,
      academicYearId: year.id,
      isActive: true,
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      subject: true,
      classroom: { include: { level: true, stream: true } },
      teachingHourEntries: {
        where: { date: { gte: rangeStart, lt: rangeEnd } },
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
    where: { schoolId: user.schoolId!, teacherId: { not: null } },
    select: { id: true, teacherId: true, classroomId: true, subjectId: true, startTime: true, endTime: true, dayOfWeek: true },
  })

  const scheduleAttendances = await prisma.scheduleAttendance.findMany({
    where: {
      schoolId: user.schoolId!,
      date: { gte: rangeStart, lt: rangeEnd },
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

  // Weekly schedule pattern scaled to the viewed range (×1 for weeks).
  const weeksInRange = Math.round(((rangeEnd.getTime() - rangeStart.getTime()) / (7 * 86400 * 1000)) * 100) / 100

  const assignmentKeys = new Set<string>()
  const rows = assignments.map((assignment) => {
    const expectedKey = `${assignment.teacherId}|${assignment.classroomId}|${assignment.subjectId}`
    assignmentKeys.add(expectedKey)
    const expectedHours = Math.round((expectedHoursByKey.get(expectedKey) || 0) * weeksInRange * 100) / 100
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
      unassigned: false,
    }
  })

  // Confirmed hours with NO matching assignment (e.g. substitute teacher).
  // Previously these wages silently vanished — now surfaced for the director.
  const orphanKeys = Array.from(confirmedHoursByKey.keys()).filter((k) => !assignmentKeys.has(k))
  const orphanRows: typeof rows = []
  if (orphanKeys.length > 0) {
    const [tIds, cIds, sIds] = [new Set<string>(), new Set<string>(), new Set<string>()]
    for (const key of orphanKeys) {
      const [t, c, s] = key.split("|")
      tIds.add(t)
      cIds.add(c)
      sIds.add(s)
    }
    const [orphanTeachers, orphanClassrooms, orphanSubjects] = await Promise.all([
      prisma.teacher.findMany({
        where: { id: { in: Array.from(tIds) } },
        select: { id: true, user: { select: { name: true } } },
      }),
      prisma.classroom.findMany({
        where: { id: { in: Array.from(cIds) } },
        select: { id: true, name: true, level: { select: { name: true } }, stream: { select: { name: true } } },
      }),
      prisma.subject.findMany({ where: { id: { in: Array.from(sIds) } }, select: { id: true, nameAr: true } }),
    ])
    const tMap = new Map(orphanTeachers.map((t) => [t.id, t.user.name]))
    const cMap = new Map(orphanClassrooms.map((c) => [c.id, c]))
    const sMap = new Map(orphanSubjects.map((s) => [s.id, s.nameAr]))
    for (const key of orphanKeys) {
      const [t, c, s] = key.split("|")
      const confirmed = Math.round((confirmedHoursByKey.get(key) || 0) * 100) / 100
      const classroom = cMap.get(c)
      orphanRows.push({
        id: `unassigned-${key}`,
        teacherId: t,
        teacherName: tMap.get(t) || "—",
        subject: sMap.get(s) || "—",
        classroom: classroom?.name || "—",
        level: classroom?.level.name || "—",
        stream: classroom?.stream?.name ?? null,
        hourlyRate: null,
        weeklyHours: null,
        confirmedHours: confirmed,
        compensationHours: 0,
        totalHours: confirmed,
        expectedHours: Math.round((expectedHoursByKey.get(key) || 0) * weeksInRange * 100) / 100,
        entryCount: 0,
        earnings: null,
        unassigned: true,
      })
    }
  }
  const allRows = [...rows, ...orphanRows]

  const teacherMap = new Map<
    string,
    { teacherId: string; name: string; assignments: typeof allRows; totalHours: number; totalEarnings: number }
  >()

  for (const row of allRows) {
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
  const assignmentsWithoutRate = allRows.filter((row) => row.hourlyRate == null).length

  // Payout ledger (monthly close only).
  let records: { teacherId: string; status: string; paidAt: string | null }[] = []
  if (period.type === "month") {
    const dbRecords = await prisma.payrollRecord.findMany({
      where: { schoolId: user.schoolId!, period: period.value },
      select: { teacherId: true, status: true, paidAt: true },
    })
    records = dbRecords.map((r) => ({ teacherId: r.teacherId, status: r.status, paidAt: r.paidAt?.toISOString() || null }))
  }

  const rangeLabel =
    period.type === "month"
      ? period.value
      : `${formatDateOnly(rangeStart)} → ${formatDateOnly(addUtcDays(rangeEnd, -1))}`

  return NextResponse.json({
    teachers,
    rows: allRows,
    totalEarnings,
    grandTotalHours,
    totalTeachers: teachers.length,
    assignmentsWithoutRate,
    unassignedCount: orphanRows.length,
    records,
    period,
    rangeLabel,
    weekStart: formatDateOnly(rangeStart),
    weekEnd: formatDateOnly(addUtcDays(rangeEnd, -1)),
  })
}

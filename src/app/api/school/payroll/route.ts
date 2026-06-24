import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT", "SCHOOL_ADMIN"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.VIEW_REPORTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month") // YYYY-MM format

  const year = await prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isActive: true } })
  const yearId = year?.id

  // Calculate month range
  let monthStart: Date
  if (monthParam) {
    monthStart = new Date(monthParam + "-01")
  } else {
    monthStart = new Date()
    monthStart.setDate(1)
  }
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1)

  const assignments = await prisma.teacherAssignment.findMany({
    where: { schoolId: user.schoolId, academicYearId: yearId },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      subject: true,
      classroom: true,
    },
  })

  // Get attendance records for this month (only PRESENT counts for payroll)
  const attendanceRecords = await prisma.teacherAttendance.findMany({
    where: {
      teacher: { schoolId: user.schoolId },
      date: { gte: monthStart, lt: monthEnd },
      status: "PRESENT",
    },
    select: { teacherId: true, date: true },
  })

  // Build set of (teacherId, date) pairs where attendance is confirmed
  const presentDays = new Set(attendanceRecords.map((r) => `${r.teacherId}|${r.date.toISOString().split("T")[0]}`))

  const rows = await Promise.all(assignments.map(async (a) => {
    const lessons = await prisma.lesson.findMany({
      where: {
        teacherId: a.teacherId,
        subjectId: a.subjectId,
        classroomId: a.classroomId,
        academicYearId: yearId,
        date: { gte: monthStart, lt: monthEnd },
      },
      select: { duration: true, date: true },
    })

    // Only count lessons on days where attendance was PRESENT
    const validLessons = lessons.filter((l) => {
      const dateKey = l.date.toISOString().split("T")[0]
      return presentDays.has(`${a.teacherId}|${dateKey}`)
    })

    const totalMinutes = validLessons.reduce((s, l) => s + (l.duration || 0), 0)
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10
    const allLessonsCount = lessons.length
    const validLessonsCount = validLessons.length
    const earnings = a.hourlyRate != null ? Math.round(totalHours * a.hourlyRate * 10) / 10 : null

    return {
      id: a.id,
      teacherId: a.teacherId,
      teacherName: a.teacher.user.name,
      subject: a.subject.nameAr,
      classroom: a.classroom.name,
      hourlyRate: a.hourlyRate,
      weeklyHours: a.weeklyHours,
      totalHours,
      lessonCount: validLessonsCount,
      allLessonsCount,
      earnings,
    }
  }))

  // Group by teacher
  const teacherMap = new Map<string, { name: string; assignments: typeof rows; totalHours: number; totalEarnings: number }>()
  for (const r of rows) {
    const key = r.teacherId
    if (!teacherMap.has(key)) teacherMap.set(key, { name: r.teacherName, assignments: [], totalHours: 0, totalEarnings: 0 })
    const entry = teacherMap.get(key)!
    entry.assignments.push(r)
    entry.totalHours += r.totalHours
    entry.totalEarnings += r.earnings || 0
  }

  const teachers = Array.from(teacherMap.values())
  const totalEarnings = teachers.reduce((s, t) => s + t.totalEarnings, 0)
  const grandTotalHours = teachers.reduce((s, t) => s + t.totalHours, 0)

  return NextResponse.json({
    teachers,
    rows,
    totalEarnings,
    grandTotalHours,
    month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
    totalTeachers: teachers.length,
  })
}

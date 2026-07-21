import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseDateOnly } from "@/lib/date"

const MANAGER_ROLES = ["SUPERVISOR", "SCHOOL_ADMIN"]
const CONFIRMED_STATUSES = new Set(["PRESENT", "LATE", "EXCUSED", "ABSENT"])

function buildDayWindow(date: Date) {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function deriveTeacherDayStatus(summary: {
  total: number
  present: number
  late: number
  excused: number
  absent: number
  pending: number
}) {
  if (summary.total === 0) return null
  if (summary.pending > 0) return null
  if (summary.absent > 0) return "ABSENT"
  if (summary.late > 0) return "LATE"
  if (summary.excused > 0 && summary.present === 0 && summary.late === 0) return "EXCUSED"
  return "PRESENT"
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const teacherId = url.searchParams.get("teacherId")
  const date = parseDateOnly(url.searchParams.get("date"))
  const { start, end } = buildDayWindow(date)
  const dayOfWeek = start.getUTCDay()

  if (!teacherId && MANAGER_ROLES.includes(user.role)) {
    const schedules = await prisma.schedule.findMany({
      where: {
        schoolId: user.schoolId,
        dayOfWeek,
        teacherId: { not: null },
      },
      include: {
        teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
        subject: { select: { id: true, nameAr: true, nameFr: true, code: true } },
        classroom: { include: { level: true, stream: true } },
      },
      orderBy: [
        { startTime: "asc" },
        { teacher: { user: { name: "asc" } } },
        { classroom: { name: "asc" } },
      ],
    })

    const attendances = await prisma.scheduleAttendance.findMany({
      where: {
        schoolId: user.schoolId,
        date: { gte: start, lt: end },
        scheduleId: { in: schedules.map((schedule) => schedule.id) },
      },
      include: {
        confirmedByUser: { select: { id: true, name: true } },
      },
    })

    const attendanceMap = new Map(attendances.map((item) => [item.scheduleId, item]))

    return NextResponse.json({
      date: start.toISOString(),
      sessions: schedules.map((schedule) => {
        const attendance = attendanceMap.get(schedule.id)
        return {
          scheduleId: schedule.id,
          teacherId: schedule.teacherId,
          teacherName: schedule.teacher?.user.name || "",
          teacherEmail: schedule.teacher?.user.email || "",
          subjectName: schedule.subject.nameAr,
          subjectNameFr: schedule.subject.nameFr,
          classroomName: schedule.classroom.name,
          levelName: schedule.classroom.level.name,
          streamName: schedule.classroom.stream?.name || null,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: attendance?.status || null,
          notes: attendance?.notes || "",
          confirmedBy: attendance?.confirmedByUser?.name || null,
        }
      }),
    })
  }

  const targetTeacherId = teacherId || null
  if (!targetTeacherId && user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const schedules = await prisma.schedule.findMany({
      where: {
        schoolId: user.schoolId,
        teacherId: teacher.id,
        dayOfWeek,
      },
      select: { id: true },
    })

    const attendances = schedules.length
      ? await prisma.scheduleAttendance.findMany({
          where: {
            schoolId: user.schoolId,
            scheduleId: { in: schedules.map((schedule) => schedule.id) },
            date: { gte: start, lt: end },
          },
          select: { status: true },
        })
      : []

    const summary = {
      total: schedules.length,
      present: attendances.filter((item) => item.status === "PRESENT").length,
      late: attendances.filter((item) => item.status === "LATE").length,
      excused: attendances.filter((item) => item.status === "EXCUSED").length,
      absent: attendances.filter((item) => item.status === "ABSENT").length,
      pending: Math.max(0, schedules.length - attendances.length),
    }

    return NextResponse.json({
      status: deriveTeacherDayStatus(summary),
      lessonCount: summary.total,
      totalSessions: summary.total,
      confirmedSessions: attendances.length,
      pendingSessions: summary.pending,
      absentSessions: summary.absent,
      lateSessions: summary.late,
      excusedSessions: summary.excused,
    })
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!MANAGER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const body = await req.json()
  const action = body.action
  const date = parseDateOnly(body.date)
  const { start, end } = buildDayWindow(date)
  const status = typeof body.status === "string" ? body.status : "PRESENT"
  const notes = typeof body.notes === "string" ? body.notes.trim() : ""

  if (!CONFIRMED_STATUSES.has(status)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 })
  }

  if (action === "mark" && typeof body.scheduleId === "string") {
    const schedule = await prisma.schedule.findFirst({
      where: { id: body.scheduleId, schoolId: user.schoolId, teacherId: { not: null } },
    })
    if (!schedule) {
      return NextResponse.json({ error: "الحصة غير موجودة" }, { status: 404 })
    }

    const record = await prisma.scheduleAttendance.upsert({
      where: { scheduleId_date: { scheduleId: schedule.id, date } },
      update: {
        status,
        notes: notes || null,
        confirmedByUserId: user.id,
      },
      create: {
        schoolId: user.schoolId,
        scheduleId: schedule.id,
        date,
        status,
        notes: notes || null,
        confirmedByUserId: user.id,
      },
    })

    return NextResponse.json(record)
  }

  if (action === "bulk-mark") {
    const scheduleIds = Array.isArray(body.scheduleIds)
      ? body.scheduleIds.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      : null

    const schedules = await prisma.schedule.findMany({
      where: {
        schoolId: user.schoolId,
        teacherId: { not: null },
        dayOfWeek: start.getUTCDay(),
        ...(scheduleIds?.length ? { id: { in: scheduleIds } } : {}),
      },
      select: { id: true },
    })

    for (const schedule of schedules) {
      await prisma.scheduleAttendance.upsert({
        where: { scheduleId_date: { scheduleId: schedule.id, date } },
        update: {
          status,
          notes: notes || null,
          confirmedByUserId: user.id,
        },
        create: {
          schoolId: user.schoolId,
          scheduleId: schedule.id,
          date,
          status,
          notes: notes || null,
          confirmedByUserId: user.id,
        },
      })
    }

    return NextResponse.json({ success: true, count: schedules.length })
  }

  if (action === "checkin" || action === "checkout") {
    return NextResponse.json(
      { error: "يتم تأكيد الحضور على مستوى الحصص المجدولة من قبل الإدارة أو مدير الدروس" },
      { status: 403 }
    )
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 })
}

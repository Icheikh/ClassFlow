import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const teacherId = url.searchParams.get("teacherId")
  const dateParam = url.searchParams.get("date")
  const today = dateParam ? new Date(dateParam) : new Date()
  today.setHours(0, 0, 0, 0)

  // Supervisor/SchoolAdmin: return all teachers' attendance for the day
  if (!teacherId && (user.role === "SUPERVISOR" || user.role === "SCHOOL_ADMIN")) {
    const teachers = await prisma.teacher.findMany({
      where: { schoolId: user.schoolId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        teacherAssignments: {
          include: { subject: true, classroom: { include: { level: true } } },
          where: { academicYear: { isActive: true }, isActive: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    })

    // Get today's attendance records for all teachers
    const attendanceRecords = await prisma.teacherAttendance.findMany({
      where: { date: today, teacher: { schoolId: user.schoolId } },
    })
    const attendanceMap = new Map(attendanceRecords.map((r) => [r.teacherId, r]))

    // Get lesson counts for today
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const lessonCounts = await prisma.lesson.groupBy({
      by: ["teacherId"],
      where: { schoolId: user.schoolId, date: { gte: today, lt: tomorrow } },
      _count: true,
    })
    const lessonCountMap = new Map(lessonCounts.map((l) => [l.teacherId, l._count]))

    const result = teachers.map((t) => {
      const att = attendanceMap.get(t.id)
      return {
        id: t.id,
        name: t.user.name,
        email: t.user.email,
        assignments: t.teacherAssignments.map((a) => ({
          subject: a.subject.nameAr,
          classroom: `${a.classroom.name} - ${a.classroom.level.name}`,
          hourlyRate: a.hourlyRate,
        })),
        attendance: att ? {
          status: att.status,
          checkIn: att.checkIn,
          checkOut: att.checkOut,
          markedBy: att.userId,
        } : null,
        lessonCount: lessonCountMap.get(t.id) || 0,
        assignmentCount: t.teacherAssignments.length,
      }
    })

    return NextResponse.json({ date: today.toISOString(), teachers: result })
  }

  // Specific teacher or self: return single teacher's attendance
  const targetTeacherId = teacherId || null
  if (!targetTeacherId && user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const record = await prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date: today } },
    })
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const todayLessons = await prisma.lesson.count({
      where: { teacherId: teacher.id, date: { gte: today, lt: tomorrow } },
    })

    return NextResponse.json({
      id: teacher.id,
      checkedIn: !!record,
      checkIn: record?.checkIn,
      checkOut: record?.checkOut,
      status: record?.status || null,
      lessonCount: todayLessons,
    })
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { action, teacherId, status: attStatus } = body

  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Supervisor marks a teacher's attendance
  if (action === "mark" && teacherId) {
    if (!["SUPERVISOR", "SCHOOL_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
    }

    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, schoolId: user.schoolId },
    })
    if (!teacher) return NextResponse.json({ error: "الأستاذ غير موجود" }, { status: 404 })

    const record = await prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId, date: today } },
      update: { status: attStatus || "PRESENT", userId: user.id },
      create: {
        schoolId: user.schoolId,
        teacherId,
        userId: user.id,
        date: today,
        status: attStatus || "PRESENT",
        checkIn: attStatus === "PRESENT" ? new Date() : undefined,
      },
    })

    return NextResponse.json(record)
  }

  // Supervisor bulk mark all teachers
  if (action === "bulk-mark") {
    if (!["SUPERVISOR", "SCHOOL_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
    }

    const { status: bulkStatus, teacherIds } = body
    const where = teacherIds?.length
      ? { id: { in: teacherIds }, schoolId: user.schoolId }
      : { schoolId: user.schoolId }

    const teachers = await prisma.teacher.findMany({ where, select: { id: true } })

    for (const t of teachers) {
      await prisma.teacherAttendance.upsert({
        where: { teacherId_date: { teacherId: t.id, date: today } },
        update: { status: bulkStatus || "PRESENT", userId: user.id },
        create: {
          schoolId: user.schoolId,
          teacherId: t.id,
          userId: user.id,
          date: today,
          status: bulkStatus || "PRESENT",
          checkIn: bulkStatus === "PRESENT" ? new Date() : undefined,
        },
      })
    }

    return NextResponse.json({ success: true, count: teachers.length })
  }

  // Teacher self check-in/check-out (original behavior)
  if (action === "checkin" || action === "checkout") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const record = await prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId: teacher.id, date: today } },
      update: action === "checkin" ? { checkIn: new Date(), status: "PRESENT" } : { checkOut: new Date() },
      create: {
        schoolId: user.schoolId,
        teacherId: teacher.id,
        userId: user.id,
        date: today,
        checkIn: action === "checkin" ? new Date() : undefined,
        checkOut: action === "checkout" ? new Date() : undefined,
        status: "PRESENT",
      },
    })

    return NextResponse.json(record)
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { formatDateOnly, parseDateOnly } from "@/lib/date"

function canManageTeachingHours(user: { role?: string; permissions?: string[] } | null | undefined) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role || "")
    || hasPermission(user as { role: string; permissions?: string[] } | null | undefined, PERMISSIONS.MANAGE_TEACHERS)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!canManageTeachingHours(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })

  if (!year) {
    return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })
  }

  const url = new URL(req.url)
  const date = parseDateOnly(url.searchParams.get("date"))

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
    },
    orderBy: [
      { teacher: { user: { name: "asc" } } },
      { classroom: { name: "asc" } },
      { subject: { nameAr: "asc" } },
    ],
  })

  const teacherIds = Array.from(new Set(assignments.map((assignment) => assignment.teacherId)))
  const assignmentIds = assignments.map((assignment) => assignment.id)

  const [attendanceRecords, existingEntries] = await Promise.all([
    prisma.teacherAttendance.findMany({
      where: { teacherId: { in: teacherIds }, date },
      select: { teacherId: true, status: true },
    }),
    prisma.teachingHourEntry.findMany({
      where: { teacherAssignmentId: { in: assignmentIds }, date },
      include: { recordedByUser: { select: { id: true, name: true } } },
    }),
  ])

  const attendanceByTeacher = new Map(
    attendanceRecords.map((record) => [record.teacherId, record.status])
  )
  const entriesByAssignment = new Map(
    existingEntries.map((entry) => [entry.teacherAssignmentId, entry])
  )

  const rows = assignments.map((assignment) => {
    const entry = entriesByAssignment.get(assignment.id)

    return {
      teacherAssignmentId: assignment.id,
      teacherId: assignment.teacherId,
      teacherName: assignment.teacher.user.name,
      subjectName: assignment.subject.nameAr,
      subjectCode: assignment.subject.code,
      classroomName: assignment.classroom.name,
      levelName: assignment.classroom.level.name,
      streamName: assignment.classroom.stream?.name ?? null,
      hourlyRate: assignment.hourlyRate,
      weeklyHours: assignment.weeklyHours,
      attendanceStatus: attendanceByTeacher.get(assignment.teacherId) ?? null,
      hoursTaught: entry?.hoursTaught ?? 0,
      notes: entry?.notes ?? "",
      recordedBy: entry?.recordedByUser?.name ?? null,
    }
  })

  return NextResponse.json({
    date: formatDateOnly(date),
    academicYear: { id: year.id, name: year.name },
    rows,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!canManageTeachingHours(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const date = parseDateOnly(body.date)
  const entries = Array.isArray(body.entries) ? body.entries : []

  if (entries.length === 0) {
    return NextResponse.json({ error: "لا توجد بيانات للحفظ" }, { status: 400 })
  }

  const assignmentIds: string[] = Array.from(
    new Set<string>(
      entries
        .map((entry: { teacherAssignmentId?: string }) => entry.teacherAssignmentId)
        .filter((id: string | undefined): id is string => typeof id === "string" && id.length > 0)
    )
  )

  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      id: { in: assignmentIds },
      schoolId: user.schoolId,
      isActive: true,
      academicYear: { isActive: true },
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
    },
  })

  const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment]))

  if (assignmentMap.size !== assignmentIds.length) {
    return NextResponse.json({ error: "بعض التكليفات غير صالحة" }, { status: 400 })
  }

  const teacherIds = Array.from(new Set(assignments.map((assignment) => assignment.teacherId)))
  const attendanceRecords = await prisma.teacherAttendance.findMany({
    where: { teacherId: { in: teacherIds }, date },
    select: { teacherId: true, status: true },
  })
  const attendanceByTeacher = new Map(
    attendanceRecords.map((record) => [record.teacherId, record.status])
  )

  const invalidEntry = entries.find((entry: { teacherAssignmentId: string; hoursTaught?: number | string }) => {
    const assignment = assignmentMap.get(entry.teacherAssignmentId)
    const hours = Number(entry.hoursTaught ?? 0)
    if (!assignment || Number.isNaN(hours) || hours < 0 || hours > 24) {
      return true
    }

    return hours > 0 && attendanceByTeacher.get(assignment.teacherId) === "ABSENT"
  })

  if (invalidEntry) {
    const assignment = assignmentMap.get(invalidEntry.teacherAssignmentId)
    if (!assignment) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })
    }

    const hours = Number(invalidEntry.hoursTaught ?? 0)
    if (Number.isNaN(hours) || hours < 0 || hours > 24) {
      return NextResponse.json({ error: "عدد الساعات يجب أن يكون بين 0 و24" }, { status: 400 })
    }

    return NextResponse.json(
      { error: `لا يمكن تسجيل ساعات للأستاذ ${assignment.teacher.user.name} وهو مسجل غائباً في هذا اليوم` },
      { status: 400 }
    )
  }

  const operations = entries.map((entry: { teacherAssignmentId: string; hoursTaught?: number | string; notes?: string }) => {
    const hours = Number(entry.hoursTaught ?? 0)
    const notes = typeof entry.notes === "string" ? entry.notes.trim() : ""

    if (hours <= 0 && !notes) {
      return prisma.teachingHourEntry.deleteMany({
        where: { teacherAssignmentId: entry.teacherAssignmentId, date },
      })
    }

    return prisma.teachingHourEntry.upsert({
      where: {
        teacherAssignmentId_date: {
          teacherAssignmentId: entry.teacherAssignmentId,
          date,
        },
      },
      update: {
        hoursTaught: hours,
        notes: notes || null,
        recordedByUserId: user.id,
      },
      create: {
        schoolId: user.schoolId,
        teacherAssignmentId: entry.teacherAssignmentId,
        date,
        hoursTaught: hours,
        notes: notes || null,
        recordedByUserId: user.id,
      },
    })
  })

  await prisma.$transaction(operations)

  return NextResponse.json({
    success: true,
    saved: entries.length,
    date: formatDateOnly(date),
  })
}

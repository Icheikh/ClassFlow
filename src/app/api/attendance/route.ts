import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { notifySchoolManagers } from "@/lib/operational-notifications"

const legacyRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]

function canAccessAttendance(user: any) {
  return legacyRoles.includes(user?.role) || hasAnyPermission(user, [PERMISSIONS.REVIEW_LESSONS, PERMISSIONS.MANAGE_STUDENTS])
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessAttendance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { scheduleId, date, records } = body
  let { classroomId, subjectId } = body

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })
  if (!activeYear) return NextResponse.json({ error: "No active academic year" }, { status: 400 })

  let teacherId: string
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 })
    teacherId = teacher.id
  } else {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { classroomId, subjectId, schoolId: user.schoolId, academicYearId: activeYear.id },
    })
    teacherId = assignment?.teacherId || ""
    if (!teacherId) return NextResponse.json({ error: "No teacher assigned" }, { status: 404 })
  }

  let schedule: {
    id: string
    classroomId: string
    subjectId: string
    teacherId: string | null
    startTime: string
    endTime: string
  } | null = null

  if (scheduleId) {
    schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        schoolId: user.schoolId,
        teacherId,
      },
      select: {
        id: true,
        classroomId: true,
        subjectId: true,
        teacherId: true,
        startTime: true,
        endTime: true,
      },
    })
    if (!schedule) return NextResponse.json({ error: "الحصة غير موجودة في جدول الأستاذ" }, { status: 404 })
    classroomId = schedule.classroomId
    subjectId = schedule.subjectId
  }

  if (!classroomId || !subjectId || !Array.isArray(records)) {
    return NextResponse.json({ error: "بيانات الغياب غير مكتملة" }, { status: 400 })
  }

  const normalizedRecords = records.map((record: { studentId: string; status: string }) => ({
    studentId: record.studentId,
    status: String(record.status).toUpperCase() === "ABSENT" ? "ABSENT" : "PRESENT",
  }))

  const attendanceDate = new Date(date)

  await Promise.all(
    normalizedRecords.map(async (record: { studentId: string; status: string }) => {
      const existing = await prisma.attendance.findFirst({
        where: scheduleId
          ? { studentId: record.studentId, date: attendanceDate, scheduleId }
          : { studentId: record.studentId, date: attendanceDate, subjectId },
        select: { id: true },
      })

      if (existing) {
        return prisma.attendance.update({
          where: { id: existing.id },
          data: { status: record.status, teacherId, scheduleId: scheduleId || null },
        })
      }

      return prisma.attendance.create({
        data: {
          schoolId: user.schoolId, academicYearId: activeYear.id,
          studentId: record.studentId, classroomId, subjectId, teacherId,
          scheduleId: scheduleId || null,
          status: record.status, date: attendanceDate,
        },
      })
    })
  )

  const absentStudents = normalizedRecords.filter((r: { status: string }) => {
    const status = String(r.status).toUpperCase()
    return status === "ABSENT"
  })
  const notificationEntityId = scheduleId || `${classroomId}:${subjectId}:${new Date(date).toISOString().split("T")[0]}`
  if (absentStudents.length > 0) {
    const [classroom, subject, teacher] = await Promise.all([
      prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { name: true },
      }),
      prisma.subject.findUnique({
        where: { id: subjectId },
        select: { nameAr: true, nameFr: true },
      }),
      prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { user: { select: { name: true } } },
      }),
    ])

    const absentCount = absentStudents.length
    const dateLabel = new Date(date).toLocaleDateString("ar-MR")
    const timeLabel = schedule ? ` من ${schedule.startTime} إلى ${schedule.endTime}` : ""

    try {
      await notifySchoolManagers({
        schoolId: user.schoolId,
        type: "ATTENDANCE_RECORDED",
        entityType: "ATTENDANCE",
        entityId: notificationEntityId,
        actionUrl: `/school/classrooms/${classroomId}`,
        title: `غياب مسجل في ${classroom?.name || "القسم"}`,
        message: `سجل ${teacher?.user.name || "الأستاذ"} غياب ${subject?.nameAr || "المادة"} بتاريخ ${dateLabel}${timeLabel}. الغياب: ${absentCount}.`,
        metadata: {
          scheduleId: scheduleId || null,
          classroomId,
          classroomName: classroom?.name || null,
          subjectId,
          subjectName: subject?.nameAr || null,
          teacherId,
          teacherName: teacher?.user.name || null,
          date: new Date(date).toISOString(),
          startTime: schedule?.startTime || null,
          endTime: schedule?.endTime || null,
          absentCount,
          lateCount: 0,
          studentIds: absentStudents.map((record: { studentId: string }) => record.studentId),
          parentTitle: `غياب أو تأخر في ${classroom?.name || "القسم"}`,
          parentMessage: `تم تسجيل غياب بتاريخ ${dateLabel}${timeLabel} في مادة ${subject?.nameAr || "المادة"}. يرجى التواصل مع الإدارة عند الحاجة.`,
        },
      })
    } catch (error) {
      console.error("Attendance manager notification creation failed:", error)
    }
  } else {
    await prisma.notification.updateMany({
      where: {
        schoolId: user.schoolId,
        entityType: "ATTENDANCE",
        entityId: notificationEntityId,
        status: "PENDING",
      },
      data: {
        status: "RESOLVED",
        read: true,
      },
    })
  }

  return NextResponse.json({ success: true, count: normalizedRecords.length })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const subjectId = url.searchParams.get("subjectId")
  const scheduleId = url.searchParams.get("scheduleId")
  const date = url.searchParams.get("date") || new Date().toISOString()

  const records = await prisma.attendance.findMany({
    where: {
      schoolId: user.schoolId,
      ...(scheduleId && { scheduleId }),
      ...(classroomId && { classroomId }),
      ...(subjectId && { subjectId }),
      date: new Date(date),
    },
    include: { student: true },
  })

  return NextResponse.json(records)
}

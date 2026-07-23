import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"

const legacyRoles = ["SCHOOL_ADMIN", "SUPERVISOR", "STAFF"]

function canViewClassroomJournal(user: any) {
  return legacyRoles.includes(user?.role) || hasAnyPermission(user, [PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.REVIEW_LESSONS])
}

function getDayBounds(date: string) {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  return { dayStart, dayEnd }
}

function getDateDayOfWeek(date: string) {
  return new Date(`${date}T12:00:00`).getDay()
}

function compareStudentNumbers(first?: string | null, second?: string | null) {
  const firstNumber = Number(first)
  const secondNumber = Number(second)
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) return firstNumber - secondNumber
  if (Number.isFinite(firstNumber)) return -1
  if (Number.isFinite(secondNumber)) return 1
  return String(first || "").localeCompare(String(second || ""))
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canViewClassroomJournal(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0]
  const { dayStart, dayEnd } = getDayBounds(date)
  const dayOfWeek = getDateDayOfWeek(date)

  const classroom = await prisma.classroom.findFirst({
    where: { id: params.id, schoolId: user.schoolId },
    select: { id: true, name: true },
  })
  if (!classroom) return NextResponse.json({ error: "القسم غير موجود" }, { status: 404 })

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
    select: { id: true },
  })

  const [schedules, enrollments] = await Promise.all([
    prisma.schedule.findMany({
      where: { schoolId: user.schoolId, classroomId: params.id, dayOfWeek },
      include: {
        subject: { select: { id: true, nameAr: true, nameFr: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.enrollment.findMany({
      where: {
        schoolId: user.schoolId,
        classroomId: params.id,
        status: "ACTIVE",
        ...(activeYear && { academicYearId: activeYear.id }),
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentNumber: true },
        },
      },
    }),
  ])

  const sortedEnrollments = enrollments.sort((first, second) => {
    const byNumber = compareStudentNumbers(first.student.studentNumber, second.student.studentNumber)
    if (byNumber !== 0) return byNumber
    return `${first.student.firstName} ${first.student.lastName}`.localeCompare(`${second.student.firstName} ${second.student.lastName}`)
  })

  const studentOrder = new Map(
    sortedEnrollments.map((enrollment, index) => [
      enrollment.student.id,
      {
        number: enrollment.student.studentNumber || String(index + 1),
        name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      },
    ])
  )

  const scheduleIds = schedules.map((schedule) => schedule.id)
  const [attendanceRecords, lessons] = scheduleIds.length
    ? await Promise.all([
        prisma.attendance.findMany({
          where: {
            schoolId: user.schoolId,
            classroomId: params.id,
            scheduleId: { in: scheduleIds },
            date: { gte: dayStart, lt: dayEnd },
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
          },
        }),
        prisma.lesson.findMany({
          where: {
            schoolId: user.schoolId,
            classroomId: params.id,
            scheduleId: { in: scheduleIds },
            date: { gte: dayStart, lt: dayEnd },
          },
          orderBy: { createdAt: "asc" },
        }),
      ])
    : [[], []]

  const attendanceBySchedule = new Map<string, typeof attendanceRecords>()
  for (const record of attendanceRecords) {
    if (!record.scheduleId) continue
    attendanceBySchedule.set(record.scheduleId, [...(attendanceBySchedule.get(record.scheduleId) || []), record])
  }

  const lessonsBySchedule = new Map<string, typeof lessons>()
  for (const lesson of lessons) {
    if (!lesson.scheduleId) continue
    lessonsBySchedule.set(lesson.scheduleId, [...(lessonsBySchedule.get(lesson.scheduleId) || []), lesson])
  }

  const sessions = schedules.map((schedule) => {
    const sessionAttendance = attendanceBySchedule.get(schedule.id) || []
    const absentRecords = sessionAttendance.filter((record) => record.status === "ABSENT")
    const sessionLessons = lessonsBySchedule.get(schedule.id) || []

    return {
      id: schedule.id,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      subject: schedule.subject,
      teacher: schedule.teacher,
      attendance: {
        recorded: sessionAttendance.length > 0,
        totalRecords: sessionAttendance.length,
        presentCount: sessionAttendance.filter((record) => record.status === "PRESENT").length,
        absentCount: absentRecords.length,
        absentStudents: absentRecords
          .map((record) => {
            const orderedStudent = studentOrder.get(record.studentId)
            return {
              id: record.studentId,
              number: orderedStudent?.number || record.student.studentNumber || "",
              name: orderedStudent?.name || `${record.student.firstName} ${record.student.lastName}`,
            }
          })
          .sort((first, second) => compareStudentNumbers(first.number, second.number)),
      },
      lessons: {
        recorded: sessionLessons.length > 0,
        count: sessionLessons.length,
        items: sessionLessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          homework: lesson.homework,
          notes: lesson.notes,
          duration: lesson.duration,
          status: lesson.status,
          date: lesson.date,
        })),
      },
    }
  })

  return NextResponse.json({
    date,
    classroom,
    studentsCount: sortedEnrollments.length,
    summary: {
      totalSessions: sessions.length,
      attendanceRecorded: sessions.filter((session) => session.attendance.recorded).length,
      lessonsRecorded: sessions.filter((session) => session.lessons.recorded).length,
      absentCount: sessions.reduce((total, session) => total + session.attendance.absentCount, 0),
    },
    sessions,
  })
}

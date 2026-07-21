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
  const { classroomId, subjectId, date, records } = body

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

  await Promise.all(
    records.map((record: { studentId: string; status: string }) =>
      prisma.attendance.upsert({
        where: { studentId_date_subjectId: { studentId: record.studentId, date: new Date(date), subjectId } },
        update: { status: record.status, teacherId },
        create: {
          schoolId: user.schoolId, academicYearId: activeYear.id,
          studentId: record.studentId, classroomId, subjectId, teacherId,
          status: record.status, date: new Date(date),
        },
      })
    )
  )

  const absentStudents = records.filter((r: { status: string }) => {
    const status = String(r.status).toUpperCase()
    return status === "ABSENT" || status === "LATE"
  })
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

    const absentCount = absentStudents.filter((record: { status: string }) => String(record.status).toUpperCase() === "ABSENT").length
    const lateCount = absentStudents.filter((record: { status: string }) => String(record.status).toUpperCase() === "LATE").length
    const dateLabel = new Date(date).toLocaleDateString("ar-MR")

    try {
      await notifySchoolManagers({
        schoolId: user.schoolId,
        type: "ATTENDANCE_RECORDED",
        entityType: "ATTENDANCE",
        entityId: `${classroomId}:${subjectId}:${new Date(date).toISOString().split("T")[0]}`,
        actionUrl: `/school/classrooms/${classroomId}`,
        title: `غياب مسجل في ${classroom?.name || "القسم"}`,
        message: `سجل ${teacher?.user.name || "الأستاذ"} حضور ${subject?.nameAr || "المادة"} بتاريخ ${dateLabel}. الغياب: ${absentCount}، التأخر: ${lateCount}.`,
        metadata: {
          classroomId,
          classroomName: classroom?.name || null,
          subjectId,
          subjectName: subject?.nameAr || null,
          teacherId,
          teacherName: teacher?.user.name || null,
          date: new Date(date).toISOString(),
          absentCount,
          lateCount,
          studentIds: absentStudents.map((record: { studentId: string }) => record.studentId),
          parentTitle: `غياب أو تأخر في ${classroom?.name || "القسم"}`,
          parentMessage: `تم تسجيل غياب أو تأخر بتاريخ ${dateLabel} في مادة ${subject?.nameAr || "المادة"}. يرجى التواصل مع الإدارة عند الحاجة.`,
        },
      })
    } catch (error) {
      console.error("Attendance manager notification creation failed:", error)
    }
  }

  return NextResponse.json({ success: true, count: records.length })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const subjectId = url.searchParams.get("subjectId")
  const date = url.searchParams.get("date") || new Date().toISOString()

  const records = await prisma.attendance.findMany({
    where: {
      schoolId: user.schoolId,
      ...(classroomId && { classroomId }),
      ...(subjectId && { subjectId }),
      date: new Date(date),
    },
    include: { student: true },
  })

  return NextResponse.json(records)
}

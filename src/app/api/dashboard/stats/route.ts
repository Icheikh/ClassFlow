import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT", "SCHOOL_ADMIN", "TEACHER"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.VIEW_REPORTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const schoolId = user.schoolId
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  })

  const [students, teachers, classrooms, todayAbsences] = await Promise.all([
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.teacher.count({ where: { schoolId } }),
    prisma.classroom.count({ where: { schoolId } }),
    prisma.attendance.count({
      where: { schoolId, status: "absent", date: { gte: today } },
    }),
  ])

  const activeEnrollments = activeYear
    ? await prisma.enrollment.count({ where: { schoolId, academicYearId: activeYear.id, status: "ACTIVE" } })
    : 0

  return NextResponse.json({
    students,
    teachers,
    classrooms,
    todayAbsences,
    activeEnrollments,
  })
}
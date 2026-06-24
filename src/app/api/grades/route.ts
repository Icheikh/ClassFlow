import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

const legacyRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]

function canAccessGrades(user: any) {
  return legacyRoles.includes(user?.role) || hasPermission(user, PERMISSIONS.APPROVE_GRADES)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessGrades(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { scores, assessmentType, label, classroomId, subjectId, termId } = body

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

  const grades = await Promise.all(
    scores.map((s: { studentId: string; score: number }) =>
      prisma.grade.create({
        data: {
          schoolId: user.schoolId, academicYearId: activeYear.id, termId,
          assessmentType, label, score: s.score, maxScore: 20, status: "DRAFT",
          studentId: s.studentId, subjectId, classroomId, teacherId,
        },
      })
    )
  )

  return NextResponse.json({ success: true, count: grades.length })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const subjectId = url.searchParams.get("subjectId")

  const grades = await prisma.grade.findMany({
    where: { schoolId: user.schoolId, ...(classroomId && { classroomId }), ...(subjectId && { subjectId }) },
    include: { student: true, subject: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return NextResponse.json(grades)
}
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
  const { scores, assessmentType, label, classroomId, subjectId } = body

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })
  if (!activeYear) return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })

  const activeTerm = await prisma.term.findFirst({
    where: { academicYearId: activeYear.id, isActive: true },
  })
  if (!activeTerm) return NextResponse.json({ error: "لا يوجد فصل دراسي نشط" }, { status: 400 })

  let teacherId: string
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "الأستاذ غير موجود" }, { status: 404 })
    teacherId = teacher.id
  } else {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { classroomId, subjectId, schoolId: user.schoolId, academicYearId: activeYear.id },
    })
    teacherId = assignment?.teacherId || ""
    if (!teacherId) return NextResponse.json({ error: "لا يوجد أستاذ مكلف" }, { status: 404 })
  }

  const grades = await Promise.all(
    scores.map((s: { studentId: string; score: number }) =>
      prisma.grade.create({
        data: {
          schoolId: user.schoolId, academicYearId: activeYear.id, termId: activeTerm.id,
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
  const assessmentLabel = url.searchParams.get("label")

  const where: any = { schoolId: user.schoolId }
  if (classroomId) where.classroomId = classroomId
  if (subjectId) where.subjectId = subjectId
  if (assessmentLabel) where.label = assessmentLabel

  const grades = await prisma.grade.findMany({
    where,
    include: { student: { select: { id: true, firstName: true, lastName: true } }, subject: { select: { id: true, nameAr: true } } },
    orderBy: [{ label: "desc" }, { student: { firstName: "asc" } }],
    take: 200,
  })

  // Group by assessment (label + type)
  const assessments = new Map<string, { label: string; type: string; date: string; scores: any[] }>()
  for (const g of grades) {
    const key = `${g.label}-${g.assessmentType}`
    if (!assessments.has(key)) {
      assessments.set(key, { label: g.label, type: g.assessmentType, date: g.date.toISOString(), scores: [] })
    }
    assessments.get(key)!.scores.push({ studentId: g.studentId, studentName: `${g.student.firstName} ${g.student.lastName}`, score: g.score, maxScore: g.maxScore, status: g.status })
  }

  return NextResponse.json({
    assessments: Array.from(assessments.values()),
    recent: grades.slice(0, 10).map((g) => ({ id: g.id, label: g.label, type: g.assessmentType, date: g.date, studentName: `${g.student.firstName} ${g.student.lastName}`, score: g.score, status: g.status })),
  })
}

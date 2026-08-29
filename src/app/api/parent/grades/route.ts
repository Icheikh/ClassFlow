import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id || user?.role !== "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parent = await prisma.parent.findUnique({ where: { userId: user.id } })
  if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get("studentId")
  const termId = searchParams.get("termId")

  const links = await prisma.studentParent.findMany({
    where: { parentId: parent.id },
    select: { studentId: true },
  })
  const childIds = links.map((l) => l.studentId)
  if (childIds.length === 0) return NextResponse.json({ children: [] })

  const targetIds = studentId && childIds.includes(studentId) ? [studentId] : childIds

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: parent.schoolId, isActive: true },
  })
  if (!activeYear) return NextResponse.json({ children: targetIds.map((id) => ({ studentId: id, subjects: [] })) })

  const activeTerms = await prisma.term.findMany({
    where: { academicYearId: activeYear.id },
    orderBy: { order: "asc" },
  })

  const targetTerm = termId
    ? activeTerms.find((t) => t.id === termId)
    : activeTerms.find((t) => t.isActive) || activeTerms[activeTerms.length - 1]

  if (!targetTerm) return NextResponse.json({ children: targetIds.map((id) => ({ studentId: id, subjects: [] })) })

  const enrolledClassroomIds = await prisma.enrollment.findMany({
    where: { studentId: { in: targetIds }, academicYearId: activeYear.id, status: "ACTIVE" },
    select: { studentId: true, classroomId: true },
  })

  const resultRule = await prisma.resultRule.findFirst({
    where: { schoolId: parent.schoolId, status: "PUBLISHED" },
  })

  const childrenResults = await Promise.all(
    targetIds.map(async (sid) => {
      const enrollment = enrolledClassroomIds.find((e) => e.studentId === sid)
      if (!enrollment) return { studentId: sid, subjects: [], average: null }

      const grades = await prisma.grade.findMany({
        where: { studentId: sid, academicYearId: activeYear.id, termId: targetTerm.id },
        include: { subject: { select: { id: true, nameAr: true } } },
      })

      const subjectIds = [...new Set(grades.map((g) => g.subjectId))]
      const subjects = await Promise.all(
        subjectIds.map(async (subjectId) => {
          const subjectGrades = grades.filter((g) => g.subjectId === subjectId)

          let average: number | null = null
          if (resultRule) {
            const normalizedScores = subjectGrades.map((g) => (g.score / g.maxScore) * 20)
            if (normalizedScores.length > 0) {
              average = Math.round((normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length) * 100) / 100
            }
          }

          return {
            subjectId,
            subjectName: subjectGrades[0]?.subject?.nameAr || "",
            average,
            grades: subjectGrades.map((g) => ({
              label: g.label,
              score: g.score,
              maxScore: g.maxScore,
              assessmentType: g.assessmentType,
              date: g.date,
            })),
          }
        })
      )

      const validAverages = subjects.filter((s) => s.average !== null).map((s) => s.average as number)
      const classAverage = validAverages.length > 0
        ? Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 100) / 100
        : null

      return { studentId: sid, subjects, average: classAverage }
    })
  )

  return NextResponse.json({
    activeYear: { id: activeYear.id, name: activeYear.name },
    term: { id: targetTerm.id, name: targetTerm.name, order: targetTerm.order },
    terms: activeTerms.map((t) => ({ id: t.id, name: t.name, order: t.order, isActive: t.isActive })),
    children: childrenResults,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { computeClassroomResults, resolveCoefficient } from "@/lib/results"
import { ensurePublishedResultRule } from "@/lib/result-rules"
import { generateResultReportPDF } from "@/lib/pdf-report"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!session || !user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasPermission(user, PERMISSIONS.VIEW_REPORTS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const termId = url.searchParams.get("termId")

  if (!classroomId) {
    return NextResponse.json({ error: "classroomId مطلوب" }, { status: 400 })
  }

  // Get active year
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId!, isActive: true },
    include: {
      terms: { where: { isActive: true }, orderBy: { order: "asc" }, take: 1 },
    },
  })
  if (!activeYear) {
    return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })
  }

  const activeTerm = termId
    ? await prisma.term.findFirst({ where: { id: termId, academicYearId: activeYear.id } })
    : activeYear.terms[0]

  if (!activeTerm) {
    return NextResponse.json({ error: "لا يوجد فصل نشط" }, { status: 400 })
  }

  // Get classroom
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, schoolId: user.schoolId! },
    include: { level: true, stream: true },
  })
  if (!classroom) {
    return NextResponse.json({ error: "القسم غير موجود" }, { status: 404 })
  }

  // Get enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: {
      schoolId: user.schoolId!,
      classroomId,
      academicYearId: activeYear.id,
      status: "ACTIVE",
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
  })

  const students = enrollments.map((e) => ({
    id: e.student.id,
    firstName: e.student.firstName,
    lastName: e.student.lastName,
  }))

  // Get assessments up to active term
  const calculationTerms = await prisma.term.findMany({
    where: {
      schoolId: user.schoolId!,
      academicYearId: activeYear.id,
      order: { lte: activeTerm.order },
    },
    select: { id: true },
  })

  const assessments = await prisma.assessment.findMany({
    where: {
      schoolId: user.schoolId!,
      academicYearId: activeYear.id,
      termId: { in: calculationTerms.map((t) => t.id) },
      classroomId,
    },
    include: {
      subject: { select: { id: true, nameAr: true } },
      term: { select: { order: true } },
      scores: { select: { studentId: true, score: true } },
    },
  })

  const normalizedAssessments = assessments.map((a) => ({
    subjectId: a.subjectId,
    type: a.type,
    termOrder: a.term.order,
    maxScore: a.maxScore,
    scores: a.scores.map((s) => ({ studentId: s.studentId, score: s.score })),
  }))

  // Get coefficients
  const coefficients = await prisma.subjectCoefficient.findMany({
    where: {
      schoolId: user.schoolId!,
      academicYearId: activeYear.id,
      classroomId,
    },
    select: {
      subjectId: true,
      levelId: true,
      streamId: true,
      classroomId: true,
      coefficient: true,
    },
  })

  const resultRule = await ensurePublishedResultRule(prisma, user.schoolId!)

  // Compute results
  const results = computeClassroomResults({
    students,
    assessments: normalizedAssessments,
    coefficients,
    classroomId,
    levelId: classroom.levelId,
    streamId: classroom.streamId,
    rule: resultRule,
    termOrder: activeTerm.order,
  })

  // Get subject names
  const subjectIds = [...new Set(assessments.map((a) => a.subjectId))]
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, nameAr: true },
  })
  const subjectNameMap = new Map(subjects.map((s) => [s.id, s.nameAr]))

  // Build PDF data
  const pdfStudents = results.map((row) => ({
    rank: row.rank || 0,
    studentName: row.studentName,
    average: row.average,
    subjects: row.subjectResults.map((sr) => ({
      subjectName: subjectNameMap.get(sr.subjectId) || sr.subjectId,
      coefficient: sr.coefficient,
      testAverage: sr.testAverage,
      examAverage: sr.exam1Average,
      finalAverage: sr.finalAverage,
      weightedScore: sr.weightedScore,
    })),
  }))

  const pdfData = {
    schoolName: "مدرستي",
    classroomName: classroom.name,
    levelName: `${classroom.level.name}${classroom.stream ? ` — ${classroom.stream.name}` : ""}`,
    termName: activeTerm.name,
    academicYearName: activeYear.name,
    subjectNames: subjectIds.map((id) => subjectNameMap.get(id) || id),
    students: pdfStudents,
    generatedAt: new Date().toLocaleDateString("ar-MR"),
  }

  // Try to get school name
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId! },
    select: { name: true },
  })
  if (school?.name) pdfData.schoolName = school.name

  const pdfBuffer = generateResultReportPDF(pdfData)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${classroom.name}-${activeTerm.name}.pdf"`,
    },
  })
}

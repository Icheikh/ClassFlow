import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import {
  ASSESSMENT_TYPES,
  buildTermAssessmentPolicyNote,
  buildTermCalculationNote,
  computeSubjectAverage,
  getTermAssessmentRequirements,
  isAssessmentTypeAllowedForTerm,
  RESULT_PUBLICATION_STATUSES,
} from "@/lib/results"
import { createResultAuditLog, ensurePublishedResultRule, serializeRule } from "@/lib/result-rules"

function getAllowedAssessmentError(termName: string, termOrder: number) {
  return `في ${termName} يسمح فقط بالاختبارات و${termOrder === 1 ? "الامتحان الأول" : termOrder === 2 ? "الامتحان الثاني" : "الامتحان الأخير"}`
}

const legacyRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR", "STAFF"]

function canAccessGrades(user: any) {
  return legacyRoles.includes(user?.role) || hasPermission(user, PERMISSIONS.APPROVE_GRADES)
}

const ALLOWED_ASSESSMENT_TYPES = new Set(Object.values(ASSESSMENT_TYPES))

async function getActiveYearAndTerm(schoolId: string, termId?: string | null) {
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  })
  if (!activeYear) return { error: "لا توجد سنة دراسية نشطة" }

  const activeTerm = termId
    ? await prisma.term.findFirst({
        where: { id: termId, academicYearId: activeYear.id, schoolId },
      })
    : await prisma.term.findFirst({
        where: { academicYearId: activeYear.id, isActive: true },
      })

  if (!activeTerm) return { error: "لا يوجد فصل دراسي نشط" }

  return { activeYear, activeTerm }
}

async function getTeacherId(user: any) {
  if (user.role !== "TEACHER") return null
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
  return teacher?.id || null
}

async function ensureAssignmentAccess(options: {
  user: any
  academicYearId: string
  classroomId: string
  subjectId: string
}) {
  if (options.user.role !== "TEACHER") return { allowed: true as const, teacherId: null }

  const teacherId = await getTeacherId(options.user)
  if (!teacherId) {
    return { allowed: false as const, error: "الأستاذ غير موجود" }
  }

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId: options.user.schoolId,
      academicYearId: options.academicYearId,
      classroomId: options.classroomId,
      subjectId: options.subjectId,
      teacherId,
      isActive: true,
    },
    select: { id: true },
  })

  if (!assignment) {
    return { allowed: false as const, error: "غير مسموح لك بإدخال نقاط هذه المادة لهذا القسم" }
  }

  return { allowed: true as const, teacherId }
}

async function getResultPublication(options: {
  schoolId: string
  academicYearId: string
  termId: string
  classroomId: string
}) {
  const publication = await prisma.resultPublication.findUnique({
    where: {
      academicYearId_termId_classroomId: {
        academicYearId: options.academicYearId,
        termId: options.termId,
        classroomId: options.classroomId,
      },
    },
  })

  return publication
}

async function ensurePublicationIsEditable(options: {
  user: any
  schoolId: string
  academicYearId: string
  termId: string
  classroomId: string
}) {
  const publication = await getResultPublication(options)
  if (publication?.status === RESULT_PUBLICATION_STATUSES.LOCKED) {
    if (options.user?.role === "SCHOOL_ADMIN") {
      return { editable: true as const, publication, overrideLockedPublication: true }
    }
    return { editable: false as const, error: "تم قفل نتائج هذا القسم لهذا الفصل" }
  }
  return { editable: true as const, publication, overrideLockedPublication: false }
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
  const {
    scores,
    assessmentType,
    title,
    classroomId,
    subjectId,
    termId,
    maxScore,
    date,
  } = body

  if (!classroomId || !subjectId || !assessmentType || !title || !Array.isArray(scores) || scores.length === 0) {
    return NextResponse.json({ error: "بيانات التقويم غير مكتملة" }, { status: 400 })
  }
  if (!ALLOWED_ASSESSMENT_TYPES.has(assessmentType)) {
    return NextResponse.json({ error: "نوع التقويم غير صالح" }, { status: 400 })
  }

  const context = await getActiveYearAndTerm(user.schoolId, termId)
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: 400 })
  }

  const calculationTerms = await prisma.term.findMany({
    where: {
      schoolId: user.schoolId,
      academicYearId: context.activeYear.id,
      order: { lte: context.activeTerm.order },
    },
    select: { id: true },
  })
  const calculationTermIds = calculationTerms.map((term) => term.id)
  if (!isAssessmentTypeAllowedForTerm(assessmentType, context.activeTerm.order)) {
    return NextResponse.json({ error: getAllowedAssessmentError(context.activeTerm.name, context.activeTerm.order) }, { status: 400 })
  }

  const access = await ensureAssignmentAccess({
    user,
    academicYearId: context.activeYear.id,
    classroomId,
    subjectId,
  })
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: 403 })
  }

  const publicationState = await ensurePublicationIsEditable({
    user,
    schoolId: user.schoolId,
    academicYearId: context.activeYear.id,
    termId: context.activeTerm.id,
    classroomId,
  })
  if (!publicationState.editable) {
    return NextResponse.json({ error: publicationState.error }, { status: 400 })
  }

  const parsedMaxScore = Number.parseFloat(String(maxScore || 20))
  if (!Number.isFinite(parsedMaxScore) || parsedMaxScore <= 0) {
    return NextResponse.json({ error: "الدرجة القصوى غير صالحة" }, { status: 400 })
  }

  const invalidScore = scores.find((row: { score: number }) => !Number.isFinite(Number(row.score)))
  if (invalidScore) {
    return NextResponse.json({ error: "كل النقاط يجب أن تكون أرقاماً صحيحة" }, { status: 400 })
  }

  const teacherId = access.teacherId || (
    await prisma.teacherAssignment.findFirst({
      where: {
        schoolId: user.schoolId,
        academicYearId: context.activeYear.id,
        classroomId,
        subjectId,
        isActive: true,
      },
      select: { teacherId: true },
    })
  )?.teacherId

  if (!teacherId) {
    return NextResponse.json({ error: "لا يوجد أستاذ مكلف بهذه المادة لهذا القسم" }, { status: 404 })
  }

  const assessment = await prisma.assessment.create({
    data: {
      schoolId: user.schoolId,
      academicYearId: context.activeYear.id,
      termId: context.activeTerm.id,
      classroomId,
      subjectId,
      teacherId,
      type: assessmentType,
      title,
      maxScore: parsedMaxScore,
      status: "DRAFT",
      date: date ? new Date(date) : new Date(),
      scores: {
        create: scores.map((row: { studentId: string; score: number }) => ({
          schoolId: user.schoolId,
          studentId: row.studentId,
          score: Number(row.score),
          status: "DRAFT",
        })),
      },
    },
    include: {
      scores: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  })

  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: publicationState.overrideLockedPublication ? "ASSESSMENT_OVERRIDE" : "ASSESSMENT",
    entityId: assessment.id,
    action: "CREATE",
    description: publicationState.overrideLockedPublication
      ? `إنشاء تقويم جديد رغم قفل النتائج للقسم ${classroomId}`
      : `إنشاء تقويم جديد للقسم ${classroomId}`,
    before: null,
    after: {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      classroomId: assessment.classroomId,
      subjectId: assessment.subjectId,
      scoreCount: assessment.scores.length,
    },
  })

  return NextResponse.json(assessment)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canAccessGrades(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, title, assessmentType, maxScore, date, scores } = body

  if (!id || !title || !assessmentType || !Array.isArray(scores) || scores.length === 0) {
    return NextResponse.json({ error: "بيانات التعديل غير مكتملة" }, { status: 400 })
  }
  if (!ALLOWED_ASSESSMENT_TYPES.has(assessmentType)) {
    return NextResponse.json({ error: "نوع التقويم غير صالح" }, { status: 400 })
  }

  const existing = await prisma.assessment.findFirst({
    where: { id, schoolId: user.schoolId },
    include: { scores: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "التقويم غير موجود" }, { status: 404 })
  }

  const access = await ensureAssignmentAccess({
    user,
    academicYearId: existing.academicYearId,
    classroomId: existing.classroomId,
    subjectId: existing.subjectId,
  })
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: 403 })
  }

  const term = await prisma.term.findUnique({
    where: { id: existing.termId },
    select: { id: true, name: true, order: true },
  })
  if (!term) {
    return NextResponse.json({ error: "الفصل الدراسي غير موجود" }, { status: 404 })
  }
  if (!isAssessmentTypeAllowedForTerm(assessmentType, term.order)) {
    return NextResponse.json({ error: getAllowedAssessmentError(term.name, term.order) }, { status: 400 })
  }

  const publicationState = await ensurePublicationIsEditable({
    user,
    schoolId: user.schoolId,
    academicYearId: existing.academicYearId,
    termId: existing.termId,
    classroomId: existing.classroomId,
  })
  if (!publicationState.editable) {
    return NextResponse.json({ error: publicationState.error }, { status: 400 })
  }

  const parsedMaxScore = Number.parseFloat(String(maxScore || existing.maxScore))
  if (!Number.isFinite(parsedMaxScore) || parsedMaxScore <= 0) {
    return NextResponse.json({ error: "الدرجة القصوى غير صالحة" }, { status: 400 })
  }

  const invalidScore = scores.find((row: { score: number }) => !Number.isFinite(Number(row.score)))
  if (invalidScore) {
    return NextResponse.json({ error: "كل النقاط يجب أن تكون أرقاماً صحيحة" }, { status: 400 })
  }

  const scoreMap = new Map(scores.map((row: { studentId: string; score: number }) => [row.studentId, Number(row.score)]))

  const assessment = await prisma.$transaction(async (tx) => {
    const updatedAssessment = await tx.assessment.update({
      where: { id },
      data: {
        title,
        type: assessmentType,
        maxScore: parsedMaxScore,
        date: date ? new Date(date) : existing.date,
      },
    })

    for (const savedScore of existing.scores) {
      const nextScore = scoreMap.get(savedScore.studentId)
      if (nextScore == null) {
        await tx.assessmentScore.delete({ where: { id: savedScore.id } })
        continue
      }

      await tx.assessmentScore.update({
        where: { id: savedScore.id },
        data: { score: nextScore },
      })
      scoreMap.delete(savedScore.studentId)
    }

    for (const [studentId, score] of scoreMap.entries()) {
      await tx.assessmentScore.create({
        data: {
          schoolId: user.schoolId,
          assessmentId: id,
          studentId,
          score,
          status: existing.status,
        },
      })
    }

    return tx.assessment.findUnique({
      where: { id: updatedAssessment.id },
      include: {
        scores: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    })
  })

  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: publicationState.overrideLockedPublication ? "ASSESSMENT_OVERRIDE" : "ASSESSMENT",
    entityId: id,
    action: "UPDATE",
    description: publicationState.overrideLockedPublication
      ? `تعديل تقويم رغم قفل النتائج للقسم ${existing.classroomId}`
      : `تعديل تقويم للقسم ${existing.classroomId}`,
    before: {
      id: existing.id,
      title: existing.title,
      type: existing.type,
      maxScore: existing.maxScore,
      date: existing.date,
      scores: existing.scores.map((score) => ({ studentId: score.studentId, score: score.score })),
    },
    after: assessment,
  })

  return NextResponse.json(assessment)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canAccessGrades(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const subjectId = url.searchParams.get("subjectId")
  const termId = url.searchParams.get("termId")

  const context = await getActiveYearAndTerm(user.schoolId, termId)
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: 400 })
  }

  const calculationTerms = await prisma.term.findMany({
    where: {
      schoolId: user.schoolId,
      academicYearId: context.activeYear.id,
      order: { lte: context.activeTerm.order },
    },
    select: { id: true },
  })
  const calculationTermIds = calculationTerms.map((term) => term.id)

  const where: any = {
    schoolId: user.schoolId,
    academicYearId: context.activeYear.id,
    termId: context.activeTerm.id,
  }
  if (classroomId) where.classroomId = classroomId
  if (subjectId) where.subjectId = subjectId

  if (user.role === "TEACHER") {
    const teacherId = await getTeacherId(user)
    if (!teacherId) return NextResponse.json({ error: "الأستاذ غير موجود" }, { status: 404 })
    where.teacherId = teacherId
  }

  const progressWhere = {
    ...where,
    termId: { in: calculationTermIds },
  }

  const [assessments, progressAssessments, publication, classroom, enrollments, resultRule] = await Promise.all([
    prisma.assessment.findMany({
      where,
      include: {
        subject: { select: { id: true, nameAr: true } },
        classroom: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        scores: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    classroomId && subjectId
      ? prisma.assessment.findMany({
          where: progressWhere,
          include: {
            term: {
              select: {
                order: true,
              },
            },
            scores: {
              select: {
                studentId: true,
                score: true,
              },
            },
          },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
    classroomId
      ? getResultPublication({
          schoolId: user.schoolId,
          academicYearId: context.activeYear.id,
          termId: context.activeTerm.id,
          classroomId,
        })
      : Promise.resolve(null),
    classroomId
      ? prisma.classroom.findFirst({
          where: { id: classroomId, schoolId: user.schoolId },
          select: { id: true, name: true, levelId: true, streamId: true },
        })
      : Promise.resolve(null),
    classroomId
      ? prisma.enrollment.findMany({
          where: {
            schoolId: user.schoolId,
            classroomId,
            academicYearId: context.activeYear.id,
            status: "ACTIVE",
          },
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
        })
      : Promise.resolve([]),
    ensurePublishedResultRule(prisma, user.schoolId),
  ])

  const normalizedAssessments = progressAssessments.map((assessment) => ({
    subjectId: assessment.subjectId,
    type: assessment.type,
    termOrder: assessment.term.order,
    maxScore: assessment.maxScore,
    scores: assessment.scores.map((score) => ({
      studentId: score.studentId,
      score: score.score,
    })),
  }))

  const termRequirements = getTermAssessmentRequirements(resultRule, context.activeTerm.order)
  const typeCounts = termRequirements.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.type] = assessments.filter((assessment) => assessment.type === item.type).length
    return accumulator
  }, {})

  const requiredAssessments = termRequirements.map((item) => {
    const count = typeCounts[item.type] || 0
    return {
      ...item,
      count,
      ready: item.required ? count > 0 : true,
    }
  })

  const subjectProgress = classroom && subjectId
    ? enrollments.map((enrollment) => {
        const averages = computeSubjectAverage({
          assessments: normalizedAssessments,
          studentId: enrollment.student.id,
          rule: resultRule,
          termOrder: context.activeTerm.order,
        })

        return {
          studentId: enrollment.student.id,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          ...averages,
          ready: averages.finalAverage != null,
        }
      })
    : []

  return NextResponse.json({
    term: context.activeTerm,
    currentExamType: termRequirements.find((item) => item.type !== ASSESSMENT_TYPES.TEST)?.type || null,
    currentExamLabel: termRequirements.find((item) => item.type !== ASSESSMENT_TYPES.TEST)?.label || null,
    termCalculationNote: buildTermCalculationNote(resultRule, context.activeTerm.order),
    termPolicyNote: buildTermAssessmentPolicyNote(resultRule, context.activeTerm.order),
    resultRule: serializeRule(resultRule),
    publicationStatus: publication?.status || RESULT_PUBLICATION_STATUSES.OPEN,
    requiredAssessments,
    subjectProgress,
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      date: assessment.date.toISOString(),
      maxScore: assessment.maxScore,
      status: assessment.status,
      classroom: assessment.classroom,
      subject: assessment.subject,
      scores: assessment.scores.map((score) => ({
        id: score.id,
        studentId: score.studentId,
        studentName: `${score.student.firstName} ${score.student.lastName}`,
        score: score.score,
        status: score.status,
      })),
    })),
  })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canAccessGrades(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "معرف التقويم مطلوب" }, { status: 400 })
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id, schoolId: user.schoolId },
  })
  if (!assessment) {
    return NextResponse.json({ error: "التقويم غير موجود" }, { status: 404 })
  }

  const access = await ensureAssignmentAccess({
    user,
    academicYearId: assessment.academicYearId,
    classroomId: assessment.classroomId,
    subjectId: assessment.subjectId,
  })
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: 403 })
  }

  const publicationState = await ensurePublicationIsEditable({
    user,
    schoolId: user.schoolId,
    academicYearId: assessment.academicYearId,
    termId: assessment.termId,
    classroomId: assessment.classroomId,
  })
  if (!publicationState.editable) {
    return NextResponse.json({ error: publicationState.error }, { status: 400 })
  }

  const deletedAssessment = assessment
  await prisma.assessment.delete({ where: { id } })
  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: publicationState.overrideLockedPublication ? "ASSESSMENT_OVERRIDE" : "ASSESSMENT",
    entityId: id,
    action: "DELETE",
    description: publicationState.overrideLockedPublication
      ? `حذف تقويم رغم قفل النتائج للقسم ${assessment.classroomId}`
      : `حذف تقويم للقسم ${assessment.classroomId}`,
    before: deletedAssessment,
    after: null,
  })
  return NextResponse.json({ success: true })
}

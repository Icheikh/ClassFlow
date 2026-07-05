import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, hasPermission, PERMISSIONS } from "@/lib/permissions"
import {
  buildTermAssessmentPolicyNote,
  buildTermCalculationNote,
  computeClassroomPublicationReadiness,
  computeClassroomResults,
  RESULT_PUBLICATION_STATUSES,
} from "@/lib/results"
import { createResultAuditLog, ensurePublishedResultRule, serializeRule } from "@/lib/result-rules"
import {
  ensureActiveResultReportTemplate,
  renderResultReportTemplate,
  serializeResultReportTemplate,
} from "@/lib/result-report-templates"
import { createNotificationCampaign } from "@/lib/notifications"

const reviewRoles = ["SCHOOL_ADMIN", "STAFF", "SUPERVISOR"]

function canReviewResults(user: any) {
  return reviewRoles.includes(user?.role) || hasAnyPermission(user, [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.APPROVE_GRADES,
    PERMISSIONS.LOCK_GRADES,
  ])
}

async function getAcademicContext(schoolId: string, termId?: string | null) {
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
  })
  if (!activeYear) return { error: "لا توجد سنة دراسية نشطة" }

  const term = termId
    ? await prisma.term.findFirst({ where: { id: termId, schoolId, academicYearId: activeYear.id } })
    : await prisma.term.findFirst({ where: { schoolId, academicYearId: activeYear.id, isActive: true } })

  if (!term) return { error: "لا يوجد فصل دراسي نشط" }

  return { activeYear, term }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canReviewResults(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const termId = url.searchParams.get("termId")
  const templateId = url.searchParams.get("templateId")

  if (!classroomId) {
    return NextResponse.json({ error: "classroomId required" }, { status: 400 })
  }

  const context = await getAcademicContext(user.schoolId, termId)
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: 400 })
  }

  const calculationTerms = await prisma.term.findMany({
    where: {
      schoolId: user.schoolId,
      academicYearId: context.activeYear.id,
      order: { lte: context.term.order },
    },
    select: { id: true },
  })
  const calculationTermIds = calculationTerms.map((term) => term.id)

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, schoolId: user.schoolId },
    include: {
      level: { include: { stage: true } },
      stream: true,
    },
  })
  if (!classroom) {
    return NextResponse.json({ error: "القسم غير موجود" }, { status: 404 })
  }

  const calculationAssessmentWhere = {
    schoolId: user.schoolId,
    academicYearId: context.activeYear.id,
    classroomId,
    termId: { in: calculationTermIds },
  }

  const [school, enrollments, assessments, coefficients, publication, resultRule, activeTemplate] = await Promise.all([
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
      },
    }),
    prisma.enrollment.findMany({
      where: {
        schoolId: user.schoolId,
        academicYearId: context.activeYear.id,
        classroomId,
        status: "ACTIVE",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
    }),
    prisma.assessment.findMany({
      where: calculationAssessmentWhere,
      include: {
        term: { select: { order: true } },
        subject: { select: { id: true, nameAr: true, code: true } },
        scores: { select: { studentId: true, score: true } },
      },
      orderBy: [{ subject: { nameAr: "asc" } }, { date: "asc" }],
    }),
    prisma.subjectCoefficient.findMany({
      where: {
        schoolId: user.schoolId,
        academicYearId: context.activeYear.id,
        OR: [
          { classroomId },
          { levelId: classroom.levelId, streamId: classroom.streamId, classroomId: null },
          { levelId: classroom.levelId, streamId: null, classroomId: null },
        ],
      },
      select: {
        subjectId: true,
        levelId: true,
        streamId: true,
        classroomId: true,
        coefficient: true,
      },
    }),
    prisma.resultPublication.findUnique({
      where: {
        academicYearId_termId_classroomId: {
          academicYearId: context.activeYear.id,
          termId: context.term.id,
          classroomId,
        },
      },
    }),
    ensurePublishedResultRule(prisma, user.schoolId),
    ensureActiveResultReportTemplate(user.schoolId),
  ])

  const teacherAssignments = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      academicYearId: context.activeYear.id,
      classroomId,
      isActive: true,
    },
    select: {
      subject: {
        select: {
          id: true,
          nameAr: true,
          code: true,
        },
      },
    },
  })
  const assignedSubjects = Array.from(
    new Map(teacherAssignments.map((assignment) => [assignment.subject.id, assignment.subject])).values()
  )

  const results = computeClassroomResults({
    students: enrollments.map((enrollment) => enrollment.student),
    assessments: assessments.map((assessment) => ({
      subjectId: assessment.subjectId,
      type: assessment.type,
      termOrder: assessment.term.order,
      maxScore: assessment.maxScore,
      scores: assessment.scores,
    })),
    coefficients,
    classroomId,
    levelId: classroom.levelId,
    streamId: classroom.streamId,
    rule: resultRule,
    termOrder: context.term.order,
  })

  const subjectMap = new Map<string, { id: string; nameAr: string; code: string | null }>()
  for (const subject of assignedSubjects) {
    subjectMap.set(subject.id, subject)
  }
  for (const assessment of assessments) {
    subjectMap.set(assessment.subjectId, assessment.subject)
  }

  const readiness = computeClassroomPublicationReadiness({
    students: enrollments.map((enrollment) => enrollment.student),
    assessments: assessments.map((assessment) => ({
      subjectId: assessment.subjectId,
      type: assessment.type,
      termOrder: assessment.term.order,
      maxScore: assessment.maxScore,
      scores: assessment.scores,
    })),
    coefficients,
    classroomId,
    levelId: classroom.levelId,
    streamId: classroom.streamId,
    rule: resultRule,
    subjects: Array.from(subjectMap.values()).map((subject) => ({
      id: subject.id,
      nameAr: subject.nameAr,
    })),
    termOrder: context.term.order,
  })
  const computedRows = results.filter((row) => row.average != null)
  const classAverage = computedRows.length
    ? Math.round((computedRows.reduce((sum, row) => sum + (row.average || 0), 0) / computedRows.length) * 100) / 100
    : null

  const template =
    templateId && user.role === "SCHOOL_ADMIN"
      ? await prisma.resultReportTemplate.findFirst({
          where: { id: templateId, schoolId: user.schoolId },
        })
      : activeTemplate

  if (!template) {
    return NextResponse.json({ error: "لا يوجد قالب نتائج نشط" }, { status: 500 })
  }

  const serializedTemplate = serializeResultReportTemplate(template)
  const renderedTemplate = renderResultReportTemplate(serializedTemplate, {
    school: {
      name: school?.name || null,
      address: school?.address || null,
      phone: school?.phone || null,
    },
    classroom: {
      name: classroom.name,
      level: classroom.level,
      stream: classroom.stream,
    },
    term: context.term,
    resultRule: serializeRule(resultRule),
    stats: {
      students: results.length,
      classAverage,
    },
    publicationStatus: publication?.status || RESULT_PUBLICATION_STATUSES.OPEN,
  })

  return NextResponse.json({
    school: {
      id: school?.id || user.schoolId,
      name: school?.name || null,
      address: school?.address || null,
      phone: school?.phone || null,
    },
    template: renderedTemplate,
    classroom: {
      id: classroom.id,
      name: classroom.name,
      level: classroom.level,
      stream: classroom.stream,
    },
    term: context.term,
    termCalculationNote: buildTermCalculationNote(resultRule, context.term.order),
    termPolicyNote: buildTermAssessmentPolicyNote(resultRule, context.term.order),
    resultRule: serializeRule(resultRule),
    publicationStatus: publication?.status || RESULT_PUBLICATION_STATUSES.OPEN,
    publication: publication
      ? {
          id: publication.id,
          status: publication.status,
          approvedAt: publication.approvedAt,
          lockedAt: publication.lockedAt,
        }
      : null,
    stats: {
      students: results.length,
      assessments: assessments.length,
      classAverage,
    },
    readiness,
    subjects: Array.from(subjectMap.values()),
    results: results.map((row) => ({
      ...row,
      subjectResults: row.subjectResults.map((subject) => ({
        ...subject,
        subjectName: subjectMap.get(subject.subjectId)?.nameAr || "مادة",
      })),
    })),
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canReviewResults(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { classroomId, termId, status } = body

  if (!classroomId || !termId || !status) {
    return NextResponse.json({ error: "classroomId و termId و status مطلوبة" }, { status: 400 })
  }

  if (!Object.values(RESULT_PUBLICATION_STATUSES).includes(status)) {
    return NextResponse.json({ error: "حالة النتائج غير صالحة" }, { status: 400 })
  }

  const context = await getAcademicContext(user.schoolId, termId)
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: 400 })
  }

  const calculationTerms = await prisma.term.findMany({
    where: {
      schoolId: user.schoolId,
      academicYearId: context.activeYear.id,
      order: { lte: context.term.order },
    },
    select: { id: true },
  })
  const calculationTermIds = calculationTerms.map((term) => term.id)

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, schoolId: user.schoolId },
    select: { id: true, name: true, levelId: true, streamId: true },
  })
  if (!classroom) {
    return NextResponse.json({ error: "القسم غير موجود" }, { status: 404 })
  }

  const calculationAssessmentWhere = {
    schoolId: user.schoolId,
    academicYearId: context.activeYear.id,
    classroomId,
    termId: { in: calculationTermIds },
  }

  if (status === RESULT_PUBLICATION_STATUSES.LOCKED && !hasPermission(user, PERMISSIONS.LOCK_GRADES) && user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "ليس لديك صلاحية قفل النتائج" }, { status: 403 })
  }

  if (status === RESULT_PUBLICATION_STATUSES.APPROVED && !hasPermission(user, PERMISSIONS.APPROVE_GRADES) && !reviewRoles.includes(user.role)) {
    return NextResponse.json({ error: "ليس لديك صلاحية اعتماد النتائج" }, { status: 403 })
  }

  const now = new Date()
  const [enrollments, assessments, coefficients, teacherAssignments, resultRule] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        schoolId: user.schoolId,
        academicYearId: context.activeYear.id,
        classroomId,
        status: "ACTIVE",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.assessment.findMany({
      where: calculationAssessmentWhere,
      include: {
        term: { select: { order: true } },
        scores: { select: { studentId: true, score: true } },
      },
    }),
    prisma.subjectCoefficient.findMany({
      where: {
        schoolId: user.schoolId,
        academicYearId: context.activeYear.id,
        OR: [
          { classroomId },
          { levelId: classroom.levelId, streamId: classroom.streamId, classroomId: null },
          { levelId: classroom.levelId, streamId: null, classroomId: null },
        ],
      },
      select: {
        subjectId: true,
        levelId: true,
        streamId: true,
        classroomId: true,
        coefficient: true,
      },
    }),
    prisma.teacherAssignment.findMany({
      where: {
        schoolId: user.schoolId,
        academicYearId: context.activeYear.id,
        classroomId,
        isActive: true,
      },
      select: {
        subject: {
          select: {
            id: true,
            nameAr: true,
          },
        },
      },
    }),
    ensurePublishedResultRule(prisma, user.schoolId),
  ])
  const assignedSubjects = Array.from(
    new Map(teacherAssignments.map((assignment) => [assignment.subject.id, assignment.subject])).values()
  )

  const readiness = computeClassroomPublicationReadiness({
    students: enrollments.map((enrollment) => enrollment.student),
    assessments: assessments.map((assessment) => ({
      subjectId: assessment.subjectId,
      type: assessment.type,
      termOrder: assessment.term.order,
      maxScore: assessment.maxScore,
      scores: assessment.scores,
    })),
    coefficients,
    classroomId,
    levelId: classroom.levelId,
    streamId: classroom.streamId,
    rule: resultRule,
    subjects: assignedSubjects,
    termOrder: context.term.order,
  })

  if ((status === RESULT_PUBLICATION_STATUSES.APPROVED || status === RESULT_PUBLICATION_STATUSES.LOCKED) && !readiness.publishable) {
    return NextResponse.json({
      error: "لا يمكن اعتماد أو قفل النتائج قبل اكتمال جميع مواد القسم وضواربها",
      readiness,
    }, { status: 400 })
  }

  const existingPublication = await prisma.resultPublication.findUnique({
    where: {
      academicYearId_termId_classroomId: {
        academicYearId: context.activeYear.id,
        termId: context.term.id,
        classroomId,
      },
    },
  })

  if (status === RESULT_PUBLICATION_STATUSES.LOCKED && existingPublication?.status !== RESULT_PUBLICATION_STATUSES.APPROVED) {
    return NextResponse.json({ error: "يجب اعتماد النتائج أولاً قبل قفلها" }, { status: 400 })
  }

  const publication = await prisma.resultPublication.upsert({
    where: {
      academicYearId_termId_classroomId: {
        academicYearId: context.activeYear.id,
        termId: context.term.id,
        classroomId,
      },
    },
    update: {
      status,
      approvedAt: status === RESULT_PUBLICATION_STATUSES.APPROVED || status === RESULT_PUBLICATION_STATUSES.LOCKED ? now : null,
      lockedAt: status === RESULT_PUBLICATION_STATUSES.LOCKED ? now : null,
      approvedByUserId: status === RESULT_PUBLICATION_STATUSES.APPROVED || status === RESULT_PUBLICATION_STATUSES.LOCKED ? user.id : null,
      lockedByUserId: status === RESULT_PUBLICATION_STATUSES.LOCKED ? user.id : null,
    },
    create: {
      schoolId: user.schoolId,
      academicYearId: context.activeYear.id,
      termId: context.term.id,
      classroomId,
      status,
      approvedAt: status === RESULT_PUBLICATION_STATUSES.APPROVED || status === RESULT_PUBLICATION_STATUSES.LOCKED ? now : null,
      lockedAt: status === RESULT_PUBLICATION_STATUSES.LOCKED ? now : null,
      approvedByUserId: status === RESULT_PUBLICATION_STATUSES.APPROVED || status === RESULT_PUBLICATION_STATUSES.LOCKED ? user.id : null,
      lockedByUserId: status === RESULT_PUBLICATION_STATUSES.LOCKED ? user.id : null,
    },
  })

  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: "RESULT_PUBLICATION",
    entityId: publication.id,
    action: status,
    description: `تغيير حالة نتائج القسم ${classroomId} للفصل ${context.term.name} إلى ${status}`,
    before: existingPublication,
    after: publication,
  })

  let notificationCampaign: { id: string; recipientsCount: number } | null = null

  if (
    status === RESULT_PUBLICATION_STATUSES.APPROVED
    && existingPublication?.status !== RESULT_PUBLICATION_STATUSES.APPROVED
  ) {
    try {
      const campaign = await createNotificationCampaign({
        schoolId: user.schoolId,
        createdByUserId: user.id,
        type: "RESULTS",
        channel: "WHATSAPP",
        title: `نشر نتائج ${context.term.name}`,
        message: `تم اعتماد نتائج القسم ${classroom.name} للفصل ${context.term.name}. يمكنكم مراجعة الإدارة أو انتظار الإرسال النهائي حسب سياسة المدرسة.`,
        audience: {
          audienceType: "CLASSROOM",
          filters: { classroomId },
          exclusions: {},
        },
        status: "DRAFT",
      })

      notificationCampaign = {
        id: campaign.id,
        recipientsCount: campaign.recipientsCount,
      }
    } catch (error) {
      console.error("Results campaign creation failed:", error)
    }
  }

  return NextResponse.json({
    ...publication,
    notificationCampaign,
  })
}

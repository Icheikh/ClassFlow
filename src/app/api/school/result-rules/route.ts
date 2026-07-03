import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  createResultAuditLog,
  DEFAULT_RESULT_RULE,
  ensurePublishedResultRule,
  RESULT_RULE_STATUSES,
  serializeRule,
  validateResultRuleInput,
} from "@/lib/result-rules"

function canManageRules(user: any) {
  return user?.role === "SCHOOL_ADMIN"
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageRules(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const publishedRule = await ensurePublishedResultRule(prisma, user.schoolId)
  const [draftRule, auditLogs] = await Promise.all([
    prisma.resultRule.findFirst({
      where: { schoolId: user.schoolId, status: RESULT_RULE_STATUSES.DRAFT },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.resultAuditLog.findMany({
      where: {
        schoolId: user.schoolId,
        entityType: { in: ["RESULT_RULE", "RESULT_PUBLICATION", "ASSESSMENT", "ASSESSMENT_OVERRIDE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  return NextResponse.json({
    publishedRule: serializeRule(publishedRule),
    draftRule: draftRule ? serializeRule(draftRule) : null,
    defaultRule: DEFAULT_RESULT_RULE,
    auditLogs,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageRules(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const payload = {
    name: String(body.name || ""),
    testWeight: Number(body.testWeight),
    exam1Weight: Number(body.exam1Weight),
    exam2Weight: Number(body.exam2Weight),
    exam3Weight: Number(body.exam3Weight),
    denominator: Number(body.denominator),
    requireTest: Boolean(body.requireTest),
    requireExam1: Boolean(body.requireExam1),
    requireExam2: Boolean(body.requireExam2),
    requireExam3: Boolean(body.requireExam3),
    notes: body.notes ? String(body.notes) : null,
  }

  const validationError = validateResultRuleInput(payload)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const publishedRule = await ensurePublishedResultRule(prisma, user.schoolId)
  const existingDraft = await prisma.resultRule.findFirst({
    where: { schoolId: user.schoolId, status: RESULT_RULE_STATUSES.DRAFT },
  })

  const draftRule = existingDraft
    ? await prisma.resultRule.update({
        where: { id: existingDraft.id },
        data: {
          ...payload,
          updatedByUserId: user.id,
        },
      })
    : await prisma.resultRule.create({
        data: {
          schoolId: user.schoolId,
          ...payload,
          status: RESULT_RULE_STATUSES.DRAFT,
          version: publishedRule.version + 1,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      })

  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: "RESULT_RULE",
    entityId: draftRule.id,
    action: existingDraft ? "UPDATE_DRAFT" : "CREATE_DRAFT",
    description: `حفظ مسودة قاعدة نتائج: ${draftRule.name}`,
    before: existingDraft ? serializeRule(existingDraft) : null,
    after: serializeRule(draftRule),
  })

  return NextResponse.json(serializeRule(draftRule))
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageRules(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const action = body.action

  if (action === "publish") {
    const draftRule = await prisma.resultRule.findFirst({
      where: { schoolId: user.schoolId, status: RESULT_RULE_STATUSES.DRAFT },
      orderBy: { updatedAt: "desc" },
    })
    if (!draftRule) {
      return NextResponse.json({ error: "لا توجد مسودة منشورة" }, { status: 404 })
    }

    const publishedRule = await ensurePublishedResultRule(prisma, user.schoolId)
    const result = await prisma.$transaction(async (tx) => {
      await tx.resultRule.updateMany({
        where: { schoolId: user.schoolId, status: RESULT_RULE_STATUSES.PUBLISHED },
        data: { status: RESULT_RULE_STATUSES.ARCHIVED },
      })

      const published = await tx.resultRule.update({
        where: { id: draftRule.id },
        data: {
          status: RESULT_RULE_STATUSES.PUBLISHED,
          publishedAt: new Date(),
          updatedByUserId: user.id,
        },
      })

      await createResultAuditLog({
        prisma: tx,
        schoolId: user.schoolId,
        actorUserId: user.id,
        entityType: "RESULT_RULE",
        entityId: published.id,
        action: "PUBLISH",
        description: `نشر قاعدة نتائج جديدة: ${published.name}`,
        before: serializeRule(publishedRule),
        after: serializeRule(published),
      })

      return published
    })

    return NextResponse.json(serializeRule(result))
  }

  return NextResponse.json({ error: "عملية غير معروفة" }, { status: 400 })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageRules(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const draftRule = await prisma.resultRule.findFirst({
    where: { schoolId: user.schoolId, status: RESULT_RULE_STATUSES.DRAFT },
    orderBy: { updatedAt: "desc" },
  })
  if (!draftRule) {
    return NextResponse.json({ error: "لا توجد مسودة لحذفها" }, { status: 404 })
  }

  await prisma.resultRule.delete({ where: { id: draftRule.id } })
  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: "RESULT_RULE",
    entityId: draftRule.id,
    action: "DELETE_DRAFT",
    description: `حذف مسودة قاعدة النتائج: ${draftRule.name}`,
    before: serializeRule(draftRule),
    after: null,
  })

  return NextResponse.json({ success: true })
}

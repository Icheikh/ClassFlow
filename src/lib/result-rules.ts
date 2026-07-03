import type { PrismaClient, ResultRule } from "@prisma/client"

export const RESULT_RULE_STATUSES = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const

export const DEFAULT_RESULT_RULE = {
  name: "القاعدة الافتراضية",
  testWeight: 3,
  exam1Weight: 1,
  exam2Weight: 2,
  exam3Weight: 3,
  denominator: 9,
  requireTest: true,
  requireExam1: true,
  requireExam2: true,
  requireExam3: true,
  notes: "معدل المادة = (معدل الاختبارات × 3 + الامتحان الأول × 1 + الامتحان الثاني × 2 + الامتحان الثالث × 3) ÷ 9",
} as const

type ResultRuleInput = {
  name: string
  testWeight: number
  exam1Weight: number
  exam2Weight: number
  exam3Weight: number
  denominator: number
  requireTest: boolean
  requireExam1: boolean
  requireExam2: boolean
  requireExam3: boolean
  notes?: string | null
}

export function validateResultRuleInput(rule: ResultRuleInput) {
  const numericFields = [
    rule.testWeight,
    rule.exam1Weight,
    rule.exam2Weight,
    rule.exam3Weight,
    rule.denominator,
  ]

  if (!rule.name.trim()) return "اسم القاعدة مطلوب"
  if (numericFields.some((value) => !Number.isFinite(value) || value < 0)) {
    return "جميع الأوزان يجب أن تكون أرقاماً صالحة"
  }
  if (rule.denominator <= 0) return "المقام يجب أن يكون أكبر من صفر"

  const requiredWeight =
    (rule.requireTest ? rule.testWeight : 0) +
    (rule.requireExam1 ? rule.exam1Weight : 0) +
    (rule.requireExam2 ? rule.exam2Weight : 0) +
    (rule.requireExam3 ? rule.exam3Weight : 0)

  if (requiredWeight <= 0) {
    return "يجب أن تحتوي القاعدة على عنصر حساب واحد على الأقل"
  }

  return null
}

export async function ensurePublishedResultRule(prisma: PrismaClient, schoolId: string) {
  let publishedRule = await prisma.resultRule.findFirst({
    where: { schoolId, status: RESULT_RULE_STATUSES.PUBLISHED },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  })

  if (!publishedRule) {
    publishedRule = await prisma.resultRule.create({
      data: {
        schoolId,
        ...DEFAULT_RESULT_RULE,
        status: RESULT_RULE_STATUSES.PUBLISHED,
        version: 1,
        publishedAt: new Date(),
      },
    })
  }

  return publishedRule
}

export async function createResultAuditLog(options: {
  prisma: Pick<PrismaClient, "resultAuditLog">
  schoolId: string
  actorUserId?: string | null
  entityType: string
  entityId?: string | null
  action: string
  description?: string
  before?: unknown
  after?: unknown
}) {
  await options.prisma.resultAuditLog.create({
    data: {
      schoolId: options.schoolId,
      actorUserId: options.actorUserId || null,
      entityType: options.entityType,
      entityId: options.entityId || null,
      action: options.action,
      description: options.description || null,
      beforeJson: options.before == null ? null : JSON.stringify(options.before),
      afterJson: options.after == null ? null : JSON.stringify(options.after),
    },
  })
}

export function serializeRule(rule: ResultRule) {
  return {
    id: rule.id,
    name: rule.name,
    testWeight: rule.testWeight,
    exam1Weight: rule.exam1Weight,
    exam2Weight: rule.exam2Weight,
    exam3Weight: rule.exam3Weight,
    denominator: rule.denominator,
    requireTest: rule.requireTest,
    requireExam1: rule.requireExam1,
    requireExam2: rule.requireExam2,
    requireExam3: rule.requireExam3,
    status: rule.status,
    version: rule.version,
    notes: rule.notes,
    publishedAt: rule.publishedAt,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  }
}

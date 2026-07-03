import type { PrismaClient, ResultRule } from "@prisma/client"

export const RESULT_RULE_STATUSES = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const

export const DEFAULT_RESULT_RULE = {
  name: "القاعدة الافتراضية",
  term1TestWeight: 3,
  term1ExamWeight: 1,
  term1Denominator: 4,
  term1RequireTest: true,
  term1RequireExam: true,
  term2TestWeight: 3,
  term2ExamWeight: 2,
  term2Denominator: 5,
  term2RequireTest: true,
  term2RequireExam: true,
  term3TestWeight: 3,
  term3ExamWeight: 3,
  term3Denominator: 6,
  term3RequireTest: true,
  term3RequireExam: true,
  testWeight: 3,
  exam1Weight: 1,
  exam2Weight: 2,
  exam3Weight: 3,
  denominator: 9,
  requireTest: true,
  requireExam1: true,
  requireExam2: true,
  requireExam3: true,
  notes: "في كل فصل: اختبار واحد على الأقل ويمكن إضافة أكثر من اختبار. يحسب معدل الفصل باستعمال معدل الاختبارات وامتحان ذلك الفصل فقط.",
} as const

type ResultRuleInput = {
  name: string
  term1TestWeight: number
  term1ExamWeight: number
  term1Denominator: number
  term1RequireTest: boolean
  term1RequireExam: boolean
  term2TestWeight: number
  term2ExamWeight: number
  term2Denominator: number
  term2RequireTest: boolean
  term2RequireExam: boolean
  term3TestWeight: number
  term3ExamWeight: number
  term3Denominator: number
  term3RequireTest: boolean
  term3RequireExam: boolean
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
    rule.term1TestWeight,
    rule.term1ExamWeight,
    rule.term1Denominator,
    rule.term2TestWeight,
    rule.term2ExamWeight,
    rule.term2Denominator,
    rule.term3TestWeight,
    rule.term3ExamWeight,
    rule.term3Denominator,
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
  if ([rule.term1Denominator, rule.term2Denominator, rule.term3Denominator].some((value) => value <= 0)) {
    return "مقام كل فصل يجب أن يكون أكبر من صفر"
  }

  const termRules = [
    {
      name: "الفصل الأول",
      testWeight: rule.term1TestWeight,
      examWeight: rule.term1ExamWeight,
      requireTest: rule.term1RequireTest,
      requireExam: rule.term1RequireExam,
    },
    {
      name: "الفصل الثاني",
      testWeight: rule.term2TestWeight,
      examWeight: rule.term2ExamWeight,
      requireTest: rule.term2RequireTest,
      requireExam: rule.term2RequireExam,
    },
    {
      name: "الفصل الثالث",
      testWeight: rule.term3TestWeight,
      examWeight: rule.term3ExamWeight,
      requireTest: rule.term3RequireTest,
      requireExam: rule.term3RequireExam,
    },
  ]

  for (const termRule of termRules) {
    const requiredWeight =
      (termRule.requireTest ? termRule.testWeight : 0) +
      (termRule.requireExam ? termRule.examWeight : 0)

    if (requiredWeight <= 0) {
      return `${termRule.name} يجب أن يحتوي على عنصر حساب واحد على الأقل`
    }
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
    term1TestWeight: rule.term1TestWeight,
    term1ExamWeight: rule.term1ExamWeight,
    term1Denominator: rule.term1Denominator,
    term1RequireTest: rule.term1RequireTest,
    term1RequireExam: rule.term1RequireExam,
    term2TestWeight: rule.term2TestWeight,
    term2ExamWeight: rule.term2ExamWeight,
    term2Denominator: rule.term2Denominator,
    term2RequireTest: rule.term2RequireTest,
    term2RequireExam: rule.term2RequireExam,
    term3TestWeight: rule.term3TestWeight,
    term3ExamWeight: rule.term3ExamWeight,
    term3Denominator: rule.term3Denominator,
    term3RequireTest: rule.term3RequireTest,
    term3RequireExam: rule.term3RequireExam,
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

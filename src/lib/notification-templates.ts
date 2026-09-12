/**
 * System notification templates — seeded once per school (isSystem, not editable
 * into deletion; schools add their own on top). Arabic default; schools can
 * create French variants as custom templates.
 */
import { prisma } from "./prisma"

type SystemTemplate = {
  name: string
  type: string
  titleTemplate: string
  messageTemplate: string
  requiresApproval: boolean
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    name: "تذكير بالرسوم",
    type: "FEE_REMINDER",
    titleTemplate: "تذكير بالرسوم",
    messageTemplate:
      "تذكير من {{schoolName}}: مستحقات {{studentName}} عن {{month}}: {{amount}} أوقية. يرجى التسديد لدى الإدارة.",
    requiresApproval: false,
  },
  {
    name: "إيصال دفع",
    type: "PAYMENT_RECEIPT",
    titleTemplate: "إيصال تسديد الرسوم",
    messageTemplate:
      "استلمنا {{amount}} أوقية عن {{studentName}} ({{month}}). شكراً لكم - {{schoolName}}.",
    requiresApproval: false,
  },
  {
    name: "تنبيه غياب",
    type: "ABSENCE",
    titleTemplate: "تنبيه غياب",
    messageTemplate:
      "غاب {{studentName}} يوم {{date}}. يرجى التواصل مع الإدارة - {{schoolName}}.",
    requiresApproval: false,
  },
  {
    name: "إعلان النتائج",
    type: "RESULTS",
    titleTemplate: "صدور النتائج",
    messageTemplate:
      "صدرت نتائج {{studentName}} - {{schoolName}}. اطلعوا عليها في حسابكم.",
    requiresApproval: true,
  },
  {
    name: "إعلان عام",
    type: "GENERAL",
    titleTemplate: "إعلان من الإدارة",
    messageTemplate: "{{schoolName}}: ",
    requiresApproval: true,
  },
]

/** Idempotent: only creates types missing for the school. Returns created count. */
export async function ensureSystemTemplates(schoolId: string): Promise<{ created: number }> {
  const existing = await prisma.notificationTemplate.findMany({
    where: { schoolId, isSystem: true },
    select: { type: true },
  })
  const have = new Set(existing.map((t) => t.type))
  const missing = SYSTEM_TEMPLATES.filter((t) => !have.has(t.type))
  if (missing.length === 0) return { created: 0 }

  await prisma.notificationTemplate.createMany({
    data: missing.map((t) => ({
      schoolId,
      name: t.name,
      type: t.type,
      channel: "WHATSAPP",
      titleTemplate: t.titleTemplate,
      messageTemplate: t.messageTemplate,
      requiresApproval: t.requiresApproval,
      isSystem: true,
      isActive: true,
    })),
  })
  return { created: missing.length }
}

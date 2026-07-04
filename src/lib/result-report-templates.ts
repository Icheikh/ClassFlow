import { prisma } from "@/lib/prisma"

export const DEFAULT_RESULT_REPORT_TEMPLATE_NAME = "القالب الرئيسي"

export type SerializedResultReportTemplate = {
  id: string
  name: string
  sourceType: string
  sourceFileName: string | null
  sourceDescription: string | null
  sourcePreview: string | null
  definitionVersion: number
  isActive: boolean
  title: string
  subtitle: string | null
  footerNote: string | null
  notesLabel: string
  signatureLabel: string
  classroomLabel: string
  termLabel: string
  statsLabel: string
  studentsCountLabel: string
  classAverageLabel: string
  showRank: boolean
  showWeightedScore: boolean
  showRuleNotes: boolean
  showPolicyNote: boolean
  showSubjectCoefficient: boolean
  showSchoolContacts: boolean
  showNotesSection: boolean
  showSignatureSection: boolean
  createdAt: string
  updatedAt: string
}

type LegacySchoolTemplateFields = {
  resultReportTitle: string | null
  resultReportSubtitle: string | null
  resultReportFooterNote: string | null
  resultReportNotesLabel: string
  resultReportSignatureLabel: string
  resultReportClassroomLabel?: string | null
  resultReportTermLabel?: string | null
  resultReportStatsLabel?: string | null
  resultReportStudentsCountLabel?: string | null
  resultReportClassAverageLabel?: string | null
  resultReportShowRank: boolean
  resultReportShowWeightedScore: boolean
  resultReportShowRuleNotes: boolean
  resultReportShowPolicyNote: boolean
  resultReportShowSubjectCoefficient: boolean
  resultReportShowSchoolContacts: boolean
  resultReportShowNotesSection: boolean
  resultReportShowSignatureSection: boolean
}

export type TemplateContentInput = {
  name?: string
  sourceType?: string
  sourceFileName?: string | null
  sourceDescription?: string | null
  sourcePreview?: string | null
  title?: string
  subtitle?: string | null
  footerNote?: string | null
  notesLabel?: string
  signatureLabel?: string
  classroomLabel?: string
  termLabel?: string
  statsLabel?: string
  studentsCountLabel?: string
  classAverageLabel?: string
  showRank?: boolean
  showWeightedScore?: boolean
  showRuleNotes?: boolean
  showPolicyNote?: boolean
  showSubjectCoefficient?: boolean
  showSchoolContacts?: boolean
  showNotesSection?: boolean
  showSignatureSection?: boolean
}

function normalizeTemplateContent(template: TemplateContentInput) {
  return {
    name: template.name?.trim() || DEFAULT_RESULT_REPORT_TEMPLATE_NAME,
    sourceType: template.sourceType?.trim() || "CUSTOM",
    sourceFileName: template.sourceFileName?.trim() || null,
    sourceDescription: template.sourceDescription?.trim() || null,
    sourcePreview: template.sourcePreview?.trim() || null,
    title: template.title?.trim() || "كشف نتائج القسم",
    subtitle: template.subtitle?.trim() || null,
    footerNote: template.footerNote?.trim() || null,
    notesLabel: template.notesLabel?.trim() || "ملاحظات الإدارة",
    signatureLabel: template.signatureLabel?.trim() || "الختم والتوقيع",
    classroomLabel: template.classroomLabel?.trim() || "القسم",
    termLabel: template.termLabel?.trim() || "الفصل",
    statsLabel: template.statsLabel?.trim() || "إحصاءات",
    studentsCountLabel: template.studentsCountLabel?.trim() || "عدد التلاميذ",
    classAverageLabel: template.classAverageLabel?.trim() || "معدل القسم",
    showRank: template.showRank !== false,
    showWeightedScore: template.showWeightedScore !== false,
    showRuleNotes: template.showRuleNotes !== false,
    showPolicyNote: template.showPolicyNote !== false,
    showSubjectCoefficient: template.showSubjectCoefficient !== false,
    showSchoolContacts: template.showSchoolContacts !== false,
    showNotesSection: template.showNotesSection !== false,
    showSignatureSection: template.showSignatureSection !== false,
  }
}

function buildTemplateFromLegacyFields(school: LegacySchoolTemplateFields) {
  return normalizeTemplateContent({
    name: DEFAULT_RESULT_REPORT_TEMPLATE_NAME,
    sourceType: "SYSTEM",
    sourcePreview: null,
    title: school.resultReportTitle || "كشف نتائج القسم",
    subtitle: school.resultReportSubtitle || null,
    footerNote: school.resultReportFooterNote || null,
    notesLabel: school.resultReportNotesLabel || "ملاحظات الإدارة",
    signatureLabel: school.resultReportSignatureLabel || "الختم والتوقيع",
    classroomLabel: school.resultReportClassroomLabel || "القسم",
    termLabel: school.resultReportTermLabel || "الفصل",
    statsLabel: school.resultReportStatsLabel || "إحصاءات",
    studentsCountLabel: school.resultReportStudentsCountLabel || "عدد التلاميذ",
    classAverageLabel: school.resultReportClassAverageLabel || "معدل القسم",
    showRank: school.resultReportShowRank !== false,
    showWeightedScore: school.resultReportShowWeightedScore !== false,
    showRuleNotes: school.resultReportShowRuleNotes !== false,
    showPolicyNote: school.resultReportShowPolicyNote !== false,
    showSubjectCoefficient: school.resultReportShowSubjectCoefficient !== false,
    showSchoolContacts: school.resultReportShowSchoolContacts !== false,
    showNotesSection: school.resultReportShowNotesSection !== false,
    showSignatureSection: school.resultReportShowSignatureSection !== false,
  })
}

export function serializeResultReportTemplate(template: any): SerializedResultReportTemplate {
  return {
    id: template.id,
    name: template.name,
    sourceType: template.sourceType,
    sourceFileName: template.sourceFileName || null,
    sourceDescription: template.sourceDescription || null,
    sourcePreview: template.sourcePreview || null,
    definitionVersion: template.definitionVersion || 1,
    isActive: template.isActive === true,
    title: template.title || "كشف نتائج القسم",
    subtitle: template.subtitle || null,
    footerNote: template.footerNote || null,
    notesLabel: template.notesLabel || "ملاحظات الإدارة",
    signatureLabel: template.signatureLabel || "الختم والتوقيع",
    classroomLabel: template.classroomLabel || "القسم",
    termLabel: template.termLabel || "الفصل",
    statsLabel: template.statsLabel || "إحصاءات",
    studentsCountLabel: template.studentsCountLabel || "عدد التلاميذ",
    classAverageLabel: template.classAverageLabel || "معدل القسم",
    showRank: template.showRank !== false,
    showWeightedScore: template.showWeightedScore !== false,
    showRuleNotes: template.showRuleNotes !== false,
    showPolicyNote: template.showPolicyNote !== false,
    showSubjectCoefficient: template.showSubjectCoefficient !== false,
    showSchoolContacts: template.showSchoolContacts !== false,
    showNotesSection: template.showNotesSection !== false,
    showSignatureSection: template.showSignatureSection !== false,
    createdAt: template.createdAt instanceof Date ? template.createdAt.toISOString() : template.createdAt,
    updatedAt: template.updatedAt instanceof Date ? template.updatedAt.toISOString() : template.updatedAt,
  }
}

async function syncLegacyTemplateFields(schoolId: string, templateId: string) {
  const template = await prisma.resultReportTemplate.findFirst({
    where: { id: templateId, schoolId },
  })
  if (!template) return null

  await prisma.school.update({
    where: { id: schoolId },
    data: {
      activeResultReportTemplateId: template.id,
      resultReportTitle: template.title,
      resultReportSubtitle: template.subtitle,
      resultReportFooterNote: template.footerNote,
      resultReportNotesLabel: template.notesLabel,
      resultReportSignatureLabel: template.signatureLabel,
      resultReportClassroomLabel: template.classroomLabel,
      resultReportTermLabel: template.termLabel,
      resultReportStatsLabel: template.statsLabel,
      resultReportStudentsCountLabel: template.studentsCountLabel,
      resultReportClassAverageLabel: template.classAverageLabel,
      resultReportShowRank: template.showRank,
      resultReportShowWeightedScore: template.showWeightedScore,
      resultReportShowRuleNotes: template.showRuleNotes,
      resultReportShowPolicyNote: template.showPolicyNote,
      resultReportShowSubjectCoefficient: template.showSubjectCoefficient,
      resultReportShowSchoolContacts: template.showSchoolContacts,
      resultReportShowNotesSection: template.showNotesSection,
      resultReportShowSignatureSection: template.showSignatureSection,
    },
  })

  return template
}

export async function ensureActiveResultReportTemplate(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      activeResultReportTemplateId: true,
      resultReportTitle: true,
      resultReportSubtitle: true,
      resultReportFooterNote: true,
      resultReportNotesLabel: true,
      resultReportSignatureLabel: true,
      resultReportClassroomLabel: true,
      resultReportTermLabel: true,
      resultReportStatsLabel: true,
      resultReportStudentsCountLabel: true,
      resultReportClassAverageLabel: true,
      resultReportShowRank: true,
      resultReportShowWeightedScore: true,
      resultReportShowRuleNotes: true,
      resultReportShowPolicyNote: true,
      resultReportShowSubjectCoefficient: true,
      resultReportShowSchoolContacts: true,
      resultReportShowNotesSection: true,
      resultReportShowSignatureSection: true,
      resultReportTemplates: {
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!school) return null

  if (school.resultReportTemplates.length === 0) {
    const template = await prisma.resultReportTemplate.create({
      data: {
        schoolId,
        isActive: true,
        ...buildTemplateFromLegacyFields(school),
      },
    })
    await syncLegacyTemplateFields(schoolId, template.id)
    return template
  }

  const activeTemplate =
    school.resultReportTemplates.find((template) => template.id === school.activeResultReportTemplateId) ||
    school.resultReportTemplates.find((template) => template.isActive) ||
    school.resultReportTemplates[0]

  if (!activeTemplate) return null

  if (school.activeResultReportTemplateId === activeTemplate.id && activeTemplate.isActive) {
    return activeTemplate
  }

  await prisma.$transaction([
    prisma.resultReportTemplate.updateMany({
      where: { schoolId, id: { not: activeTemplate.id }, isActive: true },
      data: { isActive: false },
    }),
    prisma.resultReportTemplate.update({
      where: { id: activeTemplate.id },
      data: { isActive: true },
    }),
  ])

  return syncLegacyTemplateFields(schoolId, activeTemplate.id)
}

export async function listSchoolResultReportTemplates(schoolId: string) {
  await ensureActiveResultReportTemplate(schoolId)

  const templates = await prisma.resultReportTemplate.findMany({
    where: { schoolId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }, { createdAt: "asc" }],
  })

  const activeTemplate = templates.find((template) => template.isActive) || templates[0] || null

  return {
    activeTemplate,
    templates,
  }
}

export async function activateResultReportTemplate(schoolId: string, templateId: string) {
  const template = await prisma.resultReportTemplate.findFirst({
    where: { id: templateId, schoolId },
  })
  if (!template) {
    throw new Error("القالب غير موجود")
  }

  await prisma.$transaction([
    prisma.resultReportTemplate.updateMany({
      where: { schoolId },
      data: { isActive: false },
    }),
    prisma.resultReportTemplate.update({
      where: { id: templateId },
      data: { isActive: true },
    }),
  ])

  return syncLegacyTemplateFields(schoolId, templateId)
}

export async function createResultReportTemplate(
  schoolId: string,
  input: TemplateContentInput,
  options?: { makeActive?: boolean }
) {
  const normalized = normalizeTemplateContent(input)
  const template = await prisma.resultReportTemplate.create({
    data: {
      schoolId,
      isActive: false,
      ...normalized,
    },
  })

  if (options?.makeActive === true) {
    await activateResultReportTemplate(schoolId, template.id)
    return prisma.resultReportTemplate.findUnique({ where: { id: template.id } })
  }

  return template
}

export async function updateResultReportTemplate(
  schoolId: string,
  templateId: string,
  input: TemplateContentInput
) {
  const existing = await prisma.resultReportTemplate.findFirst({
    where: { id: templateId, schoolId },
  })
  if (!existing) {
    throw new Error("القالب غير موجود")
  }

  const template = await prisma.resultReportTemplate.update({
    where: { id: templateId },
    data: normalizeTemplateContent({
      ...existing,
      ...input,
    }),
  })

  if (template.isActive) {
    await syncLegacyTemplateFields(schoolId, template.id)
  }

  return template
}

export async function deleteResultReportTemplate(schoolId: string, templateId: string) {
  const templates = await prisma.resultReportTemplate.findMany({
    where: { schoolId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }, { createdAt: "asc" }],
  })
  if (templates.length <= 1) {
    throw new Error("يجب الإبقاء على قالب واحد على الأقل")
  }

  const template = templates.find((item) => item.id === templateId)
  if (!template) {
    throw new Error("القالب غير موجود")
  }

  await prisma.resultReportTemplate.delete({
    where: { id: templateId },
  })

  if (template.isActive) {
    const nextTemplate = templates.find((item) => item.id !== templateId)
    if (nextTemplate) {
      await activateResultReportTemplate(schoolId, nextTemplate.id)
    }
  }
}

export function buildResultReportTemplateExport(template: SerializedResultReportTemplate) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    template: {
      name: template.name,
      sourceType: template.sourceType,
      sourceFileName: template.sourceFileName,
      sourceDescription: template.sourceDescription,
      sourcePreview: template.sourcePreview,
      definitionVersion: template.definitionVersion,
      title: template.title,
      subtitle: template.subtitle,
      footerNote: template.footerNote,
      notesLabel: template.notesLabel,
      signatureLabel: template.signatureLabel,
      classroomLabel: template.classroomLabel,
      termLabel: template.termLabel,
      statsLabel: template.statsLabel,
      studentsCountLabel: template.studentsCountLabel,
      classAverageLabel: template.classAverageLabel,
      showRank: template.showRank,
      showWeightedScore: template.showWeightedScore,
      showRuleNotes: template.showRuleNotes,
      showPolicyNote: template.showPolicyNote,
      showSubjectCoefficient: template.showSubjectCoefficient,
      showSchoolContacts: template.showSchoolContacts,
      showNotesSection: template.showNotesSection,
      showSignatureSection: template.showSignatureSection,
    },
  }
}

export function parseImportedResultReportTemplate(payload: string) {
  let parsed: any
  try {
    parsed = JSON.parse(payload)
  } catch {
    throw new Error("ملف القالب غير صالح")
  }

  const template = parsed?.template
  if (!template || typeof template !== "object") {
    throw new Error("بيانات القالب غير مكتملة")
  }

  return normalizeTemplateContent({
    ...template,
    sourceType: template.sourceType || "JSON_IMPORT",
  })
}

export const RESULT_REPORT_TEMPLATE_PLACEHOLDERS = [
  "{{school.name}}",
  "{{school.address}}",
  "{{school.phone}}",
  "{{school.contacts}}",
  "{{classroom.name}}",
  "{{classroom.stage}}",
  "{{classroom.level}}",
  "{{classroom.stream}}",
  "{{classroom.fullLabel}}",
  "{{term.name}}",
  "{{resultRule.name}}",
  "{{resultRule.fullName}}",
  "{{stats.students}}",
  "{{stats.classAverage}}",
  "{{publication.status}}",
] as const

type ResultReportRenderContext = {
  school: { name: string | null; address: string | null; phone: string | null }
  classroom: { name: string; level: { name: string; stage: { name: string } }; stream: { name: string } | null }
  term: { name: string }
  resultRule: { name: string; version: number }
  stats: { students: number; classAverage: number | null }
  publicationStatus: string
}

function getPublicationStatusLabel(status: string) {
  if (status === "LOCKED") return "مقفول"
  if (status === "APPROVED") return "معتمد"
  return "مفتوح"
}

function buildResultReportPlaceholderMap(context: ResultReportRenderContext) {
  const schoolContacts = [context.school.address, context.school.phone].filter(Boolean).join(" · ")
  const classroomFullLabel = [
    context.classroom.level.stage.name,
    context.classroom.level.name,
    context.classroom.stream?.name || null,
  ]
    .filter(Boolean)
    .join(" - ")

  return {
    "school.name": context.school.name || "المدرسة",
    "school.address": context.school.address || "بدون عنوان",
    "school.phone": context.school.phone || "بدون هاتف",
    "school.contacts": schoolContacts || "بدون بيانات اتصال",
    "classroom.name": context.classroom.name,
    "classroom.stage": context.classroom.level.stage.name,
    "classroom.level": context.classroom.level.name,
    "classroom.stream": context.classroom.stream?.name || "بدون شعبة",
    "classroom.fullLabel": classroomFullLabel,
    "term.name": context.term.name,
    "resultRule.name": context.resultRule.name,
    "resultRule.fullName": `${context.resultRule.name} (v${context.resultRule.version})`,
    "stats.students": String(context.stats.students),
    "stats.classAverage": context.stats.classAverage != null ? context.stats.classAverage.toFixed(2) : "—",
    "publication.status": getPublicationStatusLabel(context.publicationStatus),
  }
}

export function renderResultReportText(value: string | null | undefined, context: ResultReportRenderContext) {
  if (!value) return value || null

  const placeholders = buildResultReportPlaceholderMap(context)
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key) => {
    return placeholders[key as keyof typeof placeholders] || ""
  })
}

export function renderResultReportTemplate(template: SerializedResultReportTemplate, context: ResultReportRenderContext) {
  return {
    ...template,
    title: renderResultReportText(template.title, context) || "كشف نتائج القسم",
    subtitle: renderResultReportText(template.subtitle, context),
    footerNote: renderResultReportText(template.footerNote, context),
    notesLabel: renderResultReportText(template.notesLabel, context) || "ملاحظات الإدارة",
    signatureLabel: renderResultReportText(template.signatureLabel, context) || "الختم والتوقيع",
    classroomLabel: renderResultReportText(template.classroomLabel, context) || "القسم",
    termLabel: renderResultReportText(template.termLabel, context) || "الفصل",
    statsLabel: renderResultReportText(template.statsLabel, context) || "إحصاءات",
    studentsCountLabel: renderResultReportText(template.studentsCountLabel, context) || "عدد التلاميذ",
    classAverageLabel: renderResultReportText(template.classAverageLabel, context) || "معدل القسم",
  }
}

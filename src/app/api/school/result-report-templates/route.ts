import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  activateResultReportTemplate,
  buildResultReportTemplateExport,
  createResultReportTemplate,
  listSchoolResultReportTemplates,
  parseImportedResultReportTemplate,
  serializeResultReportTemplate,
} from "@/lib/result-report-templates"

async function getAdminSchoolId() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") return null
  return user.schoolId as string
}

function serializeTemplateList(templates: any[]) {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    sourceType: template.sourceType,
    sourceFileName: template.sourceFileName || null,
    isActive: template.isActive === true,
    updatedAt: template.updatedAt.toISOString(),
  }))
}

export async function GET() {
  const schoolId = await getAdminSchoolId()
  if (!schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data = await listSchoolResultReportTemplates(schoolId)
  if (!data.activeTemplate) {
    return NextResponse.json({ error: "لا يوجد قالب نشط" }, { status: 404 })
  }

  return NextResponse.json({
    activeTemplateId: data.activeTemplate.id,
    templates: serializeTemplateList(data.templates),
    template: serializeResultReportTemplate(data.activeTemplate),
  })
}

export async function POST(req: NextRequest) {
  const schoolId = await getAdminSchoolId()
  if (!schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const action = body?.action

  try {
    if (action === "create") {
      const current = await listSchoolResultReportTemplates(schoolId)
      if (!current.activeTemplate) {
        return NextResponse.json({ error: "لا يوجد قالب مرجعي" }, { status: 404 })
      }

      const nextTemplate = await createResultReportTemplate(
        schoolId,
        {
          ...serializeResultReportTemplate(current.activeTemplate),
          name: body?.name || `${current.activeTemplate.name} - نسخة`,
          sourceType: "CUSTOM",
        },
        { makeActive: true }
      )

      const refreshed = await listSchoolResultReportTemplates(schoolId)
      return NextResponse.json({
        activeTemplateId: nextTemplate?.id,
        templates: serializeTemplateList(refreshed.templates),
        template: nextTemplate ? serializeResultReportTemplate(nextTemplate) : null,
      })
    }

    if (action === "activate") {
      const templateId = body?.templateId
      if (!templateId) {
        return NextResponse.json({ error: "templateId مطلوب" }, { status: 400 })
      }

      const activeTemplate = await activateResultReportTemplate(schoolId, templateId)
      const refreshed = await listSchoolResultReportTemplates(schoolId)
      return NextResponse.json({
        activeTemplateId: activeTemplate?.id,
        templates: serializeTemplateList(refreshed.templates),
        template: activeTemplate ? serializeResultReportTemplate(activeTemplate) : null,
      })
    }

    if (action === "import") {
      const payload = body?.payload
      if (!payload || typeof payload !== "string") {
        return NextResponse.json({ error: "محتوى القالب مطلوب" }, { status: 400 })
      }

      const importedTemplate = parseImportedResultReportTemplate(payload)
      const template = await createResultReportTemplate(
        schoolId,
        {
          ...importedTemplate,
          name: importedTemplate.name || body?.name || "قالب مستورد",
          sourceType: importedTemplate.sourceType || "JSON_IMPORT",
        },
        { makeActive: true }
      )

      const refreshed = await listSchoolResultReportTemplates(schoolId)
      return NextResponse.json({
        activeTemplateId: template?.id,
        templates: serializeTemplateList(refreshed.templates),
        template: template ? serializeResultReportTemplate(template) : null,
      })
    }

    if (action === "export") {
      const data = await listSchoolResultReportTemplates(schoolId)
      const templateId = body?.templateId || data.activeTemplate?.id
      const template = data.templates.find((item) => item.id === templateId)
      if (!template) {
        return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 })
      }

      return NextResponse.json({
        export: buildResultReportTemplateExport(serializeResultReportTemplate(template)),
      })
    }

    return NextResponse.json({ error: "الإجراء غير صالح" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: "تعذر تنفيذ العملية" },
      { status: 400 }
    )
  }
}

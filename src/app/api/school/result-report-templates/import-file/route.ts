import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  createResultReportTemplate,
  listSchoolResultReportTemplates,
  serializeResultReportTemplate,
} from "@/lib/result-report-templates"
import { importResultReportTemplateFromFile } from "@/lib/result-report-template-import"

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

export async function POST(req: Request) {
  const schoolId = await getAdminSchoolId()
  if (!schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const rawFile = formData.get("file")
    const templateName = formData.get("name")

    if (!(rawFile instanceof File)) {
      return NextResponse.json({ error: "ملف القالب مطلوب" }, { status: 400 })
    }

    if (!rawFile.name) {
      return NextResponse.json({ error: "اسم الملف غير صالح" }, { status: 400 })
    }

    const buffer = Buffer.from(await rawFile.arrayBuffer())
    if (!buffer.length) {
      return NextResponse.json({ error: "الملف فارغ" }, { status: 400 })
    }

    const imported = await importResultReportTemplateFromFile(rawFile.name, buffer)
    const template = await createResultReportTemplate(
      schoolId,
      {
        ...imported.content,
        name:
          (typeof templateName === "string" && templateName.trim()) ||
          imported.content.name ||
          "قالب مستورد",
      },
      { makeActive: true }
    )

    const refreshed = await listSchoolResultReportTemplates(schoolId)
    return NextResponse.json({
      activeTemplateId: template?.id,
      templates: serializeTemplateList(refreshed.templates),
      template: template ? serializeResultReportTemplate(template) : null,
      importSummary: imported.metadata,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر استيراد الملف" },
      { status: 400 }
    )
  }
}

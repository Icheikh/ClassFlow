import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  listSchoolResultReportTemplates,
  serializeResultReportTemplate,
  updateResultReportTemplate,
} from "@/lib/result-report-templates"

async function getAdminSchoolId() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") return null
  return user.schoolId as string
}

export async function GET() {
  const schoolId = await getAdminSchoolId()
  if (!schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [school, templatesData] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        phone: true,
        email: true,
        address: true,
      },
    }),
    listSchoolResultReportTemplates(schoolId),
  ])

  if (!school || !templatesData.activeTemplate) {
    return NextResponse.json({ error: "المدرسة غير موجودة" }, { status: 404 })
  }

  return NextResponse.json({
    name: school.name || "",
    phone: school.phone || "",
    email: school.email || "",
    address: school.address || "",
    activeTemplateId: templatesData.activeTemplate.id,
    templates: templatesData.templates.map((template) => ({
      id: template.id,
      name: template.name,
      sourceType: template.sourceType,
      sourceFileName: template.sourceFileName || null,
      isActive: template.isActive === true,
      updatedAt: template.updatedAt.toISOString(),
    })),
    template: serializeResultReportTemplate(templatesData.activeTemplate),
  })
}

export async function PUT(req: NextRequest) {
  const schoolId = await getAdminSchoolId()
  if (!schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name, phone, email, address, activeTemplateId, template } = body

  if (!activeTemplateId) {
    return NextResponse.json({ error: "القالب النشط مطلوب" }, { status: 400 })
  }

  const [school, updatedTemplate] = await Promise.all([
    prisma.school.update({
      where: { id: schoolId },
      data: {
        name,
        phone,
        email,
        address,
      },
    }),
    updateResultReportTemplate(schoolId, activeTemplateId, template || {}),
  ])

  const templatesData = await listSchoolResultReportTemplates(schoolId)

  return NextResponse.json({
    name: school.name || "",
    phone: school.phone || "",
    email: school.email || "",
    address: school.address || "",
    activeTemplateId: updatedTemplate.id,
    templates: templatesData.templates.map((item) => ({
      id: item.id,
      name: item.name,
      sourceType: item.sourceType,
      sourceFileName: item.sourceFileName || null,
      isActive: item.isActive === true,
      updatedAt: item.updatedAt.toISOString(),
    })),
    template: serializeResultReportTemplate(updatedTemplate),
  })
}

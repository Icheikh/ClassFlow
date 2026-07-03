import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function serializeSchoolSettings(school: any) {
  return {
    name: school.name || "",
    phone: school.phone || "",
    email: school.email || "",
    address: school.address || "",
    template: {
      title: school.resultReportTitle || "كشف نتائج القسم",
      subtitle: school.resultReportSubtitle || "",
      footerNote: school.resultReportFooterNote || "",
      notesLabel: school.resultReportNotesLabel || "ملاحظات الإدارة",
      signatureLabel: school.resultReportSignatureLabel || "الختم والتوقيع",
      showRank: school.resultReportShowRank !== false,
      showWeightedScore: school.resultReportShowWeightedScore !== false,
      showRuleNotes: school.resultReportShowRuleNotes !== false,
    },
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
  })

  if (!school) {
    return NextResponse.json({ error: "المدرسة غير موجودة" }, { status: 404 })
  }

  return NextResponse.json(serializeSchoolSettings(school))
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, phone, email, address, template } = body

  const school = await prisma.school.update({
    where: { id: user.schoolId },
    data: {
      name,
      phone,
      email,
      address,
      resultReportTitle: template?.title || "كشف نتائج القسم",
      resultReportSubtitle: template?.subtitle || null,
      resultReportFooterNote: template?.footerNote || null,
      resultReportNotesLabel: template?.notesLabel || "ملاحظات الإدارة",
      resultReportSignatureLabel: template?.signatureLabel || "الختم والتوقيع",
      resultReportShowRank: template?.showRank !== false,
      resultReportShowWeightedScore: template?.showWeightedScore !== false,
      resultReportShowRuleNotes: template?.showRuleNotes !== false,
    },
  })
  return NextResponse.json(serializeSchoolSettings(school))
}

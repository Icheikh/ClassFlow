import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { deleteResultReportTemplate } from "@/lib/result-report-templates"

async function getAdminSchoolId() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") return null
  return user.schoolId as string
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const schoolId = await getAdminSchoolId()
  if (!schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await deleteResultReportTemplate(schoolId, params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر حذف القالب" },
      { status: 400 }
    )
  }
}

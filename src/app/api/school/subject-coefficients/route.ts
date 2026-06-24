import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.subjectCoefficient.findMany({
    where: { schoolId: user.schoolId },
    include: { subject: true, level: { include: { stage: true } }, stream: true },
    orderBy: [{ level: { order: "asc" } }, { subject: { nameAr: "asc" } }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_COEFFICIENTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const { subjectId, levelId, streamId, coefficient } = body

  const year = await prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isActive: true } })
  if (!year) return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })

  const existing = await prisma.subjectCoefficient.findFirst({
    where: { schoolId: user.schoolId, academicYearId: year.id, subjectId, levelId, streamId: streamId || null },
  })
  if (existing) {
    const item = await prisma.subjectCoefficient.update({
      where: { id: existing.id },
      data: { coefficient: parseFloat(coefficient) },
    })
    return NextResponse.json(item)
  }

  const item = await prisma.subjectCoefficient.create({
    data: {
      schoolId: user.schoolId, academicYearId: year.id, subjectId, levelId, streamId: streamId || null,
      coefficient: parseFloat(coefficient),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
    if (!hasPermission(user, PERMISSIONS.MANAGE_COEFFICIENTS) && !isLegacyRole)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    await prisma.subjectCoefficient.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "فشل الحذف" }, { status: 400 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.subject.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { nameAr: "asc" },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_SUBJECTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const { nameAr, nameFr, code } = body
  const item = await prisma.subject.create({
    data: { schoolId: user.schoolId, nameAr, nameFr: nameFr || null, code },
  })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_SUBJECTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const { id, nameAr, nameFr, code } = body
  const existing = await prisma.subject.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  const item = await prisma.subject.update({ where: { id }, data: { nameAr, nameFr: nameFr || null, code } })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
    if (!hasPermission(user, PERMISSIONS.MANAGE_SUBJECTS) && !isLegacyRole)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const existing = await prisma.subject.findFirst({ where: { id, schoolId: user.schoolId } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
    await prisma.subject.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.code === "P2003" ? "لا يمكن حذف المادة لأنها مرتبطة بمعاملات أو تكليفات" : e.message || "فشل الحذف"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
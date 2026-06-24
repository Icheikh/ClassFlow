import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.level.findMany({
    where: { schoolId: user.schoolId },
    include: { stage: true },
    orderBy: { order: "asc" },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_CLASSROOMS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const { stageId, name, order } = body
  const item = await prisma.level.create({
    data: { schoolId: user.schoolId, stageId, name, order: parseInt(order) },
  })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_CLASSROOMS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const { id, name, order } = body
  const item = await prisma.level.update({ where: { id }, data: { name, order: parseInt(order) } })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
    if (!hasPermission(user, PERMISSIONS.MANAGE_CLASSROOMS) && !isLegacyRole)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    await prisma.level.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.code === "P2003" 
      ? "لا يمكن حذف هذا المستوى لأنه مرتبط بأقسام أو شعب. احذفها أولاً."
      : e.message || "فشل الحذف"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
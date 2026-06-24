import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.classroom.findMany({
    where: { schoolId: user.schoolId },
    include: { level: { include: { stage: true } }, stream: true },
    orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
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
  const { levelId, streamId, name, capacity } = body
  const item = await prisma.classroom.create({
    data: {
      schoolId: user.schoolId, levelId, streamId: streamId || null,
      name, capacity: parseInt(capacity) || 40,
    },
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
  const { id, levelId, name, capacity } = body
  const item = await prisma.classroom.update({
    where: { id }, data: { levelId, name, capacity: parseInt(capacity) || 40 },
  })
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
    await prisma.classroom.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.code === "P2003" ? "لا يمكن حذف القسم لأنه مرتبط بطلاب أو أساتذة" : e.message || "فشل الحذف"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
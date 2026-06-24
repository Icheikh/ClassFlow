import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

const allowedRoles = ["SCHOOL_ADMIN", "SUPERVISOR"]

function canManage(user: any) {
  return allowedRoles.includes(user?.role) || hasPermission(user, PERMISSIONS.MANAGE_ACADEMIC_YEARS)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const items = await prisma.term.findMany({
    where: { schoolId: user.schoolId },
    include: { academicYear: true },
    orderBy: [{ academicYear: { startsAt: "desc" } }, { order: "asc" }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { academicYearId, name, startsAt, endsAt, order } = body

  const item = await prisma.term.create({
    data: { schoolId: user.schoolId, academicYearId, name, startsAt: new Date(startsAt), endsAt: new Date(endsAt), order: parseInt(order) },
  })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, name, startsAt, endsAt, order, isActive } = body

  const existing = await prisma.term.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const item = await prisma.term.update({
    where: { id },
    data: { name, startsAt: new Date(startsAt), endsAt: new Date(endsAt), order: parseInt(order), isActive },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const existing = await prisma.term.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  await prisma.term.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
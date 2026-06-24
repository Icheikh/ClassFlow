import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.academicYear.findMany({
    where: { schoolId: user.schoolId },
    include: { terms: true },
    orderBy: { startsAt: "desc" },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_ACADEMIC_YEARS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, startsAt, endsAt } = body

  const item = await prisma.academicYear.create({
    data: { schoolId: user.schoolId, name, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
  })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_ACADEMIC_YEARS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, name, startsAt, endsAt, isActive } = body

  const existing = await prisma.academicYear.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  // If activating this year, deactivate all others
  if (isActive) {
    await prisma.academicYear.updateMany({
      where: { schoolId: user.schoolId, isActive: true },
      data: { isActive: false },
    })
  }

  const item = await prisma.academicYear.update({
    where: { id },
    data: { name, startsAt: new Date(startsAt), endsAt: new Date(endsAt), isActive },
  })
  return NextResponse.json(item)
}
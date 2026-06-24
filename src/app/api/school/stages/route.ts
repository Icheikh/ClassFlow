import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

function legacyCheck(user: any) {
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_ACADEMIC_YEARS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.educationStage.findMany({
    where: { schoolId: user.schoolId },
    include: { levels: { include: { streams: true }, orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const blocked = legacyCheck(user)
  if (blocked) return blocked
  const body = await req.json()
  const { name, order } = body
  const item = await prisma.educationStage.create({
    data: { schoolId: user.schoolId, name, order: parseInt(order) },
  })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const blocked = legacyCheck(user)
  if (blocked) return blocked
  const body = await req.json()
  const { id, name, order } = body
  const item = await prisma.educationStage.update({ where: { id }, data: { name, order: parseInt(order) } })
  return NextResponse.json(item)
}
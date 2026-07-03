import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await prisma.fee.findFirst({ where: { id: params.id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "الرسم غير موجود" }, { status: 404 })

  const body = await req.json()
  const fee = await prisma.fee.update({
    where: { id: params.id },
    data: {
      name: body.name ?? existing.name,
      amount: body.amount != null ? parseFloat(body.amount) : existing.amount,
      frequency: body.frequency ?? existing.frequency,
      levelId: body.levelId !== undefined ? body.levelId : existing.levelId,
      classroomId: body.classroomId !== undefined ? body.classroomId : existing.classroomId,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    },
  })

  return NextResponse.json(fee)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await prisma.fee.findFirst({ where: { id: params.id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "الرسم غير موجود" }, { status: 404 })

  await prisma.fee.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

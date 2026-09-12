import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { parsePositiveAmount } from "@/lib/finance"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await prisma.fee.findFirst({ where: { id: params.id, schoolId: user.schoolId! } })
  if (!existing) return NextResponse.json({ error: "الرسم غير موجود" }, { status: 404 })

  const body = await req.json()
  if (body.amount != null && parsePositiveAmount(body.amount) == null) {
    return NextResponse.json({ error: "المبلغ يجب أن يكون أكبر من صفر" }, { status: 400 })
  }
  if (body.levelId) {
    const level = await prisma.level.findFirst({ where: { id: body.levelId, schoolId: user.schoolId! }, select: { id: true } })
    if (!level) return NextResponse.json({ error: "المستوى غير موجود في هذه المدرسة" }, { status: 400 })
  }
  if (body.classroomId) {
    const classroom = await prisma.classroom.findFirst({ where: { id: body.classroomId, schoolId: user.schoolId! }, select: { id: true } })
    if (!classroom) return NextResponse.json({ error: "القسم غير موجود في هذه المدرسة" }, { status: 400 })
  }
  const fee = await prisma.fee.update({
    where: { id: params.id },
    data: {
      name: body.name ?? existing.name,
      amount: body.amount != null ? parsePositiveAmount(body.amount)! : existing.amount,
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
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await prisma.fee.findFirst({ where: { id: params.id, schoolId: user.schoolId! } })
  if (!existing) return NextResponse.json({ error: "الرسم غير موجود" }, { status: 404 })

  const [studentFeeCount, invoiceCount] = await Promise.all([
    prisma.studentFee.count({ where: { feeId: params.id } }),
    prisma.invoice.count({ where: { feeId: params.id } }),
  ])

  if (studentFeeCount > 0 || invoiceCount > 0) {
    return NextResponse.json(
      { error: `لا يمكن حذف هذا الرسم — مرتبط بـ ${studentFeeCount} تسجيل طالب و ${invoiceCount} فاتورة. عطّل الرسم بدلاً من الحذف.` },
      { status: 400 }
    )
  }

  await prisma.fee.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

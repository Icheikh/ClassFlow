import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const month = url.searchParams.get("month")
  const status = url.searchParams.get("status")

  const where: any = { schoolId: user.schoolId }
  if (classroomId) where.classroomId = classroomId
  if (month) where.month = month
  if (status) where.status = status

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
      fee: { select: { id: true, name: true, frequency: true } },
      classroom: { select: { id: true, name: true } },
      payments: { select: { id: true, amount: true, date: true, method: true } },
    },
    orderBy: [{ month: "desc" }, { student: { firstName: "asc" } }],
  })

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { feeId, classroomId, month, amount, dueDate } = body
  if (!feeId || !classroomId || !month) return NextResponse.json({ error: "الرسم والقسم والشهر مطلوبون" }, { status: 400 })

  const fee = await prisma.fee.findFirst({ where: { id: feeId, schoolId: user.schoolId } })
  if (!fee) return NextResponse.json({ error: "الرسم غير موجود" }, { status: 404 })

  const studentFees = await prisma.studentFee.findMany({
    where: { feeId, classroomId, isActive: true, schoolId: user.schoolId },
  })

  let created = 0
  for (const sf of studentFees) {
    const existing = await prisma.invoice.findUnique({
      where: { studentFeeId_month: { studentFeeId: sf.id, month } },
    })
    if (existing) continue
    await prisma.invoice.create({
      data: {
        schoolId: user.schoolId,
        studentId: sf.studentId,
        feeId,
        studentFeeId: sf.id,
        classroomId,
        month,
        amount: amount ?? fee.amount,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    })
    created++
  }

  return NextResponse.json({ created })
}

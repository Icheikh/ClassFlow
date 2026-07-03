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
  const studentId = url.searchParams.get("studentId")
  const classroomId = url.searchParams.get("classroomId")
  const month = url.searchParams.get("month")

  const where: any = { schoolId: user.schoolId }
  if (studentId) where.studentId = studentId
  if (classroomId) where.invoice = { classroomId }
  if (month) where.invoice = { ...where.invoice, month }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      fee: { select: { id: true, name: true } },
      invoice: { select: { id: true, month: true, status: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  })

  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.RECORD_PAYMENTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { amount, method, notes, studentId, feeId, invoiceId } = body
  if (!amount || !studentId) return NextResponse.json({ error: "المبلغ والطالب مطلوبان" }, { status: 400 })

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        schoolId: user.schoolId,
        amount: parseFloat(amount),
        date: new Date(),
        method: method || "CASH",
        notes: notes || null,
        studentId,
        feeId: feeId || null,
        invoiceId: invoiceId || null,
        receivedByUserId: user.id,
      },
    })

    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
      if (invoice) {
        const totalPaid = await tx.payment.aggregate({
          where: { invoiceId, schoolId: user.schoolId },
          _sum: { amount: true },
        })
        const newStatus = (totalPaid._sum.amount || 0) >= invoice.amount ? "PAID" : "PARTIAL"
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } })
      }
    }

    return p
  })

  return NextResponse.json(payment)
}

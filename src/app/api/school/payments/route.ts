import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, hasPermission, PERMISSIONS } from "@/lib/permissions"
import { Prisma } from "@prisma/client"
import { createNotificationCampaign } from "@/lib/notifications"

type ReceiptCampaignPayload = {
  title: string
  message: string
  studentIds: string[]
}

function canReadFinance(user: any) {
  return hasAnyPermission(user, [
    PERMISSIONS.MANAGE_FEES,
    PERMISSIONS.RECORD_PAYMENTS,
    PERMISSIONS.VIEW_FINANCE_REPORTS,
  ]) || ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
}

async function buildReceiptNumber(tx: Prisma.TransactionClient, schoolId: string) {
  const count = await tx.payment.count({ where: { schoolId } })
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `RCPT-${today}-${String(count + 1).padStart(4, "0")}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canReadFinance(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
    select: { id: true },
  })
  if (!student) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 })

  if (feeId) {
    const fee = await prisma.fee.findFirst({ where: { id: feeId, schoolId: user.schoolId }, select: { id: true } })
    if (!fee) return NextResponse.json({ error: "الرسم غير موجود" }, { status: 404 })
  }

  if (invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, schoolId: user.schoolId },
      select: { id: true },
    })
    if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 })
  }

  let receiptCampaignData: ReceiptCampaignPayload | undefined

  const payment = await prisma.$transaction(async (tx) => {
    const receiptNumber = await buildReceiptNumber(tx, user.schoolId)
    const p = await tx.payment.create({
      data: {
        schoolId: user.schoolId,
        amount: parseFloat(amount),
        date: new Date(),
        method: method || "CASH",
        receiptNumber,
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

    if (feeId) {
      const fee = await tx.fee.findUnique({ where: { id: feeId } })
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { id: true },
      })

      if (student && fee) {
        receiptCampaignData = {
          title: "إيصال تسديد الرسوم",
          message: `تم تسجيل دفعة بقيمة ${amount} أوقية للرسم ${fee.name}. رقم الإيصال ${receiptNumber}.`,
          studentIds: [student.id],
        }
      }
    }

    return p
  })

  if (receiptCampaignData) {
    const campaignData: ReceiptCampaignPayload = receiptCampaignData
    try {
      await createNotificationCampaign({
        schoolId: user.schoolId,
        createdByUserId: user.id,
        type: "PAYMENT_RECEIPT",
        channel: "WHATSAPP",
        title: campaignData.title,
        message: campaignData.message,
        audience: {
          audienceType: "STUDENTS",
          filters: { studentIds: campaignData.studentIds },
          exclusions: {},
        },
        status: "DRAFT",
      })
    } catch (error) {
      console.error("Receipt campaign creation failed:", error)
    }
  }

  return NextResponse.json(payment)
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { invoiceRemaining } from "@/lib/finance"
import { amountInWordsAr, amountInWordsFr } from "@/lib/amount-words"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user
    if (!session || !user?.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const paymentId = url.searchParams.get("paymentId")
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId required" }, { status: 400 })
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, schoolId: user.schoolId! },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        fee: { select: { name: true } },
        invoice: {
          select: {
            id: true,
            month: true,
            amount: true,
            payments: { select: { amount: true } },
            classroom: { select: { name: true, level: { select: { name: true } } } },
          },
        },
        school: { select: { name: true, phone: true, address: true, logo: true } },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    const receivedBy = payment.receivedByUserId
      ? await prisma.user.findUnique({ where: { id: payment.receivedByUserId }, select: { name: true } })
      : null

    const receiptNumber = payment.receiptNumber || `RCPT-${payment.id.slice(0, 8).toUpperCase()}`
    const invoicePaid = payment.invoice
      ? payment.invoice.payments.reduce((sum, p) => sum + p.amount, 0)
      : null

    return NextResponse.json({
      receiptNumber,
      date: payment.date.toISOString(),
      amount: payment.amount,
      amountWordsAr: amountInWordsAr(payment.amount),
      amountWordsFr: amountInWordsFr(payment.amount),
      method: payment.method,
      notes: payment.notes,
      receivedBy: receivedBy?.name || null,
      student: {
        name: `${payment.student.firstName} ${payment.student.lastName}`,
        number: payment.student.studentNumber,
      },
      fee: payment.fee?.name || null,
      invoice: payment.invoice ? {
        month: payment.invoice.month,
        amount: payment.invoice.amount,
        paid: invoicePaid,
        remaining: invoiceRemaining(payment.invoice.amount, invoicePaid || 0),
        classroom: `${payment.invoice.classroom.level.name} - ${payment.invoice.classroom.name}`,
      } : null,
      school: {
        name: payment.school.name,
        phone: payment.school.phone,
        address: payment.school.address,
        logo: payment.school.logo,
      },
    })
  } catch (error) {
    console.error("GET /api/finance/receipt failed", error)
    return NextResponse.json({ error: "Failed to load receipt" }, { status: 500 })
  }
}

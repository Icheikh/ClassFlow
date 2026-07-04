import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getMonthLabel } from "@/lib/finance"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (
    !hasPermission(user, PERMISSIONS.MANAGE_FEES)
    && !hasPermission(user, PERMISSIONS.SEND_NOTIFICATIONS)
    && !isLegacyRole
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const month = typeof body.month === "string" && body.month ? body.month : null
  const classroomId = typeof body.classroomId === "string" && body.classroomId ? body.classroomId : null

  const invoices = await prisma.invoice.findMany({
    where: {
      schoolId: user.schoolId,
      ...(month ? { month } : {}),
      ...(classroomId ? { classroomId } : {}),
      status: { in: ["PENDING", "PARTIAL"] },
    },
    include: {
      payments: { select: { amount: true } },
      student: {
        include: {
          studentParents: {
            where: { receiveNotifications: true },
            include: {
              parent: { include: { user: true } },
            },
          },
        },
      },
      fee: true,
    },
  })

  let queued = 0
  const dedupe = new Set<string>()

  for (const invoice of invoices) {
    const paidAmount = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const remainingAmount = Math.max(invoice.amount - paidAmount, 0)
    const parentLinks = invoice.student.studentParents
    for (const link of parentLinks) {
      const parentUser = link.parent.user
      const key = `${parentUser.id}-${invoice.id}`
      if (dedupe.has(key)) continue
      dedupe.add(key)

      await prisma.notification.create({
        data: {
          schoolId: user.schoolId,
          userId: parentUser.id,
          title: "تذكير بالرسوم المدرسية",
          message: `يرجى تسديد رسم ${invoice.fee.name} الخاص بالشهر ${getMonthLabel(invoice.month)}. المبلغ المتبقي ${remainingAmount} أوقية.`,
          type: "FEE_REMINDER",
          channel: "WHATSAPP",
          status: "PENDING",
        },
      })
      queued += 1
    }
  }

  return NextResponse.json({ queued, invoices: invoices.length })
}

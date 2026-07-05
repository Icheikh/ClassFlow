import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getMonthLabel } from "@/lib/finance"
import { createNotificationCampaign } from "@/lib/notifications"

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
      student: { select: { id: true } },
      fee: true,
    },
  })

  if (invoices.length === 0) {
    return NextResponse.json({ createdCampaign: false, recipients: 0, invoices: 0 })
  }

  const studentIds = Array.from(new Set(invoices.map((invoice) => invoice.studentId)))
  const totalRemaining = invoices.reduce((sum, invoice) => {
    const paidAmount = invoice.payments.reduce((paid, payment) => paid + payment.amount, 0)
    return sum + Math.max(invoice.amount - paidAmount, 0)
  }, 0)

  const feeNames = Array.from(new Set(invoices.map((invoice) => invoice.fee.name)))
  const title = classroomId ? "تنبيه رسوم القسم" : "تنبيه الرسوم المدرسية"
  const message = month
    ? `يرجى مراجعة الرسوم غير المسددة لشهر ${getMonthLabel(month)}. عدد الرسوم المتأخرة ${invoices.length} بإجمالي متبقٍ ${totalRemaining} أوقية.`
    : `يرجى مراجعة الرسوم غير المسددة. عدد الرسوم المتأخرة ${invoices.length} بإجمالي متبقٍ ${totalRemaining} أوقية.`

  try {
    const campaign = await createNotificationCampaign({
      schoolId: user.schoolId,
      createdByUserId: user.id,
      type: "FEES",
      channel: "WHATSAPP",
      title,
      message,
      audience: {
        audienceType: "STUDENTS",
        filters: { studentIds },
        exclusions: {},
      },
      status: "DRAFT",
    })

    await prisma.notificationCampaign.update({
      where: { id: campaign.id },
      data: {
        audienceFilters: JSON.stringify({
          classroomId,
          month,
          studentIds,
          feeNames,
          invoiceIds: invoices.map((invoice) => invoice.id),
        }),
      },
    })

    return NextResponse.json({
      createdCampaign: true,
      campaignId: campaign.id,
      recipients: campaign.recipientsCount,
      invoices: invoices.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "تعذر إنشاء حملة التذكير" }, { status: 400 })
  }
}

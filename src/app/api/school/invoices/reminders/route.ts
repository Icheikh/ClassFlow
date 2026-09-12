import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { getMonthLabel } from "@/lib/finance"
import { createNotificationCampaign } from "@/lib/notifications"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (
    !hasPermission(user, PERMISSIONS.MANAGE_FEES)
    && !hasPermission(user, PERMISSIONS.SEND_NOTIFICATIONS)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const month = typeof body.month === "string" && body.month ? body.month : null
  const classroomId = typeof body.classroomId === "string" && body.classroomId ? body.classroomId : null

  const invoices = await prisma.invoice.findMany({
    where: {
      schoolId: user.schoolId!,
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
  const remainingByStudent = new Map<string, number>()
  const monthsByStudent = new Map<string, Set<string>>()
  const totalRemaining = invoices.reduce((sum, invoice) => {
    const paidAmount = invoice.payments.reduce((paid, payment) => paid + payment.amount, 0)
    const remaining = Math.max(invoice.amount - paidAmount, 0)
    remainingByStudent.set(invoice.studentId, (remainingByStudent.get(invoice.studentId) || 0) + remaining)
    if (!monthsByStudent.has(invoice.studentId)) monthsByStudent.set(invoice.studentId, new Set())
    monthsByStudent.get(invoice.studentId)!.add(invoice.month)
    return sum + remaining
  }, 0)

  const feeNames = Array.from(new Set(invoices.map((invoice) => invoice.fee.name)))
  const title = classroomId ? "تنبيه رسوم القسم" : "تنبيه الرسوم المدرسية"
  const message = month
    ? `يرجى مراجعة الرسوم غير المسددة لشهر ${getMonthLabel(month)}. عدد الرسوم المتأخرة ${invoices.length} بإجمالي متبقٍ ${totalRemaining} أوقية.`
    : `يرجى مراجعة الرسوم غير المسددة. عدد الرسوم المتأخرة ${invoices.length} بإجمالي متبقٍ ${totalRemaining} أوقية.`

  try {
    const feeTemplate = await prisma.notificationTemplate.findFirst({
      where: { schoolId: user.schoolId!, type: "FEE_REMINDER", isActive: true },
      select: { id: true, messageTemplate: true },
    })

    const campaign = await createNotificationCampaign({
      schoolId: user.schoolId!,
      createdByUserId: user.id,
      templateId: feeTemplate?.id || null,
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

    // Personalize every recipient: amount + months owed ({{variables}} fallback).
    const school = await prisma.school.findUnique({ where: { id: user.schoolId! }, select: { name: true } })
    const recipients = await prisma.notificationRecipient.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, studentId: true, student: { select: { firstName: true, lastName: true } } },
    })
    const monthLabel = month ? getMonthLabel(month) : null
    for (const r of recipients) {
      if (!r.studentId) continue
      const remaining = remainingByStudent.get(r.studentId) || 0
      if (remaining <= 0) continue
      const studentName = r.student ? `${r.student.firstName} ${r.student.lastName}` : ""
      const months = monthLabel || Array.from(monthsByStudent.get(r.studentId) || []).sort().join("، ")
      const text = feeTemplate?.messageTemplate
        ? feeTemplate.messageTemplate
            .replace(/\{\{\s*studentName\s*\}\}/g, studentName)
            .replace(/\{\{\s*amount\s*\}\}/g, String(remaining))
            .replace(/\{\{\s*month\s*\}\}/g, months)
            .replace(/\{\{\s*schoolName\s*\}\}/g, school?.name || "")
            .replace(/\{\{\s*[a-zA-Z]+\s*\}\}/g, "")
        : `تذكير من ${school?.name || ""}: مستحقات ${studentName} (${months}): ${remaining} أوقية. يرجى التسديد لدى الإدارة.`
      await prisma.notificationRecipient.update({ where: { id: r.id }, data: { messageOverride: text } })
    }

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

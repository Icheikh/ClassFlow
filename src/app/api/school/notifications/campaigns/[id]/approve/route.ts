import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { sendWhatsAppMessage, isWhatsAppConfigured } from "@/lib/whatsapp"

function canApproveNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS])
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canApproveNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: params.id, schoolId: user.schoolId! },
  })

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })
  if (campaign.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "الحملة ليست بانتظار الاعتماد" }, { status: 400 })
  }
  if (campaign.createdByUserId === user.id && user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "لا يمكنك اعتماد حملة أنشأتها بنفسك" }, { status: 403 })
  }

  if (campaign.scheduledFor) {
    const updated = await prisma.notificationCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "SCHEDULED",
        approvedByUserId: user.id,
        approvedAt: new Date(),
      },
    })
    return NextResponse.json(updated)
  }

  const updated = await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "APPROVED",
      approvedByUserId: user.id,
      approvedAt: new Date(),
    },
  })

  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ ...updated, sendWarning: "WhatsApp غير مُعد" })
  }

  const recipients = await prisma.notificationRecipient.findMany({
    where: { campaignId: campaign.id, status: "PENDING" },
  })

  if (recipients.length === 0) {
    return NextResponse.json({ ...updated, sendWarning: "لا يوجد مستلمون" })
  }

  await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: { status: "SENDING" },
  })

  let sentCount = 0
  let failedCount = 0
  let skippedCount = 0

  for (const recipient of recipients) {
    if (!recipient.phone) {
      await prisma.notificationRecipient.update({
        where: { id: recipient.id },
        data: { status: "SKIPPED", errorMessage: "لا يوجد رقم هاتف" },
      })
      skippedCount++
      continue
    }

    const result = await sendWhatsAppMessage(recipient.phone, campaign.message)

    if (result.success) {
      await prisma.notificationRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.messageId || null,
        },
      })
      sentCount++
    } else {
      await prisma.notificationRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: result.error || "فشل الإرسال",
        },
      })
      failedCount++
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const finalStatus = failedCount === 0 && skippedCount === 0 ? "SENT" : "PARTIAL"
  await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: { status: finalStatus, sentAt: new Date(), completedAt: new Date() },
  })

  return NextResponse.json({
    ...updated,
    status: finalStatus,
    sent: sentCount,
    failed: failedCount,
    skipped: skippedCount,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { sendWhatsAppMessage, isWhatsAppConfigured } from "@/lib/whatsapp"

function canSendNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS])
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canSendNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isWhatsAppConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp غير مُعد. أضف WHATSAPP_API_URL و WHATSAPP_API_TOKEN في ملف .env" },
      { status: 503 }
    )
  }

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: params.id, schoolId: user.schoolId },
  })

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة", }, { status: 404 })
  if (campaign.status !== "APPROVED") {
    return NextResponse.json(
      { error: "الحملة يجب أن تكون معتمدة للإرسال" },
      { status: 400 }
    )
  }

  const recipients = await prisma.notificationRecipient.findMany({
    where: { campaignId: campaign.id, status: "PENDING" },
  })

  if (recipients.length === 0) {
    return NextResponse.json({ error: "لا يوجد مستلمون بانتظار الإرسال", }, { status: 400 })
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
    status: finalStatus,
    sent: sentCount,
    failed: failedCount,
    skipped: skippedCount,
    total: recipients.length,
  })
}

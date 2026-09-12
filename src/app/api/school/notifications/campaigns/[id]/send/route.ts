import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { sendVonageSMS, isVonageConfigured } from "@/lib/vonage"
import { sendMoorsylSMS, isMoorsylConfigured } from "@/lib/moorsyl"
import { renderMessageVars } from "@/lib/message-vars"

function canSendNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS])
}

type ChannelResult = { sent: boolean; channel: string; messageId?: string; error?: string }

async function deliver(to: string, text: string, channel: string): Promise<ChannelResult> {
  // Per-recipient fallback chain (first working channel wins).
  if (channel !== "SMS") {
    const wa = await sendWhatsAppMessage(to, text).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    if (wa.success) return { sent: true, channel: "WHATSAPP", messageId: wa.messageId }
  }
  if (isVonageConfigured()) {
    const v = await sendVonageSMS(to, text).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    if (v.success) return { sent: true, channel: "VONAGE_SMS", messageId: v.messageId }
  }
  if (isMoorsylConfigured()) {
    const s = await sendMoorsylSMS(to, text).catch((e) => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    if (s.success) return { sent: true, channel: "SMS", messageId: s.messageId }
    return { sent: false, channel: "SMS", error: s.error }
  }
  return { sent: false, channel: "NONE", error: "لا توجد قناة إرسال مُعدة (واتساب/Vonage/MoorSyl)" }
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canSendNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: params.id, schoolId: user.schoolId! },
    include: { template: { select: { requiresApproval: true } }, school: { select: { name: true } } },
  })

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })

  // Approval is real now: required only when the template demands it.
  // Template-less or approval-free campaigns send straight from DRAFT.
  const needsApproval = campaign.template ? campaign.template.requiresApproval : false
  if (needsApproval && campaign.status !== "APPROVED") {
    return NextResponse.json({ error: "الحملة تحتاج اعتماداً قبل الإرسال" }, { status: 400 })
  }
  if (!needsApproval && !["DRAFT", "APPROVED"].includes(campaign.status)) {
    return NextResponse.json({ error: "الحملة أُرسلت مسبقاً أو ملغاة" }, { status: 400 })
  }

  const recipients = await prisma.notificationRecipient.findMany({
    where: { campaignId: campaign.id, status: "PENDING" },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  })

  if (recipients.length === 0) {
    return NextResponse.json({ error: "لا يوجد مستلمون بانتظار الإرسال" }, { status: 400 })
  }

  await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "SENDING",
      // Direct send by an authorized sender counts as approval for the trail.
      ...(!needsApproval
        ? { approvedByUserId: user.id, approvedAt: new Date() }
        : {}),
    },
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

    const base = recipient.messageOverride || campaign.message
    const text = renderMessageVars(base, {
      studentName: recipient.student ? `${recipient.student.firstName} ${recipient.student.lastName}` : "",
      schoolName: campaign.school.name,
    })

    const result = await deliver(recipient.phone, text, recipient.channel || campaign.channel)

    if (result.sent) {
      await prisma.notificationRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          channel: result.channel,
          messageRendered: text,
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
          messageRendered: text,
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

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { renderMessageVars } from "@/lib/message-vars"

export type ChannelResult = { sent: boolean; channel: string; messageId?: string; error?: string }

/**
 * عدد الرسائل في كل دفعة.
 * مع Wasender (6-10 ثوانٍ بين الرسائل) الدفعة 4 ≈ 25-40 ثانية،
 * تبقى بأمان تحت حد Vercel (60 ثانية).
 */
export function batchSizeForProvider(): number {
  return 4
}

/** Anti-ban pacing: Wasender Account Protection = 1 msg / 5s → 6-10s عشوائية. */
export function pacingDelayMs(): number {
  return 6000 + Math.floor(Math.random() * 4000)
}

/** إن كان الخطأ حد إرسال، أرجع مدة الانتظار بالمللي ثانية. */
export function isRateLimitError(error?: string): number | null {
  if (!error) return null
  const m = error.match(/بعد (\d+) ثانية|retry_after\D*(\d+)|every (\d+) minute/i)
  if (m) {
    const secs = Number(m[1] || m[2] || (m[3] ? Number(m[3]) * 60 : NaN))
    if (Number.isFinite(secs)) return secs * 1000
  }
  if (/429|حد الإرسال|1 message every/i.test(error)) return 65000
  return null
}

/** سلسلة الإرسال الموحدة: واتساب عبر Wasender فقط (Vonage/MoorSyl معطلان). */
export async function deliver(to: string, text: string, channel: string): Promise<ChannelResult> {
  void channel
  const wa = await sendWhatsAppMessage(to, text).catch((e) => ({
    success: false as const,
    error: e instanceof Error ? e.message : String(e),
  }))
  if (wa.success) return { sent: true, channel: "WHATSAPP", messageId: wa.messageId }
  return { sent: false, channel: "WHATSAPP", error: wa.error || "فشل الإرسال عبر Wasender" }
}

export type BatchResult = {
  sent: number
  failed: number
  skipped: number
  pendingRemaining: number
  done: boolean
}

/**
 * يعالج الدفعة التالية من مستلمي الحملة (PENDING فقط).
 * يُستدعى repeatedly من الواجهة حتى pendingRemaining = 0.
 */
export async function processNextBatch(
  campaignId: string,
  schoolId: string,
  batchSize?: number
): Promise<BatchResult> {
  const limit = batchSize ?? batchSizeForProvider()

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: campaignId, schoolId },
    include: { school: { select: { name: true } } },
  })
  if (!campaign) throw new Error("الحملة غير موجودة")

  const recipients = await prisma.notificationRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    include: { student: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const recipient of recipients) {
    if (!recipient.phone) {
      await prisma.notificationRecipient.update({
        where: { id: recipient.id },
        data: { status: "SKIPPED", errorMessage: "لا يوجد رقم هاتف" },
      })
      skipped++
      continue
    }

    const base = recipient.messageOverride || campaign.message
    const text = renderMessageVars(base, {
      studentName: recipient.student ? `${recipient.student.firstName} ${recipient.student.lastName}` : "",
      schoolName: campaign.school.name,
    })

    let result = await deliver(recipient.phone, text, recipient.channel || campaign.channel)

    if (!result.sent) {
      const backoffMs = isRateLimitError(result.error)
      if (backoffMs) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 70000)))
        result = await deliver(recipient.phone, text, recipient.channel || campaign.channel)
      }
    }

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
      sent++
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
      failed++
    }

    await new Promise((resolve) => setTimeout(resolve, pacingDelayMs()))
  }

  const pendingRemaining = await prisma.notificationRecipient.count({
    where: { campaignId, status: "PENDING" },
  })

  if (pendingRemaining === 0) {
    const failedTotal = await prisma.notificationRecipient.count({
      where: { campaignId, status: "FAILED" },
    })
    const skippedTotal = await prisma.notificationRecipient.count({
      where: { campaignId, status: "SKIPPED" },
    })
    await prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: {
        status: failedTotal === 0 && skippedTotal === 0 ? "SENT" : "PARTIAL",
        sentAt: campaign.sentAt || new Date(),
        completedAt: new Date(),
      },
    })
  }

  return { sent, failed, skipped, pendingRemaining, done: pendingRemaining === 0 }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { processNextBatch } from "@/lib/campaign-sender"

function canSendNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS])
}

/**
 * بدء الإرسال بنظام الدفعات (طابور حقيقي للمدارس).
 * يرسل الدفعة الأولى فقط ثم يرجع pendingRemaining،
 * والواجهة تكمل عبر /process حتى النهاية — بلا timeout.
 */
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canSendNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: params.id, schoolId: user.schoolId! },
    include: { template: { select: { requiresApproval: true } } },
  })

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })

  const needsApproval = campaign.template ? campaign.template.requiresApproval : false
  if (needsApproval && campaign.status !== "APPROVED") {
    return NextResponse.json({ error: "الحملة تحتاج اعتماداً قبل الإرسال" }, { status: 400 })
  }
  if (!needsApproval && !["DRAFT", "APPROVED"].includes(campaign.status)) {
    return NextResponse.json({ error: "الحملة أُرسلت مسبقاً أو ملغاة" }, { status: 400 })
  }

  const pendingCount = await prisma.notificationRecipient.count({
    where: { campaignId: campaign.id, status: "PENDING" },
  })
  if (pendingCount === 0) {
    return NextResponse.json({ error: "لا يوجد مستلمون بانتظار الإرسال" }, { status: 400 })
  }

  await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "SENDING",
      ...(!needsApproval
        ? { approvedByUserId: user.id, approvedAt: new Date() }
        : {}),
    },
  })

  const batch = await processNextBatch(campaign.id, user.schoolId!)

  return NextResponse.json({
    status: batch.done ? undefined : "SENDING",
    sent: batch.sent,
    failed: batch.failed,
    skipped: batch.skipped,
    pendingRemaining: batch.pendingRemaining,
    done: batch.done,
    total: pendingCount,
  })
}

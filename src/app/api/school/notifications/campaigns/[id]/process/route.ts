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
 * يكمل الدفعة التالية من حملة قيد الإرسال.
 * تستدعيه الواجهة تلقائياً حتى pendingRemaining = 0.
 */
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canSendNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: params.id, schoolId: user.schoolId! },
    select: { id: true, status: true },
  })
  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })
  if (campaign.status !== "SENDING") {
    return NextResponse.json({ error: "الحملة ليست قيد الإرسال" }, { status: 400 })
  }

  const batch = await processNextBatch(campaign.id, user.schoolId!)

  const totals = await prisma.notificationCampaign.findFirst({
    where: { id: campaign.id },
    select: { status: true },
  })

  return NextResponse.json({
    status: totals?.status,
    sent: batch.sent,
    failed: batch.failed,
    skipped: batch.skipped,
    pendingRemaining: batch.pendingRemaining,
    done: batch.done,
  })
}

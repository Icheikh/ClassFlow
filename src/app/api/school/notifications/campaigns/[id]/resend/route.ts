import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"

export const dynamic = "force-dynamic"

function canSendNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS])
}

/** Reset FAILED recipients to PENDING so the campaign can be sent again. */
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
  if (!["PARTIAL", "FAILED", "SENT"].includes(campaign.status)) {
    return NextResponse.json({ error: "لا يوجد فاشلون لإعادة إرسالهم" }, { status: 400 })
  }

  const reset = await prisma.notificationRecipient.updateMany({
    where: { campaignId: campaign.id, schoolId: user.schoolId!, status: "FAILED" },
    data: { status: "PENDING", failedAt: null, errorMessage: null },
  })

  return NextResponse.json({ reset: reset.count })
}

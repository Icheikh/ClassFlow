import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"

function canApproveNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS])
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canApproveNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: params.id, schoolId: user.schoolId },
  })

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })
  if (campaign.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "الحملة ليست بانتظار الاعتماد" }, { status: 400 })
  }

  const updated = await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: {
      status: campaign.scheduledFor ? "SCHEDULED" : "APPROVED",
      approvedByUserId: user.id,
      approvedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}

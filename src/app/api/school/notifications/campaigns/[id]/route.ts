import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"

function canManageNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS, PERMISSIONS.MANAGE_FEES])
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaign = await prisma.notificationCampaign.findFirst({
    where: { id: params.id, schoolId: user.schoolId },
    include: {
      template: true,
      createdByUser: { select: { id: true, name: true } },
      approvedByUser: { select: { id: true, name: true } },
      recipients: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
          student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
          parent: { select: { id: true, phone: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!campaign) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })
  return NextResponse.json(campaign)
}

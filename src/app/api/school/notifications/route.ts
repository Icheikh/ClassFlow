import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { parseNotificationMetadata } from "@/lib/operational-notifications"

function canManageNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS, PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.APPROVE_GRADES])
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const status = url.searchParams.get("status")

  const notifications = await prisma.notification.findMany({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      channel: "IN_APP",
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const [unreadCount, pendingCount] = await Promise.all([
    prisma.notification.count({
      where: { schoolId: user.schoolId, userId: user.id, read: false, channel: "IN_APP" },
    }),
    prisma.notification.count({
      where: { schoolId: user.schoolId, userId: user.id, status: "PENDING", channel: "IN_APP" },
    }),
  ])

  return NextResponse.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      metadata: parseNotificationMetadata(notification.metadata),
    })),
    unreadCount,
    pendingCount,
  })
}

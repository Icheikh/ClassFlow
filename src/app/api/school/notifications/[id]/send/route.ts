import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { createNotificationCampaign } from "@/lib/notifications"
import { parseNotificationMetadata } from "@/lib/operational-notifications"

function canManageNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS, PERMISSIONS.MANAGE_STUDENTS])
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : []
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const notification = await prisma.notification.findFirst({
    where: { id: params.id, schoolId: user.schoolId, userId: user.id },
  })
  if (!notification) return NextResponse.json({ error: "التنبيه غير موجود" }, { status: 404 })
  if (notification.type !== "ATTENDANCE_RECORDED") {
    return NextResponse.json({ error: "الإرسال للأولياء متاح حاليًا لتنبيهات الغياب فقط" }, { status: 400 })
  }

  const metadata = parseNotificationMetadata(notification.metadata)
  const studentIds = toStringArray(metadata?.studentIds)
  const parentTitle = typeof metadata?.parentTitle === "string" ? metadata.parentTitle : notification.title
  const parentMessage = typeof metadata?.parentMessage === "string" ? metadata.parentMessage : notification.message
  if (studentIds.length === 0) {
    return NextResponse.json({ error: "لا توجد قائمة طلاب مرتبطة بهذا التنبيه" }, { status: 400 })
  }

  try {
    const campaign = await createNotificationCampaign({
      schoolId: user.schoolId,
      createdByUserId: user.id,
      type: "ATTENDANCE",
      channel: "WHATSAPP",
      title: parentTitle,
      message: parentMessage,
      audience: {
        audienceType: "STUDENTS",
        filters: { studentIds },
        exclusions: {},
      },
      status: "DRAFT",
    })

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "ACTIONED", read: true },
    })

    return NextResponse.json({
      campaignId: campaign.id,
      recipientsCount: campaign.recipientsCount,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "تعذر إنشاء مسودة الإرسال" }, { status: 400 })
  }
}

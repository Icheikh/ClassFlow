import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"
import { createNotificationCampaign, normalizeAudienceInput } from "@/lib/notifications"

function canManageNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS, PERMISSIONS.MANAGE_FEES])
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const campaigns = await prisma.notificationCampaign.findMany({
    where: { schoolId: user.schoolId },
    include: {
      template: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true } },
      approvedByUser: { select: { id: true, name: true } },
      recipients: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return NextResponse.json(
    campaigns.map((campaign) => {
      const statusSummary = campaign.recipients.reduce<Record<string, number>>((acc, recipient) => {
        acc[recipient.status] = (acc[recipient.status] || 0) + 1
        return acc
      }, {})

      return {
        ...campaign,
        recipients: undefined,
        statusSummary,
      }
    })
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const message = typeof body.message === "string" ? body.message.trim() : ""
  const type = typeof body.type === "string" ? body.type.trim() : ""
  const channel = typeof body.channel === "string" ? body.channel.trim() : "WHATSAPP"
  const templateId = typeof body.templateId === "string" ? body.templateId : null
  const scheduledFor = typeof body.scheduledFor === "string" && body.scheduledFor ? new Date(body.scheduledFor) : null
  const audience = normalizeAudienceInput(body.audience)

  if (!title || !message || !type) {
    return NextResponse.json({ error: "العنوان والنص والنوع مطلوبة" }, { status: 400 })
  }

  try {
    const campaign = await createNotificationCampaign({
      schoolId: user.schoolId,
      createdByUserId: user.id,
      templateId,
      type,
      channel,
      title,
      message,
      audience,
      scheduledFor,
    })

    return NextResponse.json(campaign)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "تعذر إنشاء الحملة" }, { status: 400 })
  }
}

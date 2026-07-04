import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"

function canManageNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS, PERMISSIONS.MANAGE_FEES])
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const templates = await prisma.notificationTemplate.findMany({
    where: { schoolId: user.schoolId, isActive: true },
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const type = typeof body.type === "string" ? body.type.trim() : ""
  const channel = typeof body.channel === "string" ? body.channel.trim() : "WHATSAPP"
  const titleTemplate = typeof body.titleTemplate === "string" ? body.titleTemplate.trim() : ""
  const messageTemplate = typeof body.messageTemplate === "string" ? body.messageTemplate.trim() : ""

  if (!name || !type || !titleTemplate || !messageTemplate) {
    return NextResponse.json({ error: "الاسم والنوع والعنوان والنص مطلوبة" }, { status: 400 })
  }

  const template = await prisma.notificationTemplate.create({
    data: {
      schoolId: user.schoolId,
      name,
      type,
      channel,
      titleTemplate,
      messageTemplate,
      requiresApproval: body.requiresApproval !== false,
      createdByUserId: user.id,
    },
  })

  return NextResponse.json(template)
}

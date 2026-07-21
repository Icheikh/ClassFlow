import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"

function canManageNotifications(user: any) {
  return ["SCHOOL_ADMIN", "SUPERVISOR"].includes(user?.role)
    || hasAnyPermission(user, [PERMISSIONS.SEND_NOTIFICATIONS, PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.APPROVE_GRADES])
}

const ALLOWED_STATUSES = new Set(["PENDING", "RESOLVED", "DISMISSED", "ACTIONED"])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageNotifications(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const status = typeof body.status === "string" ? body.status : null
  const read = typeof body.read === "boolean" ? body.read : undefined

  if (status && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "حالة التنبيه غير صالحة" }, { status: 400 })
  }

  const notification = await prisma.notification.findFirst({
    where: { id: params.id, schoolId: user.schoolId, userId: user.id },
    select: { id: true },
  })
  if (!notification) return NextResponse.json({ error: "التنبيه غير موجود" }, { status: 404 })

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: {
      ...(status && { status }),
      ...(read !== undefined && { read }),
      ...(status && status !== "PENDING" && { read: true }),
      ...(status === "PENDING" && { read: false }),
    },
  })

  return NextResponse.json(updated)
}

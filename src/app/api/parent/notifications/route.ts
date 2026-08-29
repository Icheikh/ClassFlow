import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id: string; role: string } | undefined
  if (!user?.id || user.role !== "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  })

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id: string; role: string } | undefined
  if (!user?.id || user.role !== "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string; markAll?: boolean }

  if (body.markAll) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true, status: "READ" },
    })
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const notif = await prisma.notification.findFirst({
      where: { id: body.id, userId: user.id },
    })
    if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.notification.update({
      where: { id: body.id },
      data: { read: true, status: "READ" },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Missing id or markAll" }, { status: 400 })
}

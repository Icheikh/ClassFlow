import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.stream.findMany({
    where: { schoolId: user.schoolId },
    include: { level: { include: { stage: true } } },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { levelId, name, code } = body
  const item = await prisma.stream.create({
    data: { schoolId: user.schoolId, levelId, name, code },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    await prisma.stream.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.code === "P2003" ? "لا يمكن حذف الشعبة لأنها مرتبطة بأقسام أو معاملات" : e.message || "فشل الحذف"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
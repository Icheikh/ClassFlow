import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const target = await prisma.user.findFirst({
    where: { id: params.id, schoolId: user.schoolId, role: "STAFF" },
    include: {
      userPermissions: {
        include: { permission: true },
      },
    },
  })
  if (!target) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  }

  const allPermissions = await prisma.permission.findMany({ orderBy: { code: "asc" } })

  return NextResponse.json({
    userId: target.id,
    permissions: target.userPermissions.map((up) => ({
      code: up.permission.code,
      name: up.permission.name,
      category: up.permission.category,
    })),
    allPermissions: allPermissions.map((p) => ({
      code: p.code,
      name: p.name,
      category: p.category,
    })),
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (params.id === user.id) {
    return NextResponse.json({ error: "لا يمكن تعديل صلاحيات حسابك الخاص" }, { status: 403 })
  }

  const target = await prisma.user.findFirst({
    where: { id: params.id, schoolId: user.schoolId, role: "STAFF" },
  })
  if (!target) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  }

  const body = await req.json()
  const { permissions } = body
  if (!Array.isArray(permissions)) {
    return NextResponse.json({ error: "permissions must be an array" }, { status: 400 })
  }

  const permissionRecords = await prisma.permission.findMany({
    where: { code: { in: permissions } },
  })

  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId: params.id } })
    if (permissionRecords.length > 0) {
      await tx.userPermission.createMany({
        data: permissionRecords.map((p) => ({
          userId: params.id,
          permissionId: p.id,
          grantedBy: user.id,
        })),
      })
    }
  })

  return NextResponse.json({ success: true })
}

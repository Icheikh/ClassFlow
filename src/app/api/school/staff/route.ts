import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const staff = await prisma.user.findMany({
    where: { schoolId: user.schoolId, role: "STAFF" },
    include: {
      userPermissions: {
        include: { permission: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const result = staff.map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    phone: s.phone,
    isActive: s.isActive,
    permissions: s.userPermissions.map((up) => up.permission.code),
    createdAt: s.createdAt,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { email, name, phone, password, permissions } = body
  if (!email || !name) {
    return NextResponse.json({ error: "البريد الإلكتروني والاسم مطلوبان" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "البريد الإلكتروني موجود مسبقاً" }, { status: 400 })
  }

  const usesDefaultPassword = !password || !password.trim()
  const passwordHash = await bcrypt.hash(password || "password123", 10)

  const staffUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone: phone || null,
      role: "STAFF",
      schoolId: user.schoolId,
      isActive: true,
      mustChangePassword: usesDefaultPassword,
    },
  })

  if (permissions && Array.isArray(permissions) && permissions.length > 0) {
    const permissionRecords = await prisma.permission.findMany({
      where: { code: { in: permissions } },
    })
    await prisma.userPermission.createMany({
      data: permissionRecords.map((p) => ({
        userId: staffUser.id,
        permissionId: p.id,
        grantedBy: user.id,
      })),
    })
  }

  const created = await prisma.user.findUnique({
    where: { id: staffUser.id },
    include: {
      userPermissions: { include: { permission: true } },
    },
  })

  return NextResponse.json({
    id: created!.id,
    email: created!.email,
    name: created!.name,
    phone: created!.phone,
    isActive: created!.isActive,
    permissions: created!.userPermissions.map((up) => up.permission.code),
    createdAt: created!.createdAt,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { id, name, phone, isActive } = body

  if (!id) {
    return NextResponse.json({ error: "id مطلوب" }, { status: 400 })
  }

  const target = await prisma.user.findFirst({
    where: { id, schoolId: user.schoolId, role: "STAFF" },
  })
  if (!target) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  }

  if (id === user.id) {
    return NextResponse.json({ error: "لا يمكن تعديل حسابك الخاص" }, { status: 403 })
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: name ?? undefined,
      phone: phone !== undefined ? phone : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    },
  })

  const updated = await prisma.user.findUnique({
    where: { id },
    include: {
      userPermissions: { include: { permission: true } },
    },
  })

  return NextResponse.json({
    id: updated!.id,
    email: updated!.email,
    name: updated!.name,
    phone: updated!.phone,
    isActive: updated!.isActive,
    permissions: updated!.userPermissions.map((up) => up.permission.code),
    createdAt: updated!.createdAt,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/phone"
import { ensureSchoolUser } from "@/lib/user-accounts"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const staff = await prisma.user.findMany({
    where: { schoolId: user.schoolId!, role: "STAFF" },
    include: {
      userPermissions: {
        include: { permission: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const result = staff.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    status: (s as { status?: string }).status || "ACTIVE",
    isActive: s.isActive,
    permissions: s.userPermissions.map((up) => up.permission.code),
    createdAt: s.createdAt,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  // الهاتف هو الهوية الوحيدة — لا إيميل، لا كلمة مرور من المدير.
  const { name, phone, permissions } = body
  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "الاسم ورقم الهاتف مطلوبان" }, { status: 400 })
  }
  if (!normalizePhone(phone)) {
    return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })
  }

  const school = await prisma.school.findUnique({ where: { id: user.schoolId } })
  let account: Awaited<ReturnType<typeof ensureSchoolUser>>
  try {
    account = await ensureSchoolUser({
      schoolId: user.schoolId!,
      phone: phone.trim(),
      name: name.trim(),
      role: "STAFF",
      schoolName: school?.name,
      locale: (body.locale as string) === "fr" ? "fr" : "ar",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "INVALID_PHONE") return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })
    throw e
  }
  const staffUser = await prisma.user.findUnique({ where: { id: account.user.id } })
  if (!staffUser) return NextResponse.json({ error: "فشل إنشاء الحساب" }, { status: 500 })

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
    where: { id: staffUser!.id },
    include: {
      userPermissions: { include: { permission: true } },
    },
  })

  return NextResponse.json({
    id: created!.id,
    name: created!.name,
    phone: created!.phone,
    status: (created as unknown as { status?: string })?.status || "ACTIVE",
    isActive: created!.isActive,
    invited: account.createdUser,
    permissions: created!.userPermissions.map((up) => up.permission.code),
    createdAt: created!.createdAt,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { id, name, phone, isActive } = body

  if (!id) {
    return NextResponse.json({ error: "id مطلوب" }, { status: 400 })
  }

  const target = await prisma.user.findFirst({
    where: { id, schoolId: user.schoolId!, role: "STAFF" },
  })
  if (!target) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  }

  if (id === user.id) {
    return NextResponse.json({ error: "لا يمكن تعديل حسابك الخاص" }, { status: 403 })
  }

  if (phone !== undefined && phone && !normalizePhone(phone)) {
    return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: name ?? undefined,
      phone: phone !== undefined ? phone || null : undefined,
      phoneNormalized:
        phone !== undefined && phone
          ? (normalizePhone(phone) ?? undefined)
          : phone === ""
            ? null
            : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
      status: isActive === false ? "SUSPENDED" : isActive === true ? "ACTIVE" : undefined,
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
    name: updated!.name,
    phone: updated!.phone,
    status: (updated as unknown as { status?: string })?.status || "ACTIVE",
    isActive: updated!.isActive,
    permissions: updated!.userPermissions.map((up) => up.permission.code),
    createdAt: updated!.createdAt,
  })
}

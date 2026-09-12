import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { normalizePhone } from "@/lib/phone"
import { ensureSchoolUser } from "@/lib/user-accounts"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get("status") // "active" (default) | "inactive" | "all"

  const teachers = await prisma.teacher.findMany({
    where: {
      schoolId: user.schoolId!,
      ...(status === "inactive"
        ? { user: { isActive: false } }
        : status === "all"
          ? {}
          : { user: { isActive: true } }),
    },
    include: {
      user: { select: { id: true, name: true, phone: true, isActive: true, status: true } },
      teacherAssignments: {
        include: { subject: true, classroom: { include: { level: true } } },
        where: { academicYear: { isActive: true } },
      },
    },
    orderBy: { user: { name: "asc" } },
  })
  return NextResponse.json(teachers)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_TEACHERS))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  // الهاتف هو الهوية الوحيدة — لا إيميل، لا كلمة مرور من المدير.
  const { name, phone } = body
  if (!name?.trim() || !phone?.trim())
    return NextResponse.json({ error: "الاسم ورقم الهاتف مطلوبان" }, { status: 400 })
  if (!normalizePhone(phone))
    return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })

  const school = await prisma.school.findUnique({ where: { id: user.schoolId } })
  let account: Awaited<ReturnType<typeof ensureSchoolUser>>
  try {
    account = await ensureSchoolUser({
      schoolId: user.schoolId!,
      phone: phone.trim(),
      name: name.trim(),
      role: "TEACHER",
      schoolName: school?.name,
      locale: (body.locale as string) === "fr" ? "fr" : "ar",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "INVALID_PHONE") return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })
    throw e
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId: account.user.id },
    include: {
      user: { select: { id: true, name: true, phone: true, isActive: true, status: true } },
    },
  })

  return NextResponse.json({ ...teacher, invited: account.createdUser })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_TEACHERS))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, name, phone, isActive } = body

  const teacher = await prisma.teacher.findFirst({ where: { id, schoolId: user.schoolId! } })
  if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  let phoneNormalized: string | undefined
  if (phone !== undefined && phone !== null && String(phone).trim() !== "") {
    const normalized = normalizePhone(phone)
    if (!normalized) return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 })
    const clash = await prisma.user.findUnique({
      where: { schoolId_phoneNormalized: { schoolId: user.schoolId!, phoneNormalized: normalized } },
    })
    if (clash && clash.id !== teacher.userId)
      return NextResponse.json({ error: "رقم الهاتف مستخدم لحساب آخر" }, { status: 400 })
    phoneNormalized = normalized
  }

  await prisma.user.update({
    where: { id: teacher.userId },
    data: {
      name,
      phone: phone !== undefined ? phone || null : undefined,
      phoneNormalized: phoneNormalized !== undefined ? phoneNormalized : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
      status: isActive === false ? "SUSPENDED" : isActive === true ? "ACTIVE" : undefined,
    },
  })
  await prisma.teacher.update({
    where: { id },
    data: { phone: phone || undefined },
  })

  const updated = await prisma.teacher.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, phone: true, isActive: true, status: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!hasPermission(user, PERMISSIONS.MANAGE_TEACHERS))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const teacher = await prisma.teacher.findFirst({ where: { id, schoolId: user.schoolId! } })
    if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    // قطع التعيينات في السنة الدراسية النشطة ثم تعطيل الحساب
    await prisma.teacherAssignment.deleteMany({
      where: {
        teacherId: teacher.id,
        schoolId: user.schoolId!,
        academicYear: { isActive: true },
      },
    })
    await prisma.user.update({ where: { id: teacher.userId }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: "فشل الفصل" }, { status: 400 })
  }
}